import * as THREE from 'three';
import { NormalizedConstellation, ORBIT_RADIUS } from './StarDataManager';
import { ControlSettings, DEFAULT_CONTROL_SETTINGS, loadControlSettings } from './ControlSettings';

export type GameState = 'EARTH_HUB' | 'PREVIEW' | 'DISPLACE' | 'ALIGN_PUZZLE' | 'RESOLVED';

export const PASS_ACCURACY_THRESHOLD = 85.0; // Bare minimum accuracy (%) required to lock in on cursor release
export const IDLE_SPIN_DELAY_SEC = 15.0; // Seconds of inactivity in Sky View before gentle idle spin starts

export interface SolvedStats {
  constellationId: string;
  constellationName: string;
  timeSpentSec: number;
  finalAccuracy: number;
  finalAlphaDeg: number;
  distMin: number;
  distMax: number;
  isAutoAligned?: boolean;
}

export interface CameraControllerCallbacks {
  onStateChange?: (state: GameState) => void;
  onAlignmentUpdate?: (alpha: number, accuracy: number, lineOpacity: number, dimFactor: number) => void;
  onTimerUpdate?: (timeLeft: number) => void;
  onSolved?: (stats: SolvedStats) => void;
  onTimeout?: () => void;
}

export class OrbitalCameraController {
  private camera: THREE.PerspectiveCamera;
  private state: GameState = 'EARTH_HUB';
  private callbacks: CameraControllerCallbacks;

  // Active constellation data
  private activeConstellation: NormalizedConstellation | null = null;

  // Earth Hub 360-degree free gaze (camera at 0,0,0)
  private earthYaw: number = 0; // radians
  private earthPitch: number = 0; // radians
  private earthTargetYaw: number = 0;
  private earthTargetPitch: number = 0;

  // Orbital angles around constellation pivot C
  private orbitTheta: number = 0; // horizontal angle [-pi, pi]
  private orbitPhi: number = 0; // vertical angle [-1.35, 1.35]
  private orbitTargetTheta: number = 0;
  private orbitTargetPhi: number = 0;

  // Drag physics & Inertia
  private isPointerDown: boolean = false;
  private prevPointerX: number = 0;
  private prevPointerY: number = 0;
  private dragVelocityX: number = 0;
  private dragVelocityY: number = 0;

  // Timers and Animation Tweens
  private stateElapsedTimeMs: number = 0;
  private puzzleTimerSec: number = 20.0;
  private puzzleStartTimeSec: number = 20.0;
  private customPuzzleTimerSec: number | null = null;
  private isFastDisplace: boolean = false;
  private isTimerRunning: boolean = false;

  // Slerp / Transition caches
  private animStartTheta: number = 0;
  private animStartPhi: number = 0;
  private animTargetTheta: number = 0;
  private animTargetPhi: number = 0;
  private animStartQuat: THREE.Quaternion = new THREE.Quaternion();
  private animTargetQuat: THREE.Quaternion = new THREE.Quaternion();

  // Metrics
  private currentAlpha: number = 90.0; // degrees
  private currentAccuracy: number = 0.0; // 0..100%
  private currentLineOpacity: number = 0.0;
  private currentDimFactor: number = 1.0;

  // Control settings (inversion & sensitivity)
  private controlSettings: ControlSettings = loadControlSettings();

  // Idle away-from-screen sky rotation (activates in EARTH_HUB after 15s without input)
  private idleSec: number = 0;
  private idleSpinDir: number = Math.random() < 0.5 ? 1 : -1;
  private wasIdleSpinning: boolean = false;

  constructor(camera: THREE.PerspectiveCamera, callbacks: CameraControllerCallbacks = {}) {
    this.camera = camera;
    this.callbacks = callbacks;
    this.camera.position.set(0, 0, 0);
    this.camera.up.set(0, 0, 1);
  }

  public setControlSettings(settings: Partial<ControlSettings>) {
    this.controlSettings = { ...this.controlSettings, ...settings };
  }

  public getControlSettings(): ControlSettings {
    return { ...this.controlSettings };
  }

  /**
   * Reset idle away-from-screen timer on any user input.
   */
  public notifyUserActivity() {
    this.idleSec = 0;
    if (this.wasIdleSpinning) {
      this.wasIdleSpinning = false;
      this.idleSpinDir = Math.random() < 0.5 ? 1 : -1;
    }
  }

  public getState(): GameState {
    return this.state;
  }

  public getDisplaceProgress(): number {
    if (this.state === 'DISPLACE') {
      const displaceDuration = this.isFastDisplace ? 800 : 1500;
      return Math.min(1.0, this.stateElapsedTimeMs / displaceDuration);
    }
    if (this.state === 'ALIGN_PUZZLE' || this.state === 'RESOLVED') {
      return 1.0;
    }
    return 0.0;
  }

  public getActiveConstellation(): NormalizedConstellation | null {
    return this.activeConstellation;
  }

  public getPuzzleTimer(): number {
    return Math.max(0, this.puzzleTimerSec);
  }

  public setCustomPuzzleTimer(seconds: number) {
    this.customPuzzleTimerSec = seconds;
    if (this.state === 'ALIGN_PUZZLE') {
      this.puzzleTimerSec = seconds;
      this.callbacks.onTimerUpdate?.(Math.max(0, this.puzzleTimerSec));
    }
  }

  public addBonusTime(seconds: number) {
    this.puzzleTimerSec += seconds;
    this.callbacks.onTimerUpdate?.(Math.max(0, this.puzzleTimerSec));
  }

  public setFastDisplace(enabled: boolean) {
    this.isFastDisplace = enabled;
  }

  public skipPreview() {
    if (this.state === 'PREVIEW') {
      this.transitionTo('DISPLACE');
    }
  }

  public getAlignmentMetrics(): { alpha: number; accuracy: number; lineOpacity: number; dimFactor: number } {
    return {
      alpha: this.currentAlpha,
      accuracy: this.currentAccuracy,
      lineOpacity: this.currentLineOpacity,
      dimFactor: this.currentDimFactor,
    };
  }

  /**
   * Set or switch active constellation from Earth Hub
   */
  public selectConstellation(constellation: NormalizedConstellation, autoPreview: boolean = true) {
    this.activeConstellation = constellation;
    this.isPointerDown = false;
    this.dragVelocityX = 0;
    this.dragVelocityY = 0;

    if (autoPreview) {
      this.transitionTo('PREVIEW');
    } else {
      // Orient initial Earth Hub gaze directly towards the constellation!
      const dir = constellation.pivotDir;
      this.earthPitch = Math.asin(Math.max(-1.0, Math.min(1.0, dir.z)));
      this.earthYaw = Math.atan2(dir.y, dir.x);
      this.earthTargetPitch = this.earthPitch;
      this.earthTargetYaw = this.earthYaw;
    }
  }

  /**
   * Transition to a new state with deterministic initialization
   */
  public transitionTo(nextState: GameState, options?: { isAutoAligned?: boolean }) {
    this.state = nextState;
    this.stateElapsedTimeMs = 0;
    this.isPointerDown = false;
    this.dragVelocityX = 0;
    this.dragVelocityY = 0;
    this.notifyUserActivity();

    if (nextState === 'EARTH_HUB') {
      this.isTimerRunning = false;
      this.currentLineOpacity = 0.0;
      this.currentDimFactor = 1.0;
      this.camera.position.set(0, 0, 0);
      this.camera.up.set(0, 0, 1);
      // Synchronize Earth look angles with current camera orientation
      this.updateEarthLookVectorsFromCamera();
    } else if (nextState === 'PREVIEW') {
      this.isTimerRunning = false;
      this.currentLineOpacity = 1.0;
      this.currentDimFactor = 1.0;

      // Lock player input, setup smooth 800ms slerp to look directly at C
      if (this.activeConstellation) {
        this.camera.position.set(0, 0, 0);
        this.animStartQuat.copy(this.camera.quaternion);

        // Target orientation looking at C from (0,0,0) with up = basis.v
        const lookMat = new THREE.Matrix4().lookAt(
          new THREE.Vector3(0, 0, 0),
          this.activeConstellation.pivot,
          this.activeConstellation.basis.v
        );
        this.animTargetQuat.setFromRotationMatrix(lookMat);
      }
    } else if (nextState === 'DISPLACE') {
      this.isTimerRunning = false;
      // Start orbit at (0, 0)
      this.orbitTheta = 0;
      this.orbitPhi = 0;
      this.orbitTargetTheta = 0;
      this.orbitTargetPhi = 0;

      this.animStartTheta = 0;
      this.animStartPhi = 0;

      // Random starting offset around 90 deg (80°–90°) in a random direction, never exceeding 90°
      const minAngleRad = (80 * Math.PI) / 180;
      const maxAngleRad = (90 * Math.PI) / 180;
      const targetAngleRad = minAngleRad + Math.random() * (maxAngleRad - minAngleRad);
      const randomBearing = Math.random() * Math.PI * 2;

      // Decompose directly into orbital (theta, phi) so neither axis nor total offset exceeds ~90°
      const targetTheta = Math.cos(randomBearing) * targetAngleRad;
      // Clamp vertical orbit phi to [-1.25, 1.25] (~71.6 deg) safely inside gameplay limit [-1.35, 1.35]
      const targetPhi = Math.max(-1.25, Math.min(1.25, Math.sin(randomBearing) * targetAngleRad));

      this.animTargetTheta = targetTheta;
      this.animTargetPhi = targetPhi;
    } else if (nextState === 'ALIGN_PUZZLE') {
      if (this.customPuzzleTimerSec !== null) {
        this.puzzleTimerSec = this.customPuzzleTimerSec;
        this.customPuzzleTimerSec = null;
      } else {
        this.puzzleTimerSec = 20.0;
      }
      this.puzzleStartTimeSec = this.puzzleTimerSec;
      this.isTimerRunning = true;
      this.orbitTargetTheta = this.orbitTheta;
      this.orbitTargetPhi = this.orbitPhi;
      this.dragVelocityX = 0;
      this.dragVelocityY = 0;
    } else if (nextState === 'RESOLVED') {
      this.isTimerRunning = false;
      this.currentLineOpacity = 1.0;
      this.currentDimFactor = 1.0;

      // Smoothly animate (theta, phi) -> (0, 0) over 600ms
      this.animStartTheta = this.orbitTheta;
      this.animStartPhi = this.orbitPhi;
      this.animTargetTheta = 0;
      this.animTargetPhi = 0;

      if (this.callbacks.onSolved && this.activeConstellation) {
        this.callbacks.onSolved({
          constellationId: this.activeConstellation.id,
          constellationName: this.activeConstellation.name,
          timeSpentSec: Math.max(0.1, +(this.puzzleStartTimeSec - this.puzzleTimerSec).toFixed(1)),
          finalAccuracy: +this.currentAccuracy.toFixed(1),
          finalAlphaDeg: +this.currentAlpha.toFixed(1),
          distMin: this.activeConstellation.distMin,
          distMax: this.activeConstellation.distMax,
          isAutoAligned: options?.isAutoAligned === true,
        });
      }
    }

    this.callbacks.onStateChange?.(this.state);
  }

  /**
   * Frame update with delta time in seconds
   */
  public update(deltaSec: number) {
    const deltaMs = deltaSec * 1000;
    this.stateElapsedTimeMs += deltaMs;

    if (this.state === 'EARTH_HUB') {
      this.updateEarthHubState(deltaSec);
    } else if (this.state === 'PREVIEW') {
      this.updatePreviewState(deltaSec);
    } else if (this.state === 'DISPLACE') {
      this.updateDisplaceState(deltaSec);
    } else if (this.state === 'ALIGN_PUZZLE') {
      this.updateAlignPuzzleState(deltaSec);
    } else if (this.state === 'RESOLVED') {
      this.updateResolvedState(deltaSec);
    }

    this.callbacks.onAlignmentUpdate?.(
      this.currentAlpha,
      this.currentAccuracy,
      this.currentLineOpacity,
      this.currentDimFactor
    );
  }

  // --- STATE 1: EARTH_HUB ---
  private updateEarthHubState(deltaSec: number) {
    // Apply frame-rate-independent inertia damping (calibrated to 0.88 per frame at 60Hz)
    if (!this.isPointerDown) {
      this.earthTargetYaw += this.dragVelocityX * deltaSec;
      this.earthTargetPitch += this.dragVelocityY * deltaSec;
      const damp = Math.exp(-7.67 * deltaSec);
      this.dragVelocityX *= damp;
      this.dragVelocityY *= damp;

      // Idle away-from-screen animation: slowly spin camera after 15s of no input
      this.idleSec += deltaSec;
      if (this.idleSec >= IDLE_SPIN_DELAY_SEC) {
        this.wasIdleSpinning = true;
        const idleActiveSec = this.idleSec - IDLE_SPIN_DELAY_SEC;
        const ramp = Math.min(1.0, idleActiveSec / 2.0); // Smooth 2s ease-in
        const spinSpeedRadPerSec = 0.045; // ~2.6 deg/sec slow cinematic rotation
        this.earthTargetYaw += this.idleSpinDir * spinSpeedRadPerSec * ramp * deltaSec;

        // Gently drift pitch into a scenic mid-sky band with subtle vertical wave
        const scenicPitch = Math.sin(idleActiveSec * 0.08) * 0.28;
        this.earthTargetPitch +=
          (scenicPitch - this.earthTargetPitch) * Math.min(1.0, 0.25 * ramp * deltaSec);
      }
    } else {
      this.idleSec = 0;
    }

    // Clamp pitch
    this.earthTargetPitch = Math.max(-1.45, Math.min(1.45, this.earthTargetPitch));

    // Smooth frame-rate-independent lerp (calibrated to 0.18 per frame at 60Hz)
    const earthLerp = 1.0 - Math.exp(-11.91 * deltaSec);
    this.earthYaw += (this.earthTargetYaw - this.earthYaw) * earthLerp;
    this.earthPitch += (this.earthTargetPitch - this.earthPitch) * earthLerp;

    this.camera.position.set(0, 0, 0);
    this.camera.up.set(0, 0, 1);

    // Compute look direction on celestial sphere
    const cosP = Math.cos(this.earthPitch);
    const lookX = cosP * Math.cos(this.earthYaw);
    const lookY = cosP * Math.sin(this.earthYaw);
    const lookZ = Math.sin(this.earthPitch);

    this.camera.lookAt(lookX, lookY, lookZ);

    this.currentLineOpacity = 0.0;
    this.currentDimFactor = 1.0;
    this.currentAlpha = 0.0;
    this.currentAccuracy = 100.0;
  }

  // --- STATE 2: PREVIEW ---
  private updatePreviewState(_deltaSec: number) {
    if (!this.activeConstellation) return;

    // Slerp camera over 800ms to look directly at C
    const slerpDuration = 800;
    const progress = Math.min(1.0, this.stateElapsedTimeMs / slerpDuration);
    const t = easeOutCubic(progress);

    this.camera.position.set(0, 0, 0);
    this.camera.quaternion.slerpQuaternions(this.animStartQuat, this.animTargetQuat, t);

    this.currentLineOpacity = 1.0;
    this.currentDimFactor = 1.0;
    this.currentAlpha = 0.0;
    this.currentAccuracy = 100.0;

    // After preview (1200ms in fast mode, 2500ms in standard), transition to DISPLACE
    const previewDuration = this.isFastDisplace ? 1200 : 2500;
    if (this.stateElapsedTimeMs >= previewDuration) {
      this.transitionTo('DISPLACE');
    }
  }

  // --- STATE 3: DISPLACE ---
  private updateDisplaceState(_deltaSec: number) {
    if (!this.activeConstellation) return;

    const displaceDuration = this.isFastDisplace ? 800 : 1500;
    const progress = Math.min(1.0, this.stateElapsedTimeMs / displaceDuration);
    const t = easeInOutCubic(progress);

    // Interpolate orbital angles to starting scrambled offset
    this.orbitTheta = this.animStartTheta + (this.animTargetTheta - this.animStartTheta) * t;
    this.orbitPhi = this.animStartPhi + (this.animTargetPhi - this.animStartPhi) * t;

    // Active lines transition smoothly to puzzle mode visibility
    if (this.stateElapsedTimeMs <= 600) {
      this.currentLineOpacity = 1.0 - 0.35 * (this.stateElapsedTimeMs / 600);
    } else {
      this.currentLineOpacity = 0.65;
    }

    // Background stars dim from 1.0 to 0.15 over 1500ms
    this.currentDimFactor = 1.0 - 0.85 * t;

    // Update camera orbital position around C
    this.applyOrbitalCameraPosition(this.orbitTheta, this.orbitPhi);

    // Transition when complete
    if (this.stateElapsedTimeMs >= displaceDuration) {
      this.transitionTo('ALIGN_PUZZLE');
    }
  }

  // --- STATE 4: ALIGN_PUZZLE ---
  private updateAlignPuzzleState(deltaSec: number) {
    if (!this.activeConstellation) return;

    // Update 20s countdown timer
    if (this.isTimerRunning) {
      this.puzzleTimerSec -= deltaSec;
      this.callbacks.onTimerUpdate?.(Math.max(0, this.puzzleTimerSec));

      if (this.puzzleTimerSec <= 0.0) {
        this.puzzleTimerSec = 0.0;
        this.isTimerRunning = false;
        this.callbacks.onTimeout?.();
      }
    }

    // Apply frame-rate-independent inertia damping to target angles
    if (!this.isPointerDown) {
      this.orbitTargetTheta += this.dragVelocityX * deltaSec;
      this.orbitTargetPhi += this.dragVelocityY * deltaSec;
      const damp = Math.exp(-7.67 * deltaSec);
      this.dragVelocityX *= damp;
      this.dragVelocityY *= damp;
    }

    // Clamp vertical orbit angle to [-1.35, 1.35] radians
    this.orbitTargetPhi = Math.max(-1.35, Math.min(1.35, this.orbitTargetPhi));

    // Smooth frame-rate-independent lerp (calibrated to 0.22 per frame at 60Hz)
    const orbitLerp = 1.0 - Math.exp(-14.91 * deltaSec);
    this.orbitTheta += (this.orbitTargetTheta - this.orbitTheta) * orbitLerp;
    this.orbitPhi += (this.orbitTargetPhi - this.orbitPhi) * orbitLerp;

    // Apply camera transform
    this.applyOrbitalCameraPosition(this.orbitTheta, this.orbitPhi);

    // Calculate angular deviation alpha:
    // d . f = cos(phi) * cos(theta)
    const cosDist = Math.cos(this.orbitPhi) * Math.cos(this.orbitTheta);
    const clampedCos = Math.max(-1.0, Math.min(1.0, cosDist));
    this.currentAlpha = (Math.acos(clampedCos) * 180.0) / Math.PI;

    // Alignment percentage: max(0, min(100, (1 - alpha / 90) * 100))
    this.currentAccuracy = Math.max(0.0, Math.min(100.0, (1.0 - this.currentAlpha / 90.0) * 100.0));

    // Ensure 3D lines are always clearly shown during the quiz for intuitive alignment:
    // Base opacity: 0.65 when misaligned, smoothly brightening up to 1.0 as match approaches 100%
    const alignRatio = this.currentAccuracy / 100.0;
    this.currentLineOpacity = 0.65 + 0.35 * alignRatio;

    this.currentDimFactor = 0.15;

    // Do not auto-complete while dragging; completion is checked on cursor release (>= 85% accuracy).
  }

  // --- STATE 5: RESOLVED ---
  private updateResolvedState(_deltaSec: number) {
    if (!this.activeConstellation) return;

    const snapDuration = 600;
    const progress = Math.min(1.0, this.stateElapsedTimeMs / snapDuration);
    const t = easeOutCubic(progress);

    // Tween (theta, phi) -> (0, 0)
    this.orbitTheta = this.animStartTheta + (this.animTargetTheta - this.animStartTheta) * t;
    this.orbitPhi = this.animStartPhi + (this.animTargetPhi - this.animStartPhi) * t;

    this.applyOrbitalCameraPosition(this.orbitTheta, this.orbitPhi);

    this.currentLineOpacity = 1.0;
    // Restore sky visibility
    this.currentDimFactor = 0.15 + 0.85 * t;

    this.currentAlpha = 0.0;
    this.currentAccuracy = 100.0;
  }

  /**
   * Computes camera position on sphere of radius R_orbit around C:
   * d(theta, phi) = cos(phi)cos(theta)f + cos(phi)sin(theta)r + sin(phi)v
   * P_cam = C + R_orbit * d
   */
  private applyOrbitalCameraPosition(theta: number, phi: number) {
    if (!this.activeConstellation) return;

    const { pivot, basis } = this.activeConstellation;
    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);

    // Direction vector d from pivot C to camera
    const d = new THREE.Vector3()
      .addScaledVector(basis.f, cosPhi * cosTheta)
      .addScaledVector(basis.r, cosPhi * sinTheta)
      .addScaledVector(basis.v, sinPhi);

    // Camera position: C + 100 * d
    const camPos = pivot.clone().addScaledVector(d, ORBIT_RADIUS);

    this.camera.position.copy(camPos);
    this.camera.up.copy(basis.v);
    this.camera.lookAt(pivot);
  }

  private updateEarthLookVectorsFromCamera() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    this.earthPitch = Math.asin(Math.max(-1.0, Math.min(1.0, dir.z)));
    this.earthYaw = Math.atan2(dir.y, dir.x);
    this.earthTargetPitch = this.earthPitch;
    this.earthTargetYaw = this.earthYaw;
  }

  // --- POINTER / DRAG INPUT HANDLERS ---

  public handlePointerDown(clientX: number, clientY: number) {
    this.notifyUserActivity();
    if (this.state !== 'EARTH_HUB' && this.state !== 'ALIGN_PUZZLE') return;

    this.isPointerDown = true;
    this.prevPointerX = clientX;
    this.prevPointerY = clientY;
    this.dragVelocityX = 0;
    this.dragVelocityY = 0;
  }

  public handlePointerMove(clientX: number, clientY: number, buttons?: number) {
    // If no mouse button or touch contact is active, finalize any active drag immediately
    if (buttons !== undefined && buttons === 0) {
      if (this.isPointerDown) {
        this.handlePointerUp(true);
      }
      return;
    }

    if (!this.isPointerDown) return;
    if (this.state !== 'EARTH_HUB' && this.state !== 'ALIGN_PUZZLE') return;

    const factorX = (this.controlSettings.invertX ? -1 : 1) * this.controlSettings.sensitivity;
    const factorY = (this.controlSettings.invertY ? -1 : 1) * this.controlSettings.sensitivity;

    const deltaX = (clientX - this.prevPointerX) * factorX;
    const deltaY = (clientY - this.prevPointerY) * factorY;
    this.prevPointerX = clientX;
    this.prevPointerY = clientY;

    if (this.state === 'EARTH_HUB') {
      const speed = 0.0035;
      // Natural grab: dragging right moves sky right, dragging down moves sky down
      this.earthTargetYaw += deltaX * speed;
      this.earthTargetPitch += deltaY * speed;
      this.dragVelocityX = deltaX * speed * 25;
      this.dragVelocityY = deltaY * speed * 25;
    } else if (this.state === 'ALIGN_PUZZLE') {
      const speed = 0.0042;
      // Direct 1:1 control in puzzle: only moves while held, zero residual inertia drift on release
      this.orbitTargetTheta += deltaX * speed;
      this.orbitTargetPhi += deltaY * speed;
      this.dragVelocityX = 0;
      this.dragVelocityY = 0;
    }
  }

  public handlePointerUp(commitAlignment: boolean = true) {
    const wasPointerDown = this.isPointerDown;
    this.isPointerDown = false;
    this.dragVelocityX = 0;
    this.dragVelocityY = 0;

    // Mark puzzle completed only upon releasing the cursor when accuracy meets the minimum passing limit (>= 85%)
    if (
      commitAlignment &&
      wasPointerDown &&
      this.state === 'ALIGN_PUZZLE' &&
      this.isTimerRunning
    ) {
      const displayedAccuracy = Number(this.currentAccuracy.toFixed(1));
      if (displayedAccuracy >= PASS_ACCURACY_THRESHOLD) {
        this.transitionTo('RESOLVED');
      }
    }
  }

  /**
   * Action from Timeout Modal: Retry orbit with new random angles and restarted timer
   */
  public retryOrbit() {
    if (this.state !== 'ALIGN_PUZZLE') return;
    this.transitionTo('DISPLACE');
  }

  /**
   * Action from Timeout Modal: Auto-align smoothly back to Earth (0,0,0) without crediting a solve
   */
  public autoAlignToEarth() {
    this.transitionTo('RESOLVED', { isAutoAligned: true });
  }
}

// Ease curves
function easeInOutCubic(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

export const BACKGROUND_STAR_VERTEX_SHADER = `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aAlpha;

  uniform vec3 uCamPos;
  uniform float uDimFactor;
  uniform float uPixelRatio;
  uniform float uTime;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vTwinkle;
  varying float vBrightness;

  void main() {
    vColor = aColor;
    vAlpha = aAlpha;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    // Realistic astronomical point sizing:
    // Clearly visible, brilliant stellar pinpoints (1.8px to 7.5px)
    float apparentSize = clamp(aSize * 0.42, 1.8, 7.5);
    gl_PointSize = clamp(apparentSize * uPixelRatio, 1.5, 16.0);

    // Atmospheric scintillation (twinkle) based on star coordinates
    float hash = fract(sin(dot(position.xyz, vec3(12.9898, 78.233, 45.164))) * 43758.5453);
    float twinkleSpeed = 2.2 + hash * 3.2;
    float twinklePhase = hash * 6.28318;
    vTwinkle = 0.86 + 0.14 * sin(uTime * twinkleSpeed + twinklePhase);

    vBrightness = aSize;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const BACKGROUND_STAR_FRAGMENT_SHADER = `
  uniform float uDimFactor;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vTwinkle;
  varying float vBrightness;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;

    // 1. Intense pinpoint Airy disk core (steep exponential drop)
    float core = exp(-dist * dist * 36.0);

    // 2. Natural optical scatter halo
    float halo = exp(-dist * 6.5);

    // 3. Four-point diffraction spikes on bright stars (mag < 2.5, vBrightness > 4.5)
    float spike = 0.0;
    if (vBrightness > 4.5) {
      float ax = abs(coord.x);
      float ay = abs(coord.y);
      float spikeX = max(0.0, 1.0 - ax * 22.0) * max(0.0, 1.0 - ay * 3.5);
      float spikeY = max(0.0, 1.0 - ay * 22.0) * max(0.0, 1.0 - ax * 3.5);
      spike = (spikeX + spikeY) * clamp((vBrightness - 4.5) * 0.38, 0.0, 1.0);
    }

    // White-hot core: in real astronomy, bright star cores saturate to pure radiant white
    vec3 hotCore = mix(vColor, vec3(1.0, 1.0, 1.0), core * 0.92);

    // HDR emission boost so stars actually shine brightly on screen!
    vec3 emission = hotCore * (core * 2.8 + halo * 1.1 + spike * 1.4);
    float alpha = clamp(core * 1.0 + halo * 0.55 + spike * 0.75, 0.0, 1.0) * vTwinkle * vAlpha * uDimFactor;

    gl_FragColor = vec4(emission * vTwinkle * uDimFactor, alpha);
  }
`;

// ============================================================================
// 2. ACTIVE CONSTELLATION POINT STARS (When viewing from Earth / NOT solving)
// ============================================================================
export const ACTIVE_POINT_STAR_VERTEX_SHADER = `
  attribute vec3 aColor;
  attribute float aSize;

  uniform float uPixelRatio;
  uniform float uTime;

  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    vColor = aColor;

    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    // Clearly defined astronomical point size in sky view
    float apparent = clamp(aSize * 0.12, 3.8, 8.5);
    float pulse = 0.94 + 0.06 * sin(uTime * 3.2);
    gl_PointSize = clamp(apparent * pulse * uPixelRatio, 3.0, 18.0);

    float hash = fract(sin(dot(position.xyz, vec3(31.41, 15.92, 65.35))) * 43758.5453);
    vTwinkle = 0.90 + 0.10 * sin(uTime * 4.2 + hash * 6.28);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const ACTIVE_POINT_STAR_FRAGMENT_SHADER = `
  uniform float uOpacity;
  uniform float uTime;

  varying vec3 vColor;
  varying float vTwinkle;

  void main() {
    if (uOpacity <= 0.001) discard;

    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;

    float core = exp(-dist * dist * 30.0);
    float halo = exp(-dist * 6.0);

    // Brilliant cross diffraction flare
    float ax = abs(coord.x);
    float ay = abs(coord.y);
    float spike = (max(0.0, 1.0 - ax * 20.0) * max(0.0, 1.0 - ay * 3.0) +
                   max(0.0, 1.0 - ay * 20.0) * max(0.0, 1.0 - ax * 3.0)) * 0.7;

    // Intense brilliant white-hot core with radiant emission
    vec3 hotColor = mix(vColor, vec3(1.0, 1.0, 1.0), core * 0.95);
    vec3 emission = hotColor * (core * 3.4 + halo * 1.5 + spike * 1.9);
    float alpha = clamp(core * 1.0 + halo * 0.65 + spike * 0.85, 0.0, 1.0) * vTwinkle * uOpacity;

    gl_FragColor = vec4(emission * vTwinkle * uOpacity, alpha);
  }
`;

// Legacy alias for backwards compatibility if needed
export const ACTIVE_STAR_VERTEX_SHADER = ACTIVE_POINT_STAR_VERTEX_SHADER;
export const ACTIVE_STAR_FRAGMENT_SHADER = ACTIVE_POINT_STAR_FRAGMENT_SHADER;

// ============================================================================
// 3. 3D STAR SPHERE SURFACE (Photosphere with solar plasma & limb darkening)
//    USED ONLY WHEN SOLVING IT!
// ============================================================================
export const STAR_SPHERE_SURFACE_VERTEX_SHADER = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const STAR_SPHERE_SURFACE_FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uTime;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;

  // Ashima 3D Simplex Noise for procedural solar convective cells
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  void main() {
    // Dynamic solar surface granulation
    float n1 = snoise(vec3(vUv * 4.0, uTime * 0.22));
    float n2 = snoise(vec3(vUv * 9.0, uTime * 0.35 + 12.0));
    float plasma = (n1 * 0.65 + n2 * 0.35);

    // Realistic Eddington limb darkening
    vec3 viewDir = normalize(-vPosition);
    float cosTheta = max(0.0, dot(viewDir, vNormal));
    float limbDarkening = 0.45 + 0.55 * pow(cosTheta, 0.65);

    // Blazing white-hot fusion core
    vec3 whiteHot = vec3(1.0, 1.0, 1.0);
    vec3 coreColor = mix(uColor, whiteHot, pow(cosTheta, 1.8) * 0.88);
    vec3 surfaceColor = mix(coreColor, uColor * 1.4, plasma * 0.2);

    // High emission radiance so the star sphere shines brightly like a real sun!
    vec3 finalColor = surfaceColor * limbDarkening * (2.2 + pow(cosTheta, 1.2) * 1.4);

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// ============================================================================
// 4. 3D STAR SPHERE CORONA (Radiant atmospheric limb & outer volumetric glow)
//    USED ONLY WHEN SOLVING IT!
// ============================================================================
export const STAR_SPHERE_CORONA_VERTEX_SHADER = `
  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const STAR_SPHERE_CORONA_FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uTime;

  varying vec3 vNormal;
  varying vec3 vPosition;

  void main() {
    vec3 viewDir = normalize(-vPosition);
    float dp = dot(vNormal, viewDir);
    // Corona limb glow: soft inner and radiant outer
    float innerGlow = pow(max(0.0, dp), 1.3);
    float outerGlow = pow(max(0.0, dp), 2.8);

    // Pulsating coronal flares
    float pulse = 0.90 + 0.10 * sin(uTime * 2.5);
    float intensity = (innerGlow * 1.3 + outerGlow * 1.6) * pulse;

    // Radiant spectral emission with white-hot inner rim
    vec3 hotCorona = mix(uColor, vec3(1.0, 1.0, 1.0), outerGlow * 0.65);
    vec3 emission = hotCorona * intensity * 2.6;

    gl_FragColor = vec4(emission, clamp(intensity * 0.85, 0.0, 1.0));
  }
`;

// ============================================================================
// 5. CONSTELLATION LINE SHADERS
// ============================================================================
export const CONSTELLATION_LINE_VERTEX_SHADER = `
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const CONSTELLATION_LINE_FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uLineOpacity;
  uniform float uTime;
  uniform float uAccuracy;

  void main() {
    if (uLineOpacity <= 0.001) discard;
    // Harmonic celestial resonance pulse
    float pulse = 0.92 + 0.08 * sin(uTime * 3.5);
    // Align feedback: glow brightens and shifts to radiant core as accuracy approaches 100%
    float boost = 1.4 + 1.2 * clamp(uAccuracy / 100.0, 0.0, 1.0);
    vec3 radiantColor = mix(uColor, vec3(1.0, 0.95, 0.8), clamp((uAccuracy - 70.0) / 30.0, 0.0, 0.75));
    gl_FragColor = vec4(radiantColor * boost * pulse, uLineOpacity);
  }
`;

// ============================================================================
// 6. ALL-CONSTELLATIONS ANIMATED LINES SHADERS (Sky View Progressive Wave)
// ============================================================================
export const ALL_CONSTELLATION_LINES_VERTEX_SHADER = `
  attribute vec3 aStartPos;
  attribute vec3 aEndPos;
  attribute float aIsEnd;
  attribute float aStartTime;
  attribute float aDuration;
  attribute vec3 aColor;

  uniform float uAnimTime;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vEdgeProgress;

  void main() {
    vColor = aColor;

    // Local edge progress: 0.0 before aStartTime, 0.0 -> 1.0 during [aStartTime, aStartTime + aDuration], 1.0 after
    float t = clamp((uAnimTime - aStartTime) / max(0.0001, aDuration), 0.0, 1.0);
    // Smooth cubic easing for natural, organic wave propagation
    float easedT = smoothstep(0.0, 1.0, t);

    // If aIsEnd == 1.0, currentPos interpolates from aStartPos to aEndPos by easedT.
    // If aIsEnd == 0.0, currentPos stays at aStartPos.
    // When t == 0.0, easedT == 0.0, so both vertices are at aStartPos (0-length collapsed segment).
    vec3 currentPos = mix(aStartPos, aEndPos, aIsEnd * easedT);

    vAlpha = (t > 0.0001) ? 1.0 : 0.0;
    vEdgeProgress = t;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(currentPos, 1.0);
  }
`;

export const ALL_CONSTELLATION_LINES_FRAGMENT_SHADER = `
  uniform float uGlobalOpacity;
  uniform float uTime;

  varying vec3 vColor;
  varying float vAlpha;
  varying float vEdgeProgress;

  void main() {
    if (uGlobalOpacity <= 0.001 || vAlpha <= 0.001) discard;

    // Atmospheric starlight scintillation
    float shimmer = 0.90 + 0.10 * sin(uTime * 2.8);

    // Dynamic wave glow while forming
    float isForming = (vEdgeProgress > 0.001 && vEdgeProgress < 0.999) ? 1.0 : 0.0;
    vec3 hotGlow = mix(vColor, vec3(1.0, 1.0, 1.0), isForming * 0.45);

    vec3 emission = hotGlow * (1.6 * shimmer + isForming * 0.8);
    float finalAlpha = uGlobalOpacity * vAlpha * (0.80 + isForming * 0.20);

    gl_FragColor = vec4(emission, finalAlpha);
  }
`;

// ============================================================================
// 7. GHOST TARGET ALIGNMENT GUIDE LINE SHADERS (Quiz View)
// ============================================================================
export const GHOST_GUIDE_LINE_VERTEX_SHADER = `
  attribute float aLineLength;
  varying float vLineCoord;

  void main() {
    vLineCoord = aLineLength;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const GHOST_GUIDE_LINE_FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uAccuracy;

  varying float vLineCoord;

  void main() {
    if (uOpacity <= 0.001) discard;

    // Elegant dashed celestial reticle pattern
    float dash = sin(vLineCoord * 3.5 - uTime * 2.0);
    float pattern = smoothstep(-0.25, 0.25, dash) * 0.40 + 0.60;

    // Enhanced resonance when getting closer to target alignment
    float resonance = 1.0 + (uAccuracy / 100.0) * 0.75;
    vec3 glowColor = mix(uColor, vec3(1.0, 0.95, 0.75), (uAccuracy / 100.0) * 0.65);

    gl_FragColor = vec4(glowColor * 1.5 * resonance, uOpacity * pattern);
  }
`;

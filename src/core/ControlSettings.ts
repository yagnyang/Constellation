export interface ControlSettings {
  invertX: boolean; // default true
  invertY: boolean; // default false
  sensitivity: number; // default 1.0 (range 0.2 to 3.0)
}

export const DEFAULT_CONTROL_SETTINGS: ControlSettings = {
  invertX: true,
  invertY: false,
  sensitivity: 1.0,
};

export const CONTROL_SETTINGS_STORAGE_KEY = 'starc_control_settings';

export function loadControlSettings(): ControlSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_CONTROL_SETTINGS };
  try {
    const raw = localStorage.getItem(CONTROL_SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        invertX: typeof parsed.invertX === 'boolean' ? parsed.invertX : DEFAULT_CONTROL_SETTINGS.invertX,
        invertY: typeof parsed.invertY === 'boolean' ? parsed.invertY : DEFAULT_CONTROL_SETTINGS.invertY,
        sensitivity:
          typeof parsed.sensitivity === 'number' && !isNaN(parsed.sensitivity)
            ? Math.max(0.2, Math.min(3.0, parsed.sensitivity))
            : DEFAULT_CONTROL_SETTINGS.sensitivity,
      };
    }
  } catch {}
  return { ...DEFAULT_CONTROL_SETTINGS };
}

export function saveControlSettings(settings: ControlSettings): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CONTROL_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

'use client';

import React, { useEffect } from 'react';
import { ControlSettings, DEFAULT_CONTROL_SETTINGS } from '../core/ControlSettings';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ControlSettings;
  onUpdateSettings: (newSettings: Partial<ControlSettings>) => void;
  onResetSettings: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onResetSettings,
}) => {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn pointer-events-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-zinc-950/95 border border-purple-500/30 rounded-3xl p-6 md:p-7 shadow-[0_16px_64px_rgba(0,0,0,0.9),0_0_32px_rgba(168,85,247,0.18)] backdrop-blur-2xl text-white space-y-6 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <circle cx="12" cy="12" r="3" strokeWidth={1.8} />
                </svg>
              </div>
              <h2 className="text-lg font-bold tracking-tight text-white">Control Settings</h2>
            </div>
            <p className="text-xs text-white/50 pl-1">
              Customize camera rotation and orbital puzzle controls
            </p>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all active:scale-95"
            title="Close"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Options List */}
        <div className="space-y-4">
          {/* Option 1: Invert X Axis */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-purple-500/25 transition-all flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">Invert X-Axis</span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-medium ${
                    settings.invertX
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'bg-white/5 text-white/40 border border-white/10'
                  }`}
                >
                  {settings.invertX ? 'Inverted (Default)' : 'Normal'}
                </span>
              </div>
              <p className="text-xs text-white/50 leading-relaxed">
                Reverses horizontal drag direction for sky navigation and 3D puzzle rotation.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={settings.invertX}
              onClick={() => onUpdateSettings({ invertX: !settings.invertX })}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.invertX ? 'bg-purple-600' : 'bg-white/20'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings.invertX ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Option 2: Invert Y Axis */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-purple-500/25 transition-all flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">Invert Y-Axis</span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase font-medium ${
                    settings.invertY
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'bg-white/5 text-white/40 border border-white/10'
                  }`}
                >
                  {settings.invertY ? 'Inverted' : 'Normal (Default)'}
                </span>
              </div>
              <p className="text-xs text-white/50 leading-relaxed">
                Reverses vertical drag direction for pitch and tilt.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={settings.invertY}
              onClick={() => onUpdateSettings({ invertY: !settings.invertY })}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.invertY ? 'bg-purple-600' : 'bg-white/20'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  settings.invertY ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Option 3: Sensitivity */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-purple-500/25 transition-all space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Drag Sensitivity</span>
              <span className="text-xs font-mono font-medium text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                {settings.sensitivity.toFixed(1)}x
              </span>
            </div>
            <div className="space-y-1">
              <input
                type="range"
                min="0.3"
                max="2.5"
                step="0.1"
                value={settings.sensitivity}
                onChange={(e) => onUpdateSettings({ sensitivity: parseFloat(e.target.value) })}
                className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <div className="flex justify-between text-[10px] text-white/40 font-mono">
                <span>0.3x (Slow)</span>
                <span>1.0x (Standard)</span>
                <span>2.5x (Fast)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex items-center justify-between gap-3 border-t border-white/5">
          <button
            type="button"
            onClick={onResetSettings}
            className="px-3.5 py-2 rounded-xl text-xs font-medium text-white/60 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all active:scale-95 flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white shadow-lg shadow-purple-600/30 transition-all active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

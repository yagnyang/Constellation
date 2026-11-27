'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, Timer, Sparkles, Star, ChevronRight, Zap, Mail, Phone, User } from 'lucide-react';

interface DevFestStartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (playerName: string, playerId?: number) => void;
  onOpenLeaderboard: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d\s+\-().]{5,30}$/;

export const DevFestStartModal: React.FC<DevFestStartModalProps> = ({
  isOpen,
  onClose,
  onStart,
  onOpenLeaderboard,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      setError('Please enter your name or callsign to join the tournament.');
      return;
    }
    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      setError('Please enter a valid email address so we can contact you for goodies.');
      return;
    }
    if (trimmedPhone && !PHONE_REGEX.test(trimmedPhone)) {
      setError('Please enter a valid phone number or leave it blank.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone || undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error || 'Could not save your registration. Please try again.');
        setIsSubmitting(false);
        return;
      }

      const playerId = typeof data.player?.id === 'number' ? data.player.id : undefined;
      onStart(trimmedName, playerId);
    } catch {
      setError('Network error while saving registration. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl pointer-events-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-zinc-950/95 border border-purple-500/35 rounded-3xl p-6 sm:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_40px_rgba(168,85,247,0.22)] backdrop-blur-2xl text-white space-y-6 select-none overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow backdrop accent */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-purple-900/25 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="relative space-y-2 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-950/40 border border-purple-500/40 text-[11px] font-semibold text-purple-200 tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
            <span>GDG DevFest Live Booth Challenge</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Astral Speedrun Arena
          </h2>
          <p className="text-xs sm:text-sm text-white/60 max-w-md mx-auto leading-relaxed">
            Rotate and align 3D starfields back into their true Earth constellations before your time bank expires!
          </p>
        </div>

        {/* Rules Cards */}
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="p-3 rounded-2xl bg-purple-950/40 border border-purple-500/30 flex flex-col items-center justify-between shadow-[0_0_15px_rgba(168,85,247,0.15)]">
            <div className="flex items-center gap-1 text-[11px] font-bold text-purple-300 uppercase tracking-wide">
              <Star className="w-3 h-3 fill-purple-300" />
              <span>Easy</span>
            </div>
            <div className="text-xs text-white/50 my-1">2–5 stars</div>
            <div className="text-xs sm:text-sm font-extrabold text-purple-200 font-mono">+0.5s–2.5s</div>
          </div>

          <div className="p-3 rounded-2xl bg-purple-900/40 border border-purple-400/40 flex flex-col items-center justify-between shadow-[0_0_15px_rgba(168,85,247,0.2)]">
            <div className="flex items-center gap-1 text-[11px] font-bold text-purple-300 uppercase tracking-wide">
              <Zap className="w-3 h-3 text-purple-300" />
              <span>Medium</span>
            </div>
            <div className="text-xs text-white/50 my-1">6–12 stars</div>
            <div className="text-xs sm:text-sm font-extrabold text-purple-200 font-mono">+1.0s–4.0s</div>
          </div>

          <div className="p-3 rounded-2xl bg-purple-800/40 border border-purple-300/40 flex flex-col items-center justify-between shadow-[0_0_15px_rgba(168,85,247,0.25)]">
            <div className="flex items-center gap-1 text-[11px] font-bold text-purple-200 uppercase tracking-wide">
              <Sparkles className="w-3 h-3 text-purple-200" />
              <span>Hard</span>
            </div>
            <div className="text-xs text-white/50 my-1">13+ stars</div>
            <div className="text-xs sm:text-sm font-extrabold text-purple-100 font-mono">+2.0s–6.0s</div>
          </div>
        </div>

        {/* Gameplay Notes */}
        <div className="px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between text-xs text-white/70">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-purple-400" />
            <span>
              <strong className="text-white font-mono">20.0s</strong> &bull;{' '}
              <strong className="text-purple-200">3 Tries</strong> (Best Counts)
            </span>
          </div>
          <div className="text-right text-[11px] text-white/50">
            Min 85% &bull; Highest Accuracy + Lowest Time = Top Score
          </div>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
          <div className="space-y-1">
            <label htmlFor="player-name" className="text-xs font-semibold text-white/80 block">
              Player Name / Callsign <span className="text-purple-400">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-purple-400/70 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="player-name"
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError('');
                }}
                placeholder="e.g. Alex_DevFest or Sarah K."
                autoFocus
                maxLength={60}
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/5 border border-purple-500/40 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all shadow-inner font-medium"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="player-email" className="text-xs font-semibold text-white/80 block">
              Email Address <span className="text-purple-400">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-purple-400/70 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="player-email"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                placeholder="you@example.com"
                maxLength={120}
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/5 border border-purple-500/40 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all shadow-inner font-medium"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="player-phone" className="text-xs font-semibold text-white/80 flex items-center justify-between">
              <span>Phone Number</span>
              <span className="text-[11px] font-normal text-white/45">Optional</span>
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-purple-400/70 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="player-phone"
                type="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (error) setError('');
                }}
                placeholder="+91 98765 43210"
                maxLength={30}
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/5 border border-purple-500/30 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all shadow-inner font-medium"
              />
            </div>
          </div>

          <p className="text-[11px] text-white/45 leading-relaxed">
            We&apos;ll only use your contact details to reach out about goodies and prizes.
          </p>

          {error && <p className="text-xs text-rose-300 font-medium">{error}</p>}

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-purple-700 via-purple-600 to-purple-800 hover:from-purple-600 hover:to-purple-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm shadow-[0_0_24px_rgba(168,85,247,0.4)] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <span>{isSubmitting ? 'SAVING...' : 'ENTER ARENA & START'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="py-3 px-5 rounded-2xl bg-white/5 hover:bg-white/10 border border-purple-500/25 text-purple-200 text-xs font-semibold transition-all flex items-center justify-center gap-2"
            >
              <Trophy className="w-4 h-4 text-purple-300" />
              <span>Leaderboard</span>
            </button>
          </div>
        </form>

        <div className="text-center">
          <button
            onClick={onClose}
            className="text-xs text-white/40 hover:text-white transition-colors"
          >
            Or return to free Sky Exploration
          </button>
        </div>
      </div>
    </div>
  );
};

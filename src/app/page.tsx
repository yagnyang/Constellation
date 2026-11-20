'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const ConstellationAlignerApp = dynamic(
  () => import('@/components/ConstellationAlignerApp'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-black text-white gap-3 select-none">
        <div className="w-6 h-6 rounded-full border border-purple-500/30 border-t-purple-400 animate-spin" />
        <span className="text-xs text-white/50 tracking-wider">Loading constellations</span>
      </div>
    ),
  }
);

export default function Page() {
  return (
    <main className="w-screen h-screen overflow-hidden bg-black relative">
      <ConstellationAlignerApp />
    </main>
  );
}


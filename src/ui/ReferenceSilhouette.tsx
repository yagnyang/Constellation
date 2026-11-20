'use client';

import React from 'react';
import { NormalizedConstellation } from '../core/StarDataManager';

interface ReferenceSilhouetteProps {
  constellation: NormalizedConstellation | null;
  className?: string;
}

export const ReferenceSilhouette: React.FC<ReferenceSilhouetteProps> = ({
  constellation,
  className = '',
}) => {
  if (!constellation) return null;

  const size = 130;

  return (
    <div
      className={`relative w-[138px] h-[138px] bg-black/80 backdrop-blur-xl border border-purple-500/20 rounded-xl p-2.5 flex flex-col justify-between shadow-[0_4px_24px_rgba(0,0,0,0.8),0_0_20px_rgba(168,85,247,0.12)] select-none pointer-events-none ${className}`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between text-[11px] text-white/50 pb-1 border-b border-purple-500/10">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
          <span className="font-medium text-white/70">Target</span>
        </span>
        <span className="text-[10px] text-purple-300/70 font-mono">{constellation.id}</span>
      </div>

      {/* SVG Canvas Area */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center my-0.5">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="w-full h-full overflow-visible"
        >
          <defs>
            <filter id="glow-purple" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="star-glow-purple" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Ethereal Constellation Artwork Overlay */}
          {constellation.art?.url && (
            constellation.art.svgMatrix ? (
              <image
                href={constellation.art.url}
                width={constellation.art.width || 512}
                height={constellation.art.height || 512}
                transform={`matrix(${constellation.art.svgMatrix.a * size}, ${constellation.art.svgMatrix.b * size}, ${constellation.art.svgMatrix.c * size}, ${constellation.art.svgMatrix.d * size}, ${constellation.art.svgMatrix.e * size}, ${constellation.art.svgMatrix.f * size})`}
                opacity="0.32"
                className="transition-opacity duration-500"
                style={{
                  filter: 'brightness(1.4) drop-shadow(0 0 10px rgba(192, 132, 252, 0.45))',
                  mixBlendMode: 'screen',
                }}
              />
            ) : (
              <image
                href={constellation.art.url}
                x={size * 0.05}
                y={size * 0.05}
                width={size * 0.9}
                height={size * 0.9}
                preserveAspectRatio="xMidYMid meet"
                opacity="0.28"
                className="transition-opacity duration-500"
                style={{
                  filter: 'brightness(1.4) drop-shadow(0 0 10px rgba(192, 132, 252, 0.45))',
                  mixBlendMode: 'screen',
                }}
              />
            )
          )}

          {/* Stick-figure connection lines */}
          {constellation.lines.map((line, idx) => (
            <line
              key={`ref-line-${idx}`}
              x1={line.proj2D_p1.x * size}
              y1={line.proj2D_p1.y * size}
              x2={line.proj2D_p2.x * size}
              y2={line.proj2D_p2.y * size}
              stroke="#c084fc"
              strokeWidth="1.3"
              strokeOpacity="0.9"
              filter="url(#glow-purple)"
            />
          ))}

          {/* Star vertex circles */}
          {constellation.stars.map((star, idx) => {
            const cx = star.proj2D.x * size;
            const cy = star.proj2D.y * size;
            const radius = Math.max(1.8, (6.5 - star.mag) * 0.65);

            return (
              <g key={`ref-star-${star.id || idx}`}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={radius + 1.2}
                  fill="#c084fc"
                  opacity="0.35"
                  filter="url(#star-glow-purple)"
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="#ffffff"
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Bottom Metadata */}
      <div className="flex items-center justify-between text-[11px] text-white/50 pt-1 border-t border-purple-500/10">
        <span className="truncate text-white/80 font-medium">{constellation.name}</span>
        <span className="text-[10px] text-white/40">{constellation.starCount}★</span>
      </div>
    </div>
  );
};

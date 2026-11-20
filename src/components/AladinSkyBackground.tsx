'use client';

import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    A?: any;
  }
}

export interface AladinSkyBackgroundProps {
  initialRa?: number;
  initialDec?: number;
  initialFov?: number;
  interactive?: boolean;
  showConstellationLines?: boolean;
  onAladinReady?: (aladin: any) => void;
}

export default function AladinSkyBackground({
  initialRa = 83.82, // Default: Orion (RA: 5h 35m)
  initialDec = -5.39,
  initialFov = 60,
  interactive = false, // When false, acts purely as background for overlays/Three.js
  showConstellationLines = true,
  onAladinReady,
}: AladinSkyBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const aladinInstanceRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadAladin() {
      // 1. Load Aladin Lite v3 CSS
      if (!document.getElementById('aladin-v3-css')) {
        const link = document.createElement('link');
        link.id = 'aladin-v3-css';
        link.rel = 'stylesheet';
        link.href = 'https://aladin.cds.unistra.fr/AladinLite/api/v3/latest/aladin.css';
        document.head.appendChild(link);
      }

      // 2. Load Aladin Lite v3 JavaScript SDK
      if (!window.A) {
        await new Promise<void>((resolve, reject) => {
          const existingScript = document.getElementById('aladin-v3-js') as HTMLScriptElement | null;
          if (existingScript) {
            existingScript.addEventListener('load', () => resolve());
            existingScript.addEventListener('error', (e) => reject(e));
            return;
          }

          const script = document.createElement('script');
          script.id = 'aladin-v3-js';
          script.src = 'https://aladin.cds.unistra.fr/AladinLite/api/v3/latest/aladin.js';
          script.charset = 'utf-8';
          script.async = true;
          script.onload = () => resolve();
          script.onerror = (e) => reject(e);
          document.body.appendChild(script);
        });
      }

      if (!isMounted || !containerRef.current || !window.A) return;

      // 3. Await WebGL / WebAssembly initialization
      await window.A.init;

      if (!isMounted || !containerRef.current) return;

      // Clear any prior canvas instance inside container if re-running
      containerRef.current.innerHTML = '';

      // 4. Instantiate Aladin Lite with DSS2 Color and TAN perspective
      const aladin = window.A.aladin(containerRef.current, {
        // High-reliability Digitized Sky Survey 2 Color
        survey: 'P/DSS2/color',
        // Tangential (Gnomonic) perspective projection
        projection: 'TAN',
        cooFrame: 'ICRS',

        // Centered coordinates & wide night-sky FoV
        target: `${initialRa} ${initialDec}`,
        fov: initialFov,

        // Strip every interactive feature & widget
        showReticle: false,
        showZoomControl: false,
        showLayersControl: false,
        showGotoControl: false,
        showShareControl: false,
        showSimbadPointerControl: false,
        showProjectionControl: false,
        showFullscreenControl: false,
        showFrame: false,
        showCooGrid: false,
        showCooGridControl: false,
        showContextMenu: false,
        showSettingsControl: false,
      });

      aladinInstanceRef.current = aladin;
      if (onAladinReady) {
        onAladinReady(aladin);
      }

      // 5. Draw Constellation Outlines (MultiLineString polylines)
      if (showConstellationLines) {
        try {
          const res = await fetch('/data/constellations.lines.json');
          if (res.ok) {
            const geojson = await res.json();
            const overlay = window.A.graphicOverlay({
              name: 'Constellation Lines',
              color: 'rgba(168, 85, 247, 0.75)', // Soft luminous purple
              lineWidth: 1.2,
            });
            aladin.addOverlay(overlay);

            geojson.features?.forEach((feature: any) => {
              const coords = feature.geometry?.coordinates;
              if (Array.isArray(coords)) {
                coords.forEach((segment: number[][]) => {
                  if (segment && segment.length >= 2) {
                    overlay.add(window.A.polyline(segment));
                  }
                });
              }
            });
          }
        } catch (err) {
          console.warn('[AladinLite] Could not load constellations.lines.json overlay:', err);
        }
      }
    }

    loadAladin();

    return () => {
      isMounted = false;
    };
  }, [initialRa, initialDec, initialFov, showConstellationLines, onAladinReady]);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-black select-none pointer-events-none">
      {/* Aladin host DOM node */}
      <div
        ref={containerRef}
        id="aladin-sky-bg"
        className={`w-full h-full ${interactive ? 'pointer-events-auto' : 'pointer-events-none'}`}
      />

      {/* Strict UI cleanup styles: keep ONLY the bottom-right Aladin watermark */}
      <style jsx global>{`
        #aladin-sky-bg .aladin-location,
        #aladin-sky-bg .aladin-reticle,
        #aladin-sky-bg .aladin-view-control,
        #aladin-sky-bg .aladin-settings-panel,
        #aladin-sky-bg .aladin-context-menu,
        #aladin-sky-bg .aladin-popup {
          display: none !important;
        }

        /* Watermark: leave logo and link intact at bottom right per CDS policy */
        #aladin-sky-bg .aladin-logo {
          display: block !important;
          pointer-events: auto !important;
          opacity: 0.6;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.8));
          transition: opacity 0.2s ease;
          position: absolute;
          bottom: 12px;
          right: 12px;
          z-index: 10;
        }
        #aladin-sky-bg .aladin-logo:hover {
          opacity: 1;
        }
      `}</style>
    </div>
  );
}

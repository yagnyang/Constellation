import type * as THREE from "three";

export type StarRecord = {
  hip: number | null;
  proper: string | null;
  bayer: string | null;
  con: string | null;
  x: number;
  y: number;
  z: number;
  ra: number;
  dec: number;
  mag: number;
  ci: number | null;
  color: string;
  size: number;
  dist_ly: number | null;
  spect: string | null;
};

export type ConstellationSegment = [number, number, number, number, number, number];

export type ConstellationLines = Record<string, ConstellationSegment[]>;

export type TourConfig = {
  label: string;
  intervalMs: number;
};

export type ConstellationMapProps = {
  stars: StarRecord[];
  constellationLines: ConstellationLines;
  className?: string;
};

export type ConstellationModuleProps = {
  className?: string;
};

export type ConstellationFocusMeta = {
  p10: number;
  p50: number;
  p90: number;
  dir: THREE.Vector3;
};

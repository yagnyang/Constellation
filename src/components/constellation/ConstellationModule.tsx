"use client";

import { ConstellationMap } from "./ConstellationMap";
import constellationLinesData from "./data/constellation_lines.json";
import starsData from "./data/stars.json";
import type { ConstellationLines, ConstellationModuleProps, StarRecord } from "./types";

export function ConstellationModule({ className }: ConstellationModuleProps) {
  return (
    <ConstellationMap
      className={className}
      constellationLines={constellationLinesData as unknown as ConstellationLines}
      stars={starsData as unknown as StarRecord[]}
    />
  );
}

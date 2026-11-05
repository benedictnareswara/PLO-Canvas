"use client";

import { PloRadar } from "@/components/charts/PloRadarLazy";
import type { RadarSeries } from "@/components/charts/PloRadar";
import type { PloInfo } from "@/lib/obe/types";

/** Radar at a fixed print size (about 15 cm wide), with its table omitted (the report has one). */
export function ReportRadar({ plos, threshold, series }: { plos: PloInfo[]; threshold: number; series: RadarSeries[] }) {
  return (
    <div className="mx-auto w-[150mm] max-w-full break-inside-avoid">
      <PloRadar plos={plos} threshold={threshold} series={series} height={340} showTable={false} />
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui";
import type { PloRadar as PloRadarType } from "./PloRadar";

/**
 * The radar with Recharts loaded on demand: pages render without the chart bundle and show a
 * placeholder of the same height until it arrives (charts are client-only anyway).
 */
export const PloRadar = dynamic(() => import("./PloRadar").then((m) => m.PloRadar), {
  ssr: false,
  loading: () => (
    <div className="flex h-[400px] items-center justify-center" aria-hidden>
      <Skeleton className="aspect-square h-4/5 rounded-full opacity-60" />
    </div>
  ),
}) as typeof PloRadarType;

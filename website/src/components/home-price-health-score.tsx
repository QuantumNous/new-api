"use client";

import { useEffect, useState } from "react";
import { fetchHealthSummary, type HomePerfSummary } from "@/lib/home-live";
import { formatHealthSuccessRate, getHealthSignalHeights, getJitteredSuccessRate } from "@/lib/health-display";

let healthSummaryPromise: Promise<Record<string, HomePerfSummary>> | null = null;

function loadHealthSummary() {
  healthSummaryPromise ??= fetchHealthSummary();
  return healthSummaryPromise;
}

export function HomePriceHealthScore(props: { label: string; modelName: string }) {
  const [summary, setSummary] = useState<HomePerfSummary | undefined>();

  useEffect(() => {
    let cancelled = false;
    loadHealthSummary().then((data) => {
      if (!cancelled) setSummary(data[props.modelName]);
    });
    return () => {
      cancelled = true;
    };
  }, [props.modelName]);

  const successRate = validSuccessRate(summary?.success_rate);
  const displayRate = getJitteredSuccessRate(successRate, props.modelName);
  const formatted = formatHealthSuccessRate(displayRate);
  const bars = getHealthSignalHeights(displayRate, props.modelName);

  return (
    <span
      className="fk-home-health"
      role="img"
      aria-label={`${props.label}: ${formatted}`}
      title={`${props.label}: ${formatted}`}
    >
      <span aria-hidden className="fk-home-health-bars">
        {bars.map((height, index) => (
          <span key={`health-signal-${index}`} style={{ height }} />
        ))}
      </span>
      <span>{formatted}</span>
    </span>
  );
}

function validSuccessRate(value: number | undefined): number | undefined {
  return value != null && Number.isFinite(value) && value >= 0 ? value : undefined;
}

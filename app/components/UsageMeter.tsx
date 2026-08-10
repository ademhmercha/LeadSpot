"use client";

import { useEffect, useState } from "react";
import type { UsageInfo } from "@/lib/types";

export default function UsageMeter() {
  const [usage, setUsage] = useState<UsageInfo | null>(null);

  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then((data) => setUsage(data.usage))
      .catch(() => {});
  }, []);

  if (!usage) return null;

  const pct = usage.limit > 0 ? Math.min(100, Math.round((usage.searchCount / usage.limit) * 100)) : 0;
  const isNearLimit = usage.remaining <= Math.max(1, Math.ceil(usage.limit * 0.2));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-medium text-gray-700">Quota de recherches ({usage.period})</span>
        <span className={isNearLimit ? "font-semibold text-amber-600" : "text-gray-500"}>
          {usage.searchCount} / {usage.limit}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={`h-full rounded-full ${isNearLimit ? "bg-amber-500" : "bg-brand-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { rangeForPeriod, previousRange, type PeriodKey } from "@/lib/dates";
import type { AccountLite } from "@/components/FilterBar";
import type { SummaryData } from "@/app/api/summary/route";

export function useAccounts() {
  const [accounts, setAccounts] = useState<AccountLite[]>([]);
  const reload = useCallback(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts ?? []))
      .catch(() => {});
  }, []);
  useEffect(reload, [reload]);
  return { accounts, reload };
}

export function useSummary(
  period: PeriodKey,
  accountId: string | "all",
  customFrom: string,
  customTo: string
) {
  const [current, setCurrent] = useState<SummaryData | null>(null);
  const [previous, setPrevious] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams();
    if (period === "custom") {
      if (customFrom) params.set("from", customFrom);
      if (customTo) params.set("to", customTo);
    } else {
      const range = rangeForPeriod(period);
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);
      const prev = previousRange(period);
      if (prev?.from && prev?.to) {
        params.set("prevFrom", prev.from);
        params.set("prevTo", prev.to);
      }
    }
    if (accountId !== "all") params.set("accountId", accountId);

    // 再取得中も前のデータを表示したままにする（loadingの同期更新はしない）
    fetch(`/api/summary?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setCurrent(d.current ?? null);
        setPrevious(d.previous ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period, accountId, customFrom, customTo, reloadKey]);

  const refresh = useCallback(() => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }, []);
  return { current, previous, loading, refresh };
}

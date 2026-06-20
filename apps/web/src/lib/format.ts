/** Stage clock — seconds to "S.SS" or "M:SS.SS". */
export function fmtTime(s: number | null | undefined): string {
  if (s == null || Number.isNaN(s)) return "—";
  const sign = s < 0 ? "-" : "";
  const abs = Math.abs(s);
  if (abs < 60) return `${sign}${abs.toFixed(2)}`;
  const m = Math.floor(abs / 60);
  const rem = (abs % 60).toFixed(2).padStart(5, "0");
  return `${sign}${m}:${rem}`;
}

/** Split time — always two decimals, no minutes. */
export function fmtSplit(s: number | null | undefined): string {
  if (s == null || Number.isNaN(s)) return "—";
  return s.toFixed(2);
}

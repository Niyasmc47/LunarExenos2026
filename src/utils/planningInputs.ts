export function utcInputValue(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 19) : '';
}
export function utcFromInput(value: string): string {
  return value ? `${value}Z` : '';
}
export function estimateWindows(start: string, end: string, days: number, step: number): number {
  const span = (Date.parse(end) - Date.parse(start)) / 3600000;
  if (![span, days, step].every(Number.isFinite) || days <= 0 || step <= 0 || span < days * 24) return 0;
  return Math.floor((span - days * 24) / step) + 1;
}

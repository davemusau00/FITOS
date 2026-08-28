/** Returns an ISO calendar date in the operator's configured browser timezone. */
export function todayDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function localDayBounds(date: string): { from: string; to: string } {
  const [year, month, day] = date.split("-").map(Number);
  const start = new Date(year!, month! - 1, day!);
  const end = new Date(year!, month! - 1, day! + 1);
  return { from: start.toISOString(), to: new Date(end.getTime() - 1).toISOString() };
}

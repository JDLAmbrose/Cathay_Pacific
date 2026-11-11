const HKT_TIME_ZONE = "Asia/Hong_Kong";

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function hktDateParts(ms: number): { year: number; month: number; day: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: HKT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(new Date(ms));
  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: Number(pick("year")),
    month: Number(pick("month")),
    day: Number(pick("day")),
    weekday: WEEKDAY_INDEX[pick("weekday")] ?? 0,
  };
}

export function hktDateIso(ms: number): string {
  const { year, month, day } = hktDateParts(ms);
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function hktDayStartMs(ms: number): number {
  return Date.parse(`${hktDateIso(ms)}T00:00:00+08:00`);
}

/** Monday 00:00 in Asia/Hong_Kong for the local date of `ms`. */
export function hktWeekStartMs(ms: number): number {
  const { weekday } = hktDateParts(ms);
  return hktDayStartMs(ms) - weekday * 86_400_000;
}

export function addIsoDays(isoDate: string, days: number): string {
  return hktDateIso(Date.parse(`${isoDate}T00:00:00+08:00`) + days * 86_400_000);
}

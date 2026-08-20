import type {
  CreateScheduleOccurrenceRequest,
  CreateScheduleTemplateRequest,
  ScheduleTemplateResponse
} from "@fitos/contracts";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

type RecurrenceSource = Pick<
  CreateScheduleTemplateRequest,
  | "branchId"
  | "serviceId"
  | "trainerUserId"
  | "roomId"
  | "timezone"
  | "daysOfWeek"
  | "localStartTime"
  | "durationMinutes"
  | "capacity"
  | "effectiveStartDate"
  | "effectiveEndDate"
>;

export function assertIanaTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
  } catch {
    throw new Error("Invalid IANA timezone.");
  }
}

export function assertLocalDate(value: string): void {
  if (!DATE_PATTERN.test(value) || formatDate(parseDate(value)) !== value) {
    throw new Error("Invalid local date.");
  }
}

export function defaultMaterializationDate(startDate: string): string {
  return addDays(startDate, 83);
}

export function clampMaterializationDate(
  requestedThrough: string,
  effectiveEndDate?: string | null
): string {
  return effectiveEndDate && effectiveEndDate < requestedThrough
    ? effectiveEndDate
    : requestedThrough;
}

export function assertBoundedWindow(fromDate: string, throughDate: string): void {
  assertLocalDate(fromDate);
  assertLocalDate(throughDate);
  if (throughDate < fromDate) throw new Error("Materialization end must not precede its start.");
  const days = Math.round(
    (parseDate(throughDate).getTime() - parseDate(fromDate).getTime()) / 86_400_000
  );
  if (days > 366) throw new Error("Materialization is limited to 367 inclusive days.");
}

export function nextDate(date: string): string {
  return addDays(date, 1);
}

export function generateWeeklyOccurrences(
  template: RecurrenceSource | ScheduleTemplateResponse,
  fromDate: string,
  throughDate: string
): CreateScheduleOccurrenceRequest[] {
  assertIanaTimezone(template.timezone);
  assertLocalDate(fromDate);
  assertLocalDate(throughDate);
  if (!TIME_PATTERN.test(template.localStartTime)) throw new Error("Invalid local start time.");

  const weekdaySet = new Set(template.daysOfWeek);
  const occurrences: CreateScheduleOccurrenceRequest[] = [];
  for (let cursor = fromDate; cursor <= throughDate; cursor = addDays(cursor, 1)) {
    if (!weekdaySet.has(parseDate(cursor).getUTCDay())) continue;
    const startsAt = zonedLocalDateTimeToUtc(cursor, template.localStartTime, template.timezone);
    occurrences.push({
      branchId: template.branchId,
      serviceId: template.serviceId,
      trainerUserId: template.trainerUserId ?? null,
      roomId: template.roomId ?? null,
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() + template.durationMinutes * 60_000).toISOString(),
      capacity: template.capacity
    });
  }
  return occurrences;
}

function zonedLocalDateTimeToUtc(date: string, time: string, timezone: string): Date {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const [hour, minute] = time.split(":").map(Number) as [number, number];
  const desiredWallClock = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = new Date(desiredWallClock);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const values: Record<string, number> = Object.fromEntries(
      formatter
        .formatToParts(candidate)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)])
    );
    const actualWallClock = Date.UTC(
      values.year ?? 0,
      (values.month ?? 1) - 1,
      values.day ?? 1,
      values.hour ?? 0,
      values.minute ?? 0,
      values.second ?? 0
    );
    const difference = desiredWallClock - actualWallClock;
    if (difference === 0) return candidate;
    candidate = new Date(candidate.getTime() + difference);
  }

  throw new Error("The local date and time does not exist in the selected timezone.");
}

function parseDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(value: string, days: number): string {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

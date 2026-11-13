/**
 * Weekly class schedules derived from `course_sections.timetable`.
 *
 * A section stores its timetable as free text an administrator typed, e.g.
 * "WED 12:00 pm - 02:50 pm" or "TUE 09:00 - 10:30". The calendar needs actual
 * dates, so this module parses that text into a weekday plus a time range and
 * expands it into one event per week across the visible month.
 *
 * Anything it cannot understand is returned as `null` rather than guessed: a
 * silently mis-parsed schedule would put a class on the wrong day, which is
 * worse than not showing it.
 */

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type ParsedSchedule = {
  /** 0 = Sunday, matching Date#getDay(). */
  weekday: Weekday
  /** 24h decimal hours, e.g. 12.0 and 14.833. Null when the text had no time. */
  startHour: number | null
  endHour: number | null
  /** The timetable text as typed, for display. */
  raw: string
}

const WEEKDAY_PATTERNS: Array<{ day: Weekday; pattern: RegExp }> = [
  // Longest first so "THU" is not matched by "TU".
  { day: 1, pattern: /\b(mon|monday)\b/i },
  { day: 2, pattern: /\b(tue|tues|tuesday)\b/i },
  { day: 3, pattern: /\b(wed|weds|wednesday)\b/i },
  { day: 4, pattern: /\b(thu|thur|thurs|thursday)\b/i },
  { day: 5, pattern: /\b(fri|friday)\b/i },
  { day: 6, pattern: /\b(sat|saturday)\b/i },
  { day: 0, pattern: /\b(sun|sunday)\b/i },
]

/** "12:00 pm" / "14:30" / "9.15" -> decimal hours. */
function parseTime(token: string): number | null {
  const match = token.match(/^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/i)
  if (!match) return null

  let hour = Number(match[1])
  const minute = Number(match[2])
  const meridiem = match[3]?.toLowerCase()

  if (minute > 59) return null
  if (meridiem) {
    if (hour < 1 || hour > 12) return null
    if (meridiem === "pm" && hour !== 12) hour += 12
    if (meridiem === "am" && hour === 12) hour = 0
  }
  if (hour > 23) return null

  return hour + minute / 60
}

/**
 * Parse a timetable string.
 *
 * Returns null when no weekday is present — the caller then shows nothing for
 * that section instead of inventing a day.
 */
export function parseTimetable(raw: string | null | undefined): ParsedSchedule | null {
  const text = (raw ?? "").trim()
  if (!text) return null

  const weekdayEntry = WEEKDAY_PATTERNS.find((entry) => entry.pattern.test(text))
  if (!weekdayEntry) return null

  // Find every time-looking token, in order. The first two are the range.
  const timeMatches = text.match(/\d{1,2}[:.]\d{2}\s*(?:am|pm)?/gi) ?? []
  const startHour = timeMatches[0] ? parseTime(timeMatches[0]) : null
  let endHour = timeMatches[1] ? parseTime(timeMatches[1]) : null

  // "12:00 - 2:50 pm": the meridiem is written once, at the end. Apply it to the
  // start when the start has none and would otherwise be before the end.
  if (startHour !== null && endHour !== null && endHour < startHour) {
    const suffixHasPm = /pm/i.test(timeMatches[1] ?? "") || /pm/i.test(timeMatches[0] ?? "")
    if (suffixHasPm && startHour < 12) endHour = null // ambiguous; show without times
  }

  return {
    weekday: weekdayEntry.day,
    startHour,
    endHour,
    raw: text,
  }
}

/** "12:00 pm – 02:50 pm", or the raw text when the times are unusable. */
export function formatScheduleTime(schedule: ParsedSchedule): string {
  if (schedule.startHour === null) return schedule.raw

  const label = (value: number) => {
    const hour24 = Math.floor(value)
    const minute = Math.round((value - hour24) * 60)
    const meridiem = hour24 >= 12 ? "pm" : "am"
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
    return `${hour12}:${String(minute).padStart(2, "0")} ${meridiem}`
  }

  return schedule.endHour === null
    ? `${label(schedule.startHour)}`
    : `${label(schedule.startHour)} – ${label(schedule.endHour)}`
}

/**
 * Every date in a month that falls on `weekday`.
 *
 * Returns local-date keys (`YYYY-MM-DD`) so they line up with the keys the
 * calendar buckets its items by.
 */
export function weeklyDatesInMonth(year: number, month: number, weekday: Weekday): string[] {
  const dates: string[] = []
  const cursor = new Date(year, month - 1, 1)
  // Advance to the first matching weekday within this month.
  while (cursor.getMonth() === month - 1 && cursor.getDay() !== weekday) {
    cursor.setDate(cursor.getDate() + 1)
  }
  while (cursor.getMonth() === month - 1) {
    const y = cursor.getFullYear()
    const m = String(cursor.getMonth() + 1).padStart(2, "0")
    const d = String(cursor.getDate()).padStart(2, "0")
    dates.push(`${y}-${m}-${d}`)
    cursor.setDate(cursor.getDate() + 7)
  }
  return dates
}

export type ScheduledSession = {
  courseId: string
  courseCode: string
  courseTitle: string
  sectionNo: string
  sectionType: string
  room: string | null
  schedule: ParsedSchedule
}

/**
 * Turn scheduled sessions into one calendar item per week within the month.
 *
 * Each occurrence is a separate item with a date-keyed id so the calendar can
 * bucket it; a single recurring item would have to be re-expanded per month.
 */
export function sessionsToMonthItems(
  sessions: ScheduledSession[],
  year: number,
  month: number,
): Array<{
  id: string
  kind: "academic"
  title: string
  metaLabel: string
  date: string
  time?: string
  course?: string
  location?: string
}> {
  const items: ReturnType<typeof sessionsToMonthItems> = []

  for (const session of sessions) {
    const dates = weeklyDatesInMonth(year, month, session.schedule.weekday)
    for (const date of dates) {
      items.push({
        id: `class-${session.courseId}-${session.sectionNo}-${date}`,
        kind: "academic",
        title: `${session.courseCode} — ${session.courseTitle}`,
        metaLabel: `Section ${session.sectionNo}${session.sectionType ? ` · ${session.sectionType}` : ""}`,
        date,
        time: formatScheduleTime(session.schedule),
        course: session.courseCode,
        location: session.room ?? undefined,
      })
    }
  }

  return items
}

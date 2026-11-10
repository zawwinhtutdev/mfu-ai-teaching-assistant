export type AcademicTerm = "spring" | "recess" | "fall"

export interface AcademicMilestone {
  id: string
  month: number // 1-12
  day: number // representative day of month for daily timeline view
  weekLabel: string
  title: string
  term: AcademicTerm
}

export interface AcademicMonthMeta {
  month: number // 1-12
  padded: string // "04", "05", ...
  name: string
  term: AcademicTerm
}

/**
 * Academic year order from April (04) through March (03),
 * matching the vertical academic calendar timeline.
 */
export const ACADEMIC_YEAR_MONTHS: AcademicMonthMeta[] = [
  { month: 4, padded: "04", name: "April", term: "spring" },
  { month: 5, padded: "05", name: "May", term: "spring" },
  { month: 6, padded: "06", name: "June", term: "spring" },
  { month: 7, padded: "07", name: "July", term: "spring" },
  { month: 8, padded: "08", name: "August", term: "recess" },
  { month: 9, padded: "09", name: "September", term: "fall" },
  { month: 10, padded: "10", name: "October", term: "fall" },
  { month: 11, padded: "11", name: "November", term: "fall" },
  { month: 12, padded: "12", name: "December", term: "fall" },
  { month: 1, padded: "01", name: "January", term: "fall" },
  { month: 2, padded: "02", name: "February", term: "fall" },
  { month: 3, padded: "03", name: "March", term: "recess" },
]

export const ACADEMIC_MILESTONES: AcademicMilestone[] = [
  {
    id: "acad-apr-1",
    month: 4,
    day: 2,
    weekLabel: "1st week",
    title: "Opening ceremonies and orientations",
    term: "spring",
  },
  {
    id: "acad-apr-2",
    month: 4,
    day: 9,
    weekLabel: "2nd week",
    title: "Spring classes begin",
    term: "spring",
  },
  {
    id: "acad-jul-1",
    month: 7,
    day: 16,
    weekLabel: "3rd week",
    title: "Spring classes end",
    term: "spring",
  },
  {
    id: "acad-jul-2",
    month: 7,
    day: 23,
    weekLabel: "4th week",
    title: "Spring final examination period",
    term: "spring",
  },
  {
    id: "acad-aug-1",
    month: 8,
    day: 1,
    weekLabel: "Summer recess",
    title: "Summer recess starts",
    term: "recess",
  },
  {
    id: "acad-sep-1",
    month: 9,
    day: 4,
    weekLabel: "1st & 2nd weeks",
    title: "Opening ceremonies and orientations",
    term: "fall",
  },
  {
    id: "acad-sep-2",
    month: 9,
    day: 16,
    weekLabel: "3rd week",
    title: "Fall classes begin",
    term: "fall",
  },
  {
    id: "acad-nov-1",
    month: 11,
    day: 3,
    weekLabel: "1st week",
    title: "Fall Festival (no classes)",
    term: "fall",
  },
  {
    id: "acad-dec-1",
    month: 12,
    day: 23,
    weekLabel: "4th week",
    title: "Winter recess starts",
    term: "fall",
  },
  {
    id: "acad-jan-1",
    month: 1,
    day: 4,
    weekLabel: "1st week",
    title: "Winter recess ends",
    term: "fall",
  },
  {
    id: "acad-jan-2",
    month: 1,
    day: 16,
    weekLabel: "3rd week",
    title: "Fall classes end",
    term: "fall",
  },
  {
    id: "acad-jan-3",
    month: 1,
    day: 23,
    weekLabel: "4th week",
    title: "Fall final examination period begins",
    term: "fall",
  },
  {
    id: "acad-feb-1",
    month: 2,
    day: 3,
    weekLabel: "1st week",
    title: "Fall Final examination period ends",
    term: "fall",
  },
  {
    id: "acad-mar-1",
    month: 3,
    day: 17,
    weekLabel: "3rd week",
    title: "Commencement ceremonies",
    term: "recess",
  },
]

export function getTermForMonth(month1To12: number): AcademicTerm {
  if (month1To12 >= 4 && month1To12 <= 7) return "spring"
  if (month1To12 === 8 || month1To12 === 3) return "recess"
  return "fall"
}

export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function addDaysToLocalKey(base: Date, offsetDays: number): string {
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offsetDays)
  return toLocalDateKey(next)
}

export function getMilestonesForMonth(year: number, month1To12: number) {
  return ACADEMIC_MILESTONES.filter((m) => m.month === month1To12).map((m) => ({
    ...m,
    date: `${year}-${String(m.month).padStart(2, "0")}-${String(m.day).padStart(2, "0")}`,
  }))
}

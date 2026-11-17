"use client"

import { useMemo, useRef, useState } from "react"
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  Crosshair,
  Plus,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { Course } from "@/lib/types"
import {
  ACADEMIC_MILESTONES,
  ACADEMIC_YEAR_MONTHS,
  getMilestonesForMonth,
  getTermForMonth,
  toLocalDateKey,
  type AcademicTerm,
} from "@/lib/academic-calendar"

export type TimelineTaskKind = "task" | "reminder" | "academic" | "announcement" | "event"

export interface TimelineTaskItem {
  id: string
  sourceId?: string
  kind: TimelineTaskKind
  title: string
  metaLabel: string
  description?: string
  course?: string
  date: string // YYYY-MM-DD local date
  time?: string
  priority?: "low" | "medium" | "high"
  completed?: boolean
  location?: string
  canToggle?: boolean
  canDelete?: boolean
}

export interface NewTimelineTaskPayload {
  title: string
  dueDate: string
  courseId?: string
  priority: "low" | "medium" | "high"
  description?: string
}

interface TimelineCalendarProps {
  items: TimelineTaskItem[]
  courses: Course[]
  isLoading?: boolean
  accentColor?: string // e.g. "#2563eb" for student, "#a81d24" for teacher
  onAddTask?: (payload: NewTimelineTaskPayload) => Promise<void>
  onToggleTask?: (item: TimelineTaskItem) => Promise<void>
  onDeleteTask?: (item: TimelineTaskItem) => Promise<void>
}

type ViewMode = "month" | "year"
type KindFilter = "all" | "tasks" | "academic"

const TERM_COLORS: Record<
  AcademicTerm | "past" | "today",
  { spine: string; text: string; metaText: string; border: string }
> = {
  spring: {
    spine: "#8cc63f",
    text: "#6fa828",
    metaText: "#639a1d",
    border: "#8cc63f",
  },
  fall: {
    spine: "#f5a623",
    text: "#d98709",
    metaText: "#c97a06",
    border: "#f5a623",
  },
  recess: {
    spine: "#7a7d80",
    text: "#64676a",
    metaText: "#5f6266",
    border: "#7a7d80",
  },
  past: {
    spine: "#9aa0a6",
    text: "#7a8088",
    metaText: "#6c727a",
    border: "#9aa0a6",
  },
  today: {
    spine: "#2563eb",
    text: "#1d4ed8",
    metaText: "#1d4ed8",
    border: "#2563eb",
  },
}

function getItemMetaColor(item: TimelineTaskItem, fallbackTerm: AcademicTerm): string {
  if (item.completed) return "#6b7280"
  if (item.kind === "academic") return TERM_COLORS[fallbackTerm].metaText
  if (item.kind === "announcement") return "#0284c7"
  if (item.priority === "high") return "#dc2626"
  if (item.kind === "reminder") return "#2563eb"
  if (item.kind === "task") return "#2563eb"
  return TERM_COLORS[fallbackTerm].metaText
}

export function TimelineCalendar({
  items,
  courses,
  isLoading = false,
  accentColor = "#2563eb",
  onAddTask,
  onToggleTask,
  onDeleteTask,
}: TimelineCalendarProps) {
  const today = useMemo(() => new Date(), [])
  const todayKey = useMemo(() => toLocalDateKey(today), [today])

  const [viewMode, setViewMode] = useState<ViewMode>("month")
  const [kindFilter, setKindFilter] = useState<KindFilter>("all")
  const [onlyActiveDays, setOnlyActiveDays] = useState(false)
  const [cursorYear, setCursorYear] = useState(today.getFullYear())
  const [cursorMonth, setCursorMonth] = useState(today.getMonth() + 1) // 1-12

  const [addOpen, setAddOpen] = useState(false)
  const [taskTitle, setTaskTitle] = useState("")
  const [taskDate, setTaskDate] = useState(todayKey)
  const [taskCourseId, setTaskCourseId] = useState<string>("none")
  const [taskPriority, setTaskPriority] = useState<"low" | "medium" | "high">("medium")
  const [taskDescription, setTaskDescription] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const todayRowRef = useRef<HTMLDivElement | null>(null)

  const currentMonthTerm = getTermForMonth(cursorMonth)
  const currentMonthLabel = useMemo(
    () =>
      new Date(cursorYear, cursorMonth - 1, 1).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
    [cursorYear, cursorMonth],
  )

  const academicMonthItems = useMemo<TimelineTaskItem[]>(() => {
    return getMilestonesForMonth(cursorYear, cursorMonth).map((m) => ({
      id: `${m.id}-${cursorYear}`,
      kind: "academic",
      title: m.title,
      metaLabel: m.weekLabel,
      date: m.date,
    }))
  }, [cursorYear, cursorMonth])

  const allMergedMonthItems = useMemo(() => {
    const combined = [...items, ...academicMonthItems]
    return combined.filter((item) => {
      if (kindFilter === "academic") return item.kind === "academic"
      if (kindFilter === "tasks") return item.kind !== "academic"
      return true
    })
  }, [items, academicMonthItems, kindFilter])

  const itemsByDate = useMemo(() => {
    const map = new Map<string, TimelineTaskItem[]>()
    for (const item of allMergedMonthItems) {
      const list = map.get(item.date) || []
      list.push(item)
      map.set(item.date, list)
    }
    return map
  }, [allMergedMonthItems])

  const todayItems = useMemo(() => {
    return items.filter((item) => item.date === todayKey)
  }, [items, todayKey])

  const monthDays = useMemo(() => {
    const totalDays = new Date(cursorYear, cursorMonth, 0).getDate()
    const rows: Array<{
      day: number
      padded: string
      dateKey: string
      weekdayShort: string
      weekdayLong: string
      isToday: boolean
      isPast: boolean
      isWeekend: boolean
      spineColor: string
      labelColor: string
      dayItems: TimelineTaskItem[]
    }> = []

    for (let d = 1; d <= totalDays; d++) {
      const dt = new Date(cursorYear, cursorMonth - 1, d)
      const dateKey = toLocalDateKey(dt)
      const isToday = dateKey === todayKey
      const isPast = dateKey < todayKey
      const weekdayIdx = dt.getDay()
      const isWeekend = weekdayIdx === 0 || weekdayIdx === 6

      const palette = isToday
        ? { spine: accentColor, text: accentColor, metaText: accentColor, border: accentColor }
        : isPast
          ? TERM_COLORS.past
          : TERM_COLORS[currentMonthTerm]

      rows.push({
        day: d,
        padded: String(d).padStart(2, "0"),
        dateKey,
        weekdayShort: dt.toLocaleDateString(undefined, { weekday: "short" }),
        weekdayLong: dt.toLocaleDateString(undefined, { weekday: "long" }),
        isToday,
        isPast,
        isWeekend,
        spineColor: palette.spine,
        labelColor: palette.text,
        dayItems: itemsByDate.get(dateKey) || [],
      })
    }

    if (onlyActiveDays) {
      return rows.filter((r) => r.isToday || r.dayItems.length > 0)
    }
    return rows
  }, [cursorYear, cursorMonth, todayKey, accentColor, currentMonthTerm, itemsByDate, onlyActiveDays])

  const academicYearRows = useMemo(() => {
    const todayMonth = today.getMonth() + 1
    return ACADEMIC_YEAR_MONTHS.map((meta) => {
      const milestones = ACADEMIC_MILESTONES.filter((m) => m.month === meta.month).map((m) => ({
        id: m.id,
        kind: "academic" as const,
        title: m.title,
        metaLabel: m.weekLabel,
        date: `${cursorYear}-${meta.padded}-${String(m.day).padStart(2, "0")}`,
      }))

      const userItemsForMonth = items.filter((item) => {
        const parts = item.date.split("-")
        return Number(parts[1]) === meta.month
      })

      const rowItems =
        kindFilter === "academic"
          ? milestones
          : kindFilter === "tasks"
            ? userItemsForMonth
            : [...milestones, ...userItemsForMonth]

      const palette = TERM_COLORS[meta.term]
      return {
        ...meta,
        isCurrentMonth: meta.month === todayMonth,
        spineColor: palette.spine,
        labelColor: palette.text,
        rowItems,
      }
    })
  }, [today, cursorYear, items, kindFilter])

  const handlePrevMonth = () => {
    if (cursorMonth === 1) {
      setCursorYear((y) => y - 1)
      setCursorMonth(12)
    } else {
      setCursorMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (cursorMonth === 12) {
      setCursorYear((y) => y + 1)
      setCursorMonth(1)
    } else {
      setCursorMonth((m) => m + 1)
    }
  }

  const jumpToToday = () => {
    setViewMode("month")
    setCursorYear(today.getFullYear())
    setCursorMonth(today.getMonth() + 1)
    setTimeout(() => {
      todayRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 60)
  }

  const openAddDialog = (dateKey?: string) => {
    setTaskDate(dateKey || todayKey)
    setTaskTitle("")
    setTaskDescription("")
    setTaskCourseId("none")
    setTaskPriority("medium")
    setSaveError(null)
    setAddOpen(true)
  }

  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!taskTitle.trim() || !onAddTask) return
    setIsSaving(true)
    setSaveError(null)
    try {
      await onAddTask({
        title: taskTitle.trim(),
        dueDate: taskDate,
        courseId: taskCourseId === "none" ? undefined : taskCourseId,
        priority: taskPriority,
        description: taskDescription.trim() || undefined,
      })
      setAddOpen(false)
    } catch (err: any) {
      setSaveError(err?.message || "Failed to save task")
    } finally {
      setIsSaving(false)
    }
  }

  const todayFormatted = today.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })

  return (
    <div className="space-y-4">
      {/* Today Highlight Bar */}
      <div className="rounded-xl border border-[#e5e7eb] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold text-white shadow-sm ring-4"
            style={{
              backgroundColor: accentColor,
              boxShadow: `0 0 0 4px ${accentColor}22`,
            }}
            aria-label={`Today is ${today.getDate()}`}
          >
            {String(today.getDate()).padStart(2, "0")}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                style={{ backgroundColor: accentColor }}
              >
                Today
              </span>
              <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-zinc-100 truncate">
                {todayFormatted}
              </h2>
            </div>
            {todayItems.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                No personal tasks scheduled for today yet — click Add Task to plan your day.
              </p>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                {todayItems.slice(0, 4).map((t) => (
                  <span
                    key={`today-chip-${t.id}`}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md bg-[#f3f4f6] dark:bg-zinc-800 px-2 py-0.5 text-xs font-medium text-gray-800 dark:text-zinc-200",
                      t.completed && "line-through opacity-60",
                    )}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: getItemMetaColor(t, currentMonthTerm) }}
                    />
                    <span className="truncate max-w-[180px]">{t.title}</span>
                  </span>
                ))}
                {todayItems.length > 4 && (
                  <span className="text-xs text-gray-500 dark:text-zinc-400">
                    +{todayItems.length - 4} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={jumpToToday} className="gap-1.5 h-8 text-xs">
            <Crosshair className="h-3.5 w-3.5" />
            Jump to Today
          </Button>
          {onAddTask && (
            <Button
              type="button"
              size="sm"
              onClick={() => openAddDialog(todayKey)}
              className="gap-1.5 h-8 text-xs text-white"
              style={{ backgroundColor: accentColor }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Task
            </Button>
          )}
        </div>
      </div>

      {/* Main Timeline Card */}
      <div className="rounded-xl border border-[#e5e7eb] dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        {/* Controls Header */}
        <div className="px-4 py-3 sm:px-5 border-b border-[#e5e7eb] dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 bg-[#fafbfc] dark:bg-zinc-900/80">
          <div className="flex items-center gap-2 flex-wrap">
            {/* View mode toggle */}
            <div className="inline-flex rounded-full bg-[#eef0f4] dark:bg-zinc-800 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("month")}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-semibold transition-colors",
                  viewMode === "month"
                    ? "bg-white dark:bg-zinc-950 text-gray-900 dark:text-white shadow-xs"
                    : "text-gray-600 dark:text-zinc-400 hover:text-gray-900",
                )}
              >
                Month Timeline
              </button>
              <button
                type="button"
                onClick={() => setViewMode("year")}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-semibold transition-colors",
                  viewMode === "year"
                    ? "bg-white dark:bg-zinc-950 text-gray-900 dark:text-white shadow-xs"
                    : "text-gray-600 dark:text-zinc-400 hover:text-gray-900",
                )}
              >
                Academic Year
              </button>
            </div>

            {viewMode === "month" && (
              <div className="flex items-center gap-1 ml-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handlePrevMonth}
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100 min-w-[128px] text-center">
                  {currentMonthLabel}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleNextMonth}
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Right filters + Legend */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="hidden md:flex items-center gap-3 mr-2 text-[11px] font-medium text-gray-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border-2 border-[#8cc63f] bg-white inline-block" />
                Spring
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border-2 border-[#f5a623] bg-white inline-block" />
                Fall
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border-2 border-[#7a7d80] bg-white inline-block" />
                Recess / Past
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full border-2 bg-white inline-block"
                  style={{ borderColor: accentColor }}
                />
                Today
              </span>
            </div>

            <div className="inline-flex rounded-full bg-[#eef0f4] dark:bg-zinc-800 p-0.5">
              {(
                [
                  { id: "all", label: "All" },
                  { id: "tasks", label: "My Tasks" },
                  { id: "academic", label: "Academic" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setKindFilter(opt.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                    kindFilter === opt.id
                      ? "bg-white dark:bg-zinc-950 text-gray-900 dark:text-white shadow-xs"
                      : "text-gray-600 dark:text-zinc-400 hover:text-gray-900",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {viewMode === "month" && (
              <button
                type="button"
                onClick={() => setOnlyActiveDays((v) => !v)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                  onlyActiveDays
                    ? "bg-gray-900 text-white border-gray-900 dark:bg-zinc-100 dark:text-zinc-900"
                    : "bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-400 border-[#e5e7eb] dark:border-zinc-700 hover:text-gray-900",
                )}
              >
                {onlyActiveDays ? "Showing Active Days" : "Active Days Only"}
              </button>
            )}
          </div>
        </div>

        {/* Timeline Body */}
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-500 dark:text-zinc-400">Loading calendar timeline...</div>
        ) : viewMode === "month" ? (
          <div className="divide-y divide-[#eaecf0] dark:divide-zinc-800">
            {monthDays.map((row, idx) => {
              const isFirst = idx === 0
              const isLast = idx === monthDays.length - 1
              const prevRow = idx > 0 ? monthDays[idx - 1] : null
              const nextRow = idx < monthDays.length - 1 ? monthDays[idx + 1] : null

              const topSpineColor = prevRow ? (row.isToday ? prevRow.spineColor : row.spineColor) : row.spineColor
              const bottomSpineColor = nextRow
                ? row.isToday
                  ? nextRow.spineColor
                  : row.spineColor
                : row.spineColor

              return (
                <div
                  key={row.dateKey}
                  ref={row.isToday ? todayRowRef : undefined}
                  className={cn(
                    "group/row flex items-stretch transition-colors",
                    row.isToday
                      ? "bg-blue-50/55 dark:bg-blue-950/20"
                      : idx % 2 === 0
                        ? "bg-white dark:bg-zinc-900"
                        : "bg-[#fcfcfd] dark:bg-zinc-900/60",
                  )}
                >
                  {/* Left Timeline Rail: [Number] [Spine + Circle] [Day label] */}
                  <div
                    className={cn(
                      "w-[148px] sm:w-[250px] shrink-0 flex items-center px-2 sm:px-4 border-r border-[#eaecf0] dark:border-zinc-800 select-none",
                      row.isToday
                        ? "bg-blue-50/90 dark:bg-blue-950/35"
                        : "bg-[#f3f4f6] dark:bg-zinc-900/90",
                    )}
                  >
                    {/* Two-digit day number (circled if Today) */}
                    <div className="w-9 sm:w-12 flex justify-end pr-1.5 sm:pr-3 shrink-0">
                      {row.isToday ? (
                        <span
                          className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-[15px] sm:text-[18px] font-bold text-white tabular-nums shadow-sm"
                          style={{ backgroundColor: accentColor }}
                          title="Current Date (Today)"
                        >
                          {row.padded}
                        </span>
                      ) : (
                        <span
                          className="text-[20px] sm:text-[26px] font-light tabular-nums leading-none tracking-tight"
                          style={{ color: row.labelColor }}
                        >
                          {row.padded}
                        </span>
                      )}
                    </div>

                    {/* Vertical Spine + Circle Node */}
                    <div className="relative w-6 sm:w-7 self-stretch flex items-center justify-center shrink-0">
                      {!isFirst && (
                        <div
                          className="absolute top-0 h-1/2 w-[5px]"
                          style={{ backgroundColor: topSpineColor }}
                        />
                      )}
                      {!isLast && (
                        <div
                          className="absolute bottom-0 h-1/2 w-[5px]"
                          style={{ backgroundColor: bottomSpineColor }}
                        />
                      )}
                      {row.isToday ? (
                        <div
                          className="relative z-10 h-[20px] w-[20px] sm:h-[21px] sm:w-[21px] rounded-full bg-white dark:bg-zinc-950 border-[4px]"
                          style={{
                            borderColor: accentColor,
                            boxShadow: `0 0 0 4px ${accentColor}26`,
                          }}
                          aria-label="Current date marker"
                        />
                      ) : (
                        <div
                          className="relative z-10 h-[14px] w-[14px] sm:h-[15px] sm:w-[15px] rounded-full bg-white dark:bg-zinc-950 border-[3.5px]"
                          style={{ borderColor: row.spineColor }}
                        />
                      )}
                    </div>

                    {/* Weekday Label */}
                    <div className="flex-1 min-w-0 pl-1.5 sm:pl-3 flex items-center gap-1.5">
                      <span
                        className={cn(
                          "text-[13px] sm:text-[15px] truncate",
                          row.isToday ? "font-bold" : "font-normal",
                        )}
                        style={{ color: row.labelColor }}
                      >
                        <span className="sm:hidden">{row.weekdayShort}</span>
                        <span className="hidden sm:inline">{row.weekdayLong}</span>
                      </span>
                      {row.isToday && (
                        <span
                          className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] sm:text-[9.5px] font-bold uppercase tracking-wider text-white"
                          style={{ backgroundColor: accentColor }}
                        >
                          Now
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Task / Event Area */}
                  <div
                    className={cn(
                      "flex-1 min-w-0 px-3 sm:px-5 flex items-center justify-between gap-3",
                      row.dayItems.length > 0 || row.isToday ? "py-2.5 min-h-[54px]" : "py-2 min-h-[44px]",
                    )}
                  >
                    {row.dayItems.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-2 flex-1">
                        {row.dayItems.map((item) => {
                          const metaColor = getItemMetaColor(item, currentMonthTerm)
                          return (
                            <div
                              key={item.id}
                              className={cn(
                                "group/card relative rounded-[4px] bg-[#efefef] hover:bg-[#e6e8ec] dark:bg-zinc-800/90 dark:hover:bg-zinc-800 px-3.5 py-2 transition-colors border border-transparent hover:border-gray-300/70 dark:hover:border-zinc-700 max-w-full sm:max-w-[360px]",
                                item.completed && "opacity-65",
                              )}
                            >
                              <div className="flex items-start gap-2">
                                {item.canToggle && onToggleTask && (
                                  <button
                                    type="button"
                                    onClick={() => onToggleTask(item)}
                                    className="mt-0.5 shrink-0 text-gray-400 hover:text-emerald-600 transition-colors"
                                    title={item.completed ? "Mark incomplete" : "Mark complete"}
                                    aria-label={item.completed ? "Mark incomplete" : "Mark complete"}
                                  >
                                    {item.completed ? (
                                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                    ) : (
                                      <Circle className="h-4 w-4" />
                                    )}
                                  </button>
                                )}

                                <div className="min-w-0 flex-1">
                                  <div
                                    className="text-[11.5px] font-semibold leading-tight truncate"
                                    style={{ color: metaColor }}
                                  >
                                    {item.metaLabel}
                                  </div>
                                  <div
                                    className={cn(
                                      "text-[13.5px] font-medium text-gray-900 dark:text-zinc-100 leading-snug mt-0.5 break-words",
                                      item.completed && "line-through text-gray-500 dark:text-zinc-400",
                                    )}
                                  >
                                    {item.title}
                                  </div>
                                  {item.description && (
                                    <p className="text-[11.5px] text-gray-600 dark:text-zinc-400 mt-0.5 line-clamp-1">
                                      {item.description}
                                    </p>
                                  )}
                                </div>

                                {item.canDelete && onDeleteTask && (
                                  <button
                                    type="button"
                                    onClick={() => onDeleteTask(item)}
                                    className="opacity-0 group-hover/card:opacity-100 shrink-0 text-gray-400 hover:text-red-600 transition-opacity ml-1"
                                    title="Delete task"
                                    aria-label="Delete task"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : row.isToday ? (
                      <div className="flex items-center gap-2 text-xs text-blue-700/80 dark:text-blue-300">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span>No tasks scheduled for today yet.</span>
                      </div>
                    ) : (
                      <div className="flex-1" />
                    )}

                    {onAddTask && (
                      <button
                        type="button"
                        onClick={() => openAddDialog(row.dateKey)}
                        className={cn(
                          "shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-opacity",
                          row.isToday
                            ? "opacity-100 bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50"
                            : "opacity-0 group-hover/row:opacity-100 text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800",
                        )}
                      >
                        <Plus className="h-3 w-3" />
                        Add
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Academic Year Overview (04 April -> 03 March, matching reference timeline) */
          <div className="divide-y divide-[#eaecf0] dark:divide-zinc-800">
            {academicYearRows.map((row, idx) => {
              const isFirst = idx === 0
              const isLast = idx === academicYearRows.length - 1
              const prevRow = idx > 0 ? academicYearRows[idx - 1] : null
              const nextRow = idx < academicYearRows.length - 1 ? academicYearRows[idx + 1] : null

              const topSpineColor = prevRow?.term === "recess" ? prevRow.spineColor : row.spineColor
              const bottomSpineColor = nextRow?.term === "recess" ? nextRow.spineColor : row.spineColor

              return (
                <div
                  key={row.padded}
                  className={cn(
                    "flex items-stretch transition-colors",
                    row.isCurrentMonth
                      ? "bg-blue-50/45 dark:bg-blue-950/20"
                      : idx % 2 === 0
                        ? "bg-white dark:bg-zinc-900"
                        : "bg-[#fcfcfd] dark:bg-zinc-900/60",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setCursorMonth(row.month)
                      setViewMode("month")
                    }}
                    className={cn(
                      "w-[148px] sm:w-[250px] shrink-0 flex items-center px-2 sm:px-4 border-r border-[#eaecf0] dark:border-zinc-800 text-left hover:brightness-[0.98] transition",
                      row.isCurrentMonth
                        ? "bg-blue-50/85 dark:bg-blue-950/35"
                        : "bg-[#f3f4f6] dark:bg-zinc-900/90",
                    )}
                    title={`Open ${row.name} timeline`}
                  >
                    <div className="w-9 sm:w-12 flex justify-end pr-1.5 sm:pr-3 shrink-0">
                      {row.isCurrentMonth ? (
                        <span
                          className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-[15px] sm:text-[18px] font-bold text-white tabular-nums"
                          style={{ backgroundColor: accentColor }}
                        >
                          {row.padded}
                        </span>
                      ) : (
                        <span
                          className="text-[20px] sm:text-[26px] font-light tabular-nums leading-none tracking-tight"
                          style={{ color: row.labelColor }}
                        >
                          {row.padded}
                        </span>
                      )}
                    </div>

                    <div className="relative w-6 sm:w-7 self-stretch flex items-center justify-center shrink-0">
                      {!isFirst && (
                        <div
                          className="absolute top-0 h-1/2 w-[5px]"
                          style={{ backgroundColor: topSpineColor }}
                        />
                      )}
                      {!isLast && (
                        <div
                          className="absolute bottom-0 h-1/2 w-[5px]"
                          style={{ backgroundColor: bottomSpineColor }}
                        />
                      )}
                      {row.isCurrentMonth ? (
                        <div
                          className="relative z-10 h-[20px] w-[20px] rounded-full bg-white dark:bg-zinc-950 border-[4px]"
                          style={{
                            borderColor: accentColor,
                            boxShadow: `0 0 0 4px ${accentColor}26`,
                          }}
                        />
                      ) : (
                        <div
                          className="relative z-10 h-[15px] w-[15px] rounded-full bg-white dark:bg-zinc-950 border-[3.5px]"
                          style={{ borderColor: row.spineColor }}
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 pl-2 sm:pl-3 flex items-center gap-1.5">
                      <span
                        className={cn(
                          "text-[13px] sm:text-[15px] truncate",
                          row.isCurrentMonth ? "font-bold" : "font-normal",
                        )}
                        style={{ color: row.isCurrentMonth ? accentColor : row.labelColor }}
                      >
                        {row.name}
                      </span>
                      {row.isCurrentMonth && (
                        <span
                          className="shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-white"
                          style={{ backgroundColor: accentColor }}
                        >
                          Now
                        </span>
                      )}
                    </div>
                  </button>

                  <div className="flex-1 min-w-0 px-3 sm:px-5 py-2.5 min-h-[54px] flex items-center">
                    {row.rowItems.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {row.rowItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setCursorMonth(row.month)
                              setViewMode("month")
                            }}
                            className="text-left rounded-[4px] bg-[#efefef] hover:bg-[#e6e8ec] dark:bg-zinc-800/90 dark:hover:bg-zinc-800 px-3.5 py-2 transition-colors"
                          >
                            <div
                              className="text-[11.5px] font-semibold leading-tight"
                              style={{ color: getItemMetaColor(item, row.term) }}
                            >
                              {item.metaLabel}
                            </div>
                            <div className="text-[13.5px] font-medium text-gray-900 dark:text-zinc-100 leading-snug mt-0.5">
                              {item.title}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick Add Task Dialog */}
      {onAddTask && (
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Add Task to Calendar
              </DialogTitle>
              <DialogDescription>
                Schedule a task or deadline on a specific date so it appears on your timeline.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmitTask} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cal-task-title">Task title</Label>
                <Input
                  id="cal-task-title"
                  placeholder="e.g., Review Week 6 lecture slides"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cal-task-date">Date</Label>
                  <Input
                    id="cal-task-date"
                    type="date"
                    value={taskDate}
                    onChange={(e) => setTaskDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cal-task-priority">Priority</Label>
                  <Select
                    value={taskPriority}
                    onValueChange={(v) => setTaskPriority(v as "low" | "medium" | "high")}
                  >
                    <SelectTrigger id="cal-task-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {courses.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="cal-task-course">Course (optional)</Label>
                  <Select value={taskCourseId} onValueChange={setTaskCourseId}>
                    <SelectTrigger id="cal-task-course">
                      <SelectValue placeholder="General / No specific course" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">General / Personal</SelectItem>
                      {courses.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.code ? `${course.code} — ` : ""}
                          {course.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="cal-task-desc">Notes (optional)</Label>
                <Input
                  id="cal-task-desc"
                  placeholder="Optional details..."
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                />
              </div>

              {saveError && (
                <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">{saveError}</div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving || !taskTitle.trim()}
                  className="text-white"
                  style={{ backgroundColor: accentColor }}
                >
                  {isSaving ? "Saving..." : "Save Task"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

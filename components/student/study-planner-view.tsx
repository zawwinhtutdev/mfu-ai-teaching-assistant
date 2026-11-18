"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sparkles, Plus, Trash2, CheckCircle2, Circle, Calendar, ArrowUpRight, Loader2 } from "lucide-react"

interface StudyPlan {
  id: string
  title: string
  description: string | null
  due_date: string | null
  priority: "low" | "medium" | "high"
  completed: boolean
  ai_generated: boolean
  course_id: string | null
}

interface StudyPlannerViewProps {
  courseId?: string
  courseName?: string
}

const PRIORITY_COLORS = {
  low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
}

/**
 * A plan's due date is a calendar date, not an instant.
 *
 * `new Date("2026-11-19")` parses as UTC midnight, so `toLocaleDateString()`
 * renders the 18th for anyone west of UTC — a task due on the 19th appears a day
 * early. Reading the parts back in UTC keeps the date the teacher and student
 * agreed on.
 */
function formatPlanDate(value: string): string {
  // Accept both "2026-11-19" and a full timestamp.
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()}`
}

export function StudyPlannerView({ courseId, courseName }: StudyPlannerViewProps) {
  const [plans, setPlans] = useState<StudyPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newPriority, setNewPriority] = useState<string>("medium")

  const loadPlans = useCallback(async () => {
    try {
      const params = courseId ? `?courseId=${courseId}` : ""
      const res = await fetch(`/api/study-planner${params}`)
      const data = await res.json()
      setPlans(data?.plans || [])
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    loadPlans()
  }, [loadPlans])

  const addPlan = async () => {
    if (!newTitle.trim()) return
    try {
      const res = await fetch("/api/study-planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          priority: newPriority,
          courseId,
        }),
      })
      const data = await res.json()
      if (data.plan) {
        setPlans((prev) => [...prev, data.plan])
        setNewTitle("")
      }
    } catch {
      // ignore
    }
  }

  const generateAIPlan = async () => {
    if (!courseId) return
    setIsGenerating(true)
    try {
      const res = await fetch("/api/study-planner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generateAI: true, courseId }),
      })
      const data = await res.json()
      if (data.plans) {
        setPlans((prev) => [...prev, ...data.plans])
      }
    } catch {
      // ignore
    } finally {
      setIsGenerating(false)
    }
  }

  const toggleComplete = async (plan: StudyPlan) => {
    const newCompleted = !plan.completed
    setPlans((prev) =>
      prev.map((p) => (p.id === plan.id ? { ...p, completed: newCompleted } : p))
    )
    try {
      await fetch("/api/study-planner", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, completed: newCompleted }),
      })
    } catch {
      // Revert
      setPlans((prev) =>
        prev.map((p) => (p.id === plan.id ? { ...p, completed: !newCompleted } : p))
      )
    }
  }

  const deletePlan = async (planId: string) => {
    setPlans((prev) => prev.filter((p) => p.id !== planId))
    try {
      await fetch("/api/study-planner", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      })
    } catch {
      loadPlans()
    }
  }

  const incomplete = plans.filter((p) => !p.completed)
  const completed = plans.filter((p) => p.completed)

  return (
    <Card className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-lg border-0 rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Study Planner
          </span>
          {courseId && (
            <Button
              size="sm"
              variant="outline"
              onClick={generateAIPlan}
              disabled={isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isGenerating ? "Generating..." : "AI Generate Plan"}
            </Button>
          )}
        </CardTitle>
        <CardDescription>
          {courseName
            ? `Plan your study schedule for ${courseName}`
            : "Organize and track your study tasks"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add task */}
        <div className="flex gap-2">
          <Input
            placeholder="Add a study task..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addPlan()}
            className="flex-1"
          />
          <Select value={newPriority} onValueChange={setNewPriority}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Med</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
          <Button size="icon" onClick={addPlan} disabled={!newTitle.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-6">Loading plans...</p>
        ) : plans.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground">No study plans yet.</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              Add tasks manually or let AI generate a plan.
            </p>
          </div>
        ) : (
          <>
            {/* Incomplete tasks */}
            <div className="space-y-2">
              {incomplete.map((plan) => (
                <div
                  key={plan.id}
                  className="flex items-start gap-3 p-3 rounded-xl border bg-white dark:bg-gray-800/50 group hover:shadow-sm transition-shadow"
                >
                  <button
                    onClick={() => toggleComplete(plan)}
                    className="mt-0.5 text-muted-foreground hover:text-green-600 transition-colors"
                  >
                    <Circle className="h-5 w-5" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{plan.title}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[plan.priority]}`}>
                        {plan.priority}
                      </span>
                      {plan.ai_generated && (
                        <Sparkles className="h-3 w-3 text-purple-500" />
                      )}
                    </div>
                    {plan.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{plan.description}</p>
                    )}
                    {plan.due_date && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatPlanDate(plan.due_date)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => deletePlan(plan.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Completed tasks */}
            {completed.length > 0 && (
              <div className="space-y-2 pt-3 border-t">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Completed ({completed.length})
                </p>
                {completed.map((plan) => (
                  <div
                    key={plan.id}
                    className="flex items-center gap-3 p-2 rounded-lg group opacity-60"
                  >
                    <button
                      onClick={() => toggleComplete(plan)}
                      className="text-green-600"
                    >
                      <CheckCircle2 className="h-5 w-5" />
                    </button>
                    <p className="text-sm line-through flex-1">{plan.title}</p>
                    <button
                      onClick={() => deletePlan(plan.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-500 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

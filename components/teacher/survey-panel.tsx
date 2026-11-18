"use client"

/**
 * Survey management and §9 evaluation metrics.
 *
 * Spec §9 sets three targets that need a survey instrument to measure:
 * teacher satisfaction >= 80% positive, and usability (SUS) >= 75. The
 * `/api/surveys` endpoint already scored submissions but nothing created a
 * survey, so the table was always empty and the targets were unmeasurable.
 *
 * This panel is how a teacher opens a survey and how anyone reads the result
 * against the target.
 */

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ClipboardList, Loader2, Plus, Target } from "lucide-react"

interface Survey {
  id: string
  title: string
  survey_type: "satisfaction" | "sus"
  is_active: boolean
  created_at: string
}

interface SurveyStats {
  totalResponses: number
  averageScore: number | null
}

interface SurveyPanelProps {
  courseId: string
}

/** §9 thresholds. */
const SUS_TARGET = 75
const SATISFACTION_TARGET_PCT = 80

export function SurveyPanel({ courseId }: SurveyPanelProps) {
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [statsBySurvey, setStatsBySurvey] = useState<Record<string, SurveyStats>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/surveys?courseId=${courseId}`)
      const data = await res.json()
      const list: Survey[] = data?.surveys ?? []
      setSurveys(list)

      // Fetch per-survey stats so the target comparison is visible without
      // opening each survey.
      const entries = await Promise.all(
        list.map(async (survey) => {
          const statsRes = await fetch(`/api/surveys?surveyId=${survey.id}`)
          const statsData = await statsRes.json()
          return [survey.id, statsData?.stats ?? { totalResponses: 0, averageScore: null }] as const
        }),
      )
      setStatsBySurvey(Object.fromEntries(entries))
    } catch {
      setError("Could not load surveys")
    } finally {
      setIsLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    load()
  }, [load])

  const createSurvey = async (surveyType: "sus" | "satisfaction") => {
    setIsCreating(true)
    setError(null)
    try {
      const res = await fetch("/api/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:
            surveyType === "sus"
              ? "Usability survey (SUS)"
              : "Course assistant satisfaction survey",
          surveyType,
          courseId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Could not create the survey")
      await load()
    } catch (cause: any) {
      setError(cause?.message || "Could not create the survey")
    } finally {
      setIsCreating(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Evaluation surveys
          </CardTitle>
          <CardDescription>
            Spec §9 targets: usability (SUS) at least {SUS_TARGET} out of 100, and at least{" "}
            {SATISFACTION_TARGET_PCT}% positive satisfaction.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => createSurvey("sus")} disabled={isCreating}>
            {isCreating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Open a SUS survey
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => createSurvey("satisfaction")}
            disabled={isCreating}
          >
            <Plus className="mr-2 h-4 w-4" />
            Open a satisfaction survey
          </Button>
        </CardContent>
      </Card>

      {surveys.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <ClipboardList className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No surveys yet. Students see an open survey on the course page.
            </p>
          </CardContent>
        </Card>
      ) : (
        surveys.map((survey) => {
          const stats = statsBySurvey[survey.id]
          const average = stats?.averageScore ?? null
          // A SUS score is already 0-100. Satisfaction is a 1-5 mean, so it is
          // converted to a percentage to compare against the 80% target.
          const comparable =
            average === null
              ? null
              : survey.survey_type === "sus"
                ? average
                : ((average - 1) / 4) * 100
          const target = survey.survey_type === "sus" ? SUS_TARGET : SATISFACTION_TARGET_PCT
          const meetsTarget = comparable !== null && comparable >= target

          return (
            <Card key={survey.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
                <div>
                  <p className="flex items-center gap-2 font-medium">
                    {survey.title}
                    {!survey.is_active && (
                      <Badge variant="secondary" className="text-xs">
                        Closed
                      </Badge>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {stats?.totalResponses ?? 0} response
                    {(stats?.totalResponses ?? 0) === 1 ? "" : "s"}
                    {average !== null && (
                      <>
                        {" • "}
                        {survey.survey_type === "sus"
                          ? `SUS ${Math.round(average)}/100`
                          : `satisfaction ${average.toFixed(1)}/5`}
                      </>
                    )}
                  </p>
                </div>

                {comparable === null ? (
                  <Badge variant="secondary">Awaiting responses</Badge>
                ) : meetsTarget ? (
                  <Badge className="bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200">
                    Meets target ({Math.round(comparable)} vs {target})
                  </Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                    Below target ({Math.round(comparable)} vs {target})
                  </Badge>
                )}
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}

"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ClipboardList, CheckCircle2, Loader2 } from "lucide-react"

const SCALE_LABELS = [
  "Strongly Disagree",
  "Disagree",
  "Neutral",
  "Agree",
  "Strongly Agree",
]

interface Survey {
  id: string
  title: string
  survey_type: "satisfaction" | "sus"
  is_active: boolean
}

interface SurveyWidgetProps {
  courseId: string
}

export function SurveyWidget({ courseId }: SurveyWidgetProps) {
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [activeSurvey, setActiveSurvey] = useState<Survey | null>(null)
  const [susQuestions, setSusQuestions] = useState<string[]>([])
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState<number | null>(null)

  const loadSurveys = useCallback(async () => {
    try {
      const res = await fetch(`/api/surveys?courseId=${courseId}`)
      const data = await res.json()
      setSurveys(data?.surveys?.filter((s: Survey) => s.is_active) || [])
      if (data?.susQuestions) setSusQuestions(data.susQuestions)
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    loadSurveys()
  }, [loadSurveys])

  const submitSurvey = async () => {
    if (!activeSurvey) return
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveyId: activeSurvey.id,
          answers,
        }),
      })
      const data = await res.json()
      if (data.score !== undefined) {
        setScore(data.score)
      }
      setSubmitted(true)
    } catch {
      // ignore
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) return null

  // No active surveys
  if (surveys.length === 0 && !activeSurvey) return null

  // Submitted state
  if (submitted) {
    return (
      <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-0 rounded-2xl">
        <CardContent className="py-8 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-3" />
          <p className="font-semibold text-green-800 dark:text-green-300">
            Thank you for your feedback!
          </p>
          {score !== null && (
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
              Your SUS score: {Math.round(score)}/100
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  // Survey form
  if (activeSurvey) {
    const questions =
      activeSurvey.survey_type === "sus"
        ? susQuestions
        : [
            "How satisfied are you with the AI teaching assistant?",
            "How helpful were the AI-generated summaries?",
            "How easy was it to find course materials?",
            "How would you rate the chatbot responses?",
            "How likely are you to recommend this platform?",
          ]

    const allAnswered = questions.every((_, i) => answers[i] !== undefined)

    return (
      <Card className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-lg border-0 rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5" />
            {activeSurvey.title}
          </CardTitle>
          <CardDescription>
            {activeSurvey.survey_type === "sus"
              ? "Rate each statement on a scale from Strongly Disagree to Strongly Agree"
              : "Share your experience with the AI teaching assistant"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {questions.map((q, i) => (
            <div key={i} className="space-y-2">
              <p className="text-sm font-medium">
                {i + 1}. {q}
              </p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    onClick={() =>
                      setAnswers((prev) => ({ ...prev, [i]: val }))
                    }
                    className={`flex-1 py-2 px-1 rounded-lg text-xs font-medium transition-all ${
                      answers[i] === val
                        ? "bg-blue-500 text-white shadow-md"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                    }`}
                    title={SCALE_LABELS[val - 1]}
                  >
                    {val}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                <span>Strongly Disagree</span>
                <span>Strongly Agree</span>
              </div>
            </div>
          ))}

          <div className="flex gap-2 pt-3">
            <Button
              onClick={submitSurvey}
              disabled={!allAnswered || isSubmitting}
              className="flex-1"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {isSubmitting ? "Submitting..." : "Submit Survey"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setActiveSurvey(null)
                setAnswers({})
              }}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Survey list (show available surveys)
  return (
    <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-0 rounded-2xl">
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <div>
              <p className="font-medium text-sm">
                {surveys.length} survey{surveys.length > 1 ? "s" : ""} available
              </p>
              <p className="text-xs text-muted-foreground">
                Share your feedback about this course
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setActiveSurvey(surveys[0])}
          >
            Take Survey
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

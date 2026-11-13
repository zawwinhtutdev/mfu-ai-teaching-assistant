"use client"

/**
 * Quiz review for a teacher.
 *
 * The teacher's AI Assistant tab reused the student component, which queried
 * `student_id = <teacher id>` and so never matched a course-wide quiz. The only
 * way to create a quiz was a `handleGenerateQuiz` helper that nothing called,
 * and which read `data.quiz.title` from a response that has no `quiz` key. In
 * practice a teacher had no quiz workflow at all, and students saw an empty tab.
 */

import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { CheckCircle2, Eye, EyeOff, FileText, Loader2, Sparkles, Trash2 } from "lucide-react"

type QuizQuestion = {
  question: string
  options: string[]
  correct_answer?: number
}

type TeacherQuiz = {
  id: string
  title: string
  questions: QuizQuestion[]
  is_published: boolean
  student_id: string | null
  created_at: string
}

interface TeacherQuizzesPanelProps {
  courseId: string
  /** Materials available to generate a quiz from. */
  materials: Array<{ id: string; title: string }>
  /** Bumped by the parent when a material finishes uploading. */
  refreshKey?: number
}

export function TeacherQuizzesPanel({
  courseId,
  materials,
  refreshKey = 0,
}: TeacherQuizzesPanelProps) {
  const [quizzes, setQuizzes] = useState<TeacherQuiz[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [generatingFor, setGeneratingFor] = useState<string | null>(null)
  const [preview, setPreview] = useState<TeacherQuiz | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/courses/${courseId}/quizzes`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Could not load quizzes")
      setQuizzes(Array.isArray(data?.quizzes) ? data.quizzes : [])
    } catch (cause: any) {
      setError(cause?.message || "Could not load quizzes")
    } finally {
      setIsLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  const togglePublish = async (quiz: TeacherQuiz) => {
    setBusyId(quiz.id)
    setError(null)
    try {
      const res = await fetch(`/api/courses/${courseId}/quizzes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quizId: quiz.id, isPublished: !quiz.is_published }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Could not update the quiz")
      setQuizzes((prev) =>
        prev.map((item) =>
          item.id === quiz.id ? { ...item, is_published: data.quiz.is_published } : item,
        ),
      )
    } catch (cause: any) {
      setError(cause?.message || "Could not update the quiz")
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (quiz: TeacherQuiz) => {
    setBusyId(quiz.id)
    setError(null)
    try {
      const res = await fetch(
        `/api/courses/${courseId}/quizzes?quizId=${encodeURIComponent(quiz.id)}`,
        { method: "DELETE" },
      )
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || "Could not delete the quiz")
      }
      setQuizzes((prev) => prev.filter((item) => item.id !== quiz.id))
    } catch (cause: any) {
      setError(cause?.message || "Could not delete the quiz")
    } finally {
      setBusyId(null)
    }
  }

  const generate = async (materialId: string) => {
    setGeneratingFor(materialId)
    setError(null)
    try {
      const res = await fetch("/api/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Could not generate a quiz")
      await load()
    } catch (cause: any) {
      setError(cause?.message || "Could not generate a quiz")
    } finally {
      setGeneratingFor(null)
    }
  }

  const published = quizzes.filter((quiz) => quiz.student_id === null && quiz.is_published).length

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Quizzes</h3>
        <p className="text-sm text-muted-foreground">
          {quizzes.length === 0
            ? "Generate a quiz from a course material, then it appears for every enrolled student."
            : `${quizzes.length} quiz${quizzes.length === 1 ? "" : "zes"} · ${published} visible to students`}
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Generation sits above the list: without it the tab is read-only. */}
      {materials.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-violet-500" />
              Generate from a material
            </CardTitle>
            <CardDescription>
              Five multiple-choice questions written from the material&apos;s text.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {materials.map((material) => (
              <Button
                key={material.id}
                size="sm"
                variant="outline"
                disabled={generatingFor !== null}
                onClick={() => void generate(material.id)}
                className="max-w-full"
              >
                {generatingFor === material.id ? (
                  <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4 shrink-0" />
                )}
                <span className="truncate">{material.title}</span>
              </Button>
            ))}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading quizzes…
        </div>
      ) : quizzes.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No quizzes yet. Generate one from a material above.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {quizzes.map((quiz) => (
            <Card key={quiz.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-start justify-between gap-2 text-base">
                  <span className="min-w-0 truncate">{quiz.title}</span>
                  {quiz.student_id !== null ? (
                    <Badge variant="secondary" className="shrink-0">
                      Practice
                    </Badge>
                  ) : quiz.is_published ? (
                    <Badge className="shrink-0 bg-emerald-600">Live</Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0">
                      Draft
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {quiz.questions.length} question{quiz.questions.length === 1 ? "" : "s"}
                  {quiz.student_id !== null ? " · private to one student" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setPreview(quiz)}>
                  <Eye className="mr-2 h-4 w-4" />
                  Review
                </Button>
                {quiz.student_id === null && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === quiz.id}
                    onClick={() => void togglePublish(quiz)}
                  >
                    {busyId === quiz.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : quiz.is_published ? (
                      <EyeOff className="mr-2 h-4 w-4" />
                    ) : (
                      <Eye className="mr-2 h-4 w-4" />
                    )}
                    {quiz.is_published ? "Unpublish" : "Publish"}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busyId === quiz.id}
                  onClick={() => void remove(quiz)}
                  aria-label="Delete quiz"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{preview?.title}</DialogTitle>
            <DialogDescription>
              {preview?.questions.length} question{preview?.questions.length === 1 ? "" : "s"} · the
              correct answer is marked
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-4">
            {preview?.questions.map((question, index) => (
              <li key={index} className="space-y-2">
                <p className="text-sm font-medium">
                  {index + 1}. {question.question}
                </p>
                <ul className="space-y-1">
                  {question.options.map((option, optionIndex) => {
                    const correct = optionIndex === question.correct_answer
                    return (
                      <li
                        key={optionIndex}
                        className={`flex items-start gap-2 rounded-md px-2 py-1 text-sm ${
                          correct ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : ""
                        }`}
                      >
                        {correct && <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                        <span className={correct ? "" : "ml-5"}>{option}</span>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { FileText, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { mockQuizzes } from "@/lib/mock-data"
import type { Quiz, QuizQuestion } from "@/lib/types"

interface QuizzesViewProps {
  courseId: string
  studentId: string
}

export function QuizzesView({ courseId, studentId }: QuizzesViewProps) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [showResults, setShowResults] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /**
   * Answer keys only exist after grading. The list endpoint deliberately omits
   * `correct_answer` so a student cannot read the answers out of the network
   * response before submitting; the server scores the attempt instead.
   */
  const [answerKey, setAnswerKey] = useState<number[] | null>(null)

  useEffect(() => {
    loadQuizzes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId])

  const loadQuizzes = async () => {
    const isDemoStudent = studentId.startsWith("mock-") || studentId.startsWith("student-")

    try {
      const res = await fetch(`/api/courses/${courseId}/quizzes`, { cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Could not load quizzes")

      const rows: Quiz[] = Array.isArray(data?.quizzes) ? data.quizzes : []
      if (rows.length > 0) {
        setQuizzes(rows)
      } else if (isDemoStudent) {
        setQuizzes(mockQuizzes.filter((quiz) => quiz.course_id === courseId))
      } else {
        setQuizzes([])
      }
    } catch (cause: any) {
      if (isDemoStudent) {
        setQuizzes(mockQuizzes.filter((quiz) => quiz.course_id === courseId))
      } else {
        setError(cause?.message || "Could not load quizzes")
        setQuizzes([])
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartQuiz = (quiz: Quiz) => {
    setSelectedQuiz(quiz)
    setAnswers({})
    setShowResults(false)
    setAnswerKey(null)
  }

  const handleSubmit = async () => {
    if (!selectedQuiz) return
    // Derive the key locally when the quiz carries one (mock data), otherwise
    // ask the server, which is the only place that holds it.
    const hasInlineKey = selectedQuiz.questions.every(
      (question: QuizQuestion) => typeof question.correct_answer === "number",
    )

    if (hasInlineKey) {
      setAnswerKey(selectedQuiz.questions.map((question) => Number(question.correct_answer)))
      setShowResults(true)
      return
    }

    try {
      const res = await fetch(`/api/quizzes/${selectedQuiz.id}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Could not submit the quiz")
      setAnswerKey(Array.isArray(data?.answerKey) ? data.answerKey : null)
      setShowResults(true)
    } catch (cause: any) {
      setError(cause?.message || "Could not submit the quiz")
    }
  }

  const calculateScore = () => {
    if (!selectedQuiz || !answerKey) return 0
    let correct = 0
    answerKey.forEach((correctAnswer, index) => {
      if (answers[index] === correctAnswer) correct++
    })
    return Math.round((correct / selectedQuiz.questions.length) * 100)
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading quizzes...</p>
        </CardContent>
      </Card>
    )
  }

  if (selectedQuiz) {
    const score = showResults ? calculateScore() : 0

    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{selectedQuiz.title}</h2>
            <p className="text-sm text-muted-foreground">{selectedQuiz.questions.length} questions</p>
          </div>
          <Button variant="outline" onClick={() => setSelectedQuiz(null)}>
            Back to Quizzes
          </Button>
        </div>

        {showResults && (
          <Card
            className={
              score >= 70
                ? "border-green-500 bg-green-50 dark:bg-green-950"
                : "border-yellow-500 bg-yellow-50 dark:bg-yellow-950"
            }
          >
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-4xl font-bold">{score}%</p>
                <p className="text-muted-foreground">{score >= 70 ? "Great job!" : "Keep practicing!"}</p>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
          {selectedQuiz.questions.map((question, qIndex) => {
            const correctIndex = answerKey?.[qIndex]
            return (
            <Card key={qIndex}>
              <CardHeader>
                <CardTitle className="text-lg">
                  Question {qIndex + 1}
                  {showResults && correctIndex !== undefined && (
                    <span className="ml-2">
                      {answers[qIndex] === correctIndex ? (
                        <CheckCircle2 className="inline h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="inline h-5 w-5 text-red-600" />
                      )}
                    </span>
                  )}
                </CardTitle>
                <CardDescription>{question.question}</CardDescription>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={answers[qIndex]?.toString()}
                  // Functional update: spreading the `answers` captured by this
                  // render means two answers given before React re-renders
                  // overwrite each other, and the last one silently wins.
                  onValueChange={(value) =>
                    setAnswers((previous) => ({ ...previous, [qIndex]: Number.parseInt(value) }))
                  }
                  disabled={showResults}
                >
                  {question.options.map((option, oIndex) => (
                    <div
                      key={oIndex}
                      className={`flex items-center space-x-2 rounded-lg p-3 ${
                        showResults && oIndex === correctIndex
                          ? "bg-green-100 dark:bg-green-950"
                          : showResults && answers[qIndex] === oIndex && oIndex !== correctIndex
                            ? "bg-red-100 dark:bg-red-950"
                            : ""
                      }`}
                    >
                      <RadioGroupItem value={oIndex.toString()} id={`q${qIndex}-o${oIndex}`} />
                      <Label htmlFor={`q${qIndex}-o${oIndex}`} className="flex-1 cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>
            )
          })}
        </div>

        {!showResults && (
          <Button
            onClick={handleSubmit}
            className="w-full"
            disabled={Object.keys(answers).length !== selectedQuiz.questions.length}
          >
            Submit Quiz
          </Button>
        )}
      </div>
    )
  }

  if (quizzes.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No quizzes available</h3>
          <p className="text-sm text-muted-foreground">Your teacher hasn&apos;t created any quizzes yet.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {quizzes.map((quiz) => (
        <Card key={quiz.id}>
          <CardHeader>
            <CardTitle>{quiz.title}</CardTitle>
            <CardDescription>{quiz.questions.length} questions</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => handleStartQuiz(quiz)} className="w-full">
              Start Quiz
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

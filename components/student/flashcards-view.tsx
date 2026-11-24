"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Brain, ChevronLeft, ChevronRight, Loader2, Pencil, Plus, RotateCw, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { mockFlashcards } from "@/lib/mock-data"

interface FlashcardsViewProps {
  courseId: string
  studentId: string
  /** Teachers get create/edit/delete controls and see the course deck. */
  canManage?: boolean
}

type StudyCard = {
  id: string
  question: string
  answer: string
  created_at: string
}

export function FlashcardsView({ courseId, studentId, canManage = false }: FlashcardsViewProps) {
  const [flashcards, setFlashcards] = useState<StudyCard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadFlashcards()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, studentId, canManage])

  const loadFlashcards = async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()

      if (canManage) {
        const { data } = await supabase
          .from("course_flashcards")
          .select("id,question,answer,created_at")
          .eq("course_id", courseId)
          .order("created_at", { ascending: false })
        setFlashcards((data as StudyCard[]) ?? [])
        return
      }

      // Students study the teacher's course deck plus any cards generated for
      // them from their own materials.
      const [{ data: courseCards }, { data: personalCards }] = await Promise.all([
        supabase
          .from("course_flashcards")
          .select("id,question,answer,created_at")
          .eq("course_id", courseId)
          .order("created_at", { ascending: false }),
        supabase
          .from("flashcards")
          .select("id,question,answer,created_at")
          .eq("course_id", courseId)
          .eq("student_id", studentId)
          .order("created_at", { ascending: false }),
      ])

      const merged = [...((courseCards as StudyCard[]) ?? []), ...((personalCards as StudyCard[]) ?? [])]
      if (merged.length === 0 && studentId.startsWith("mock-")) {
        setFlashcards(
          mockFlashcards
            .filter((card) => card.course_id === courseId)
            .map((card) => ({ id: card.id, question: card.question, answer: card.answer, created_at: card.created_at })),
        )
        return
      }
      setFlashcards(merged)
    } catch {
      setFlashcards([])
    } finally {
      setIsLoading(false)
      setCurrentIndex(0)
      setIsFlipped(false)
    }
  }

  const openNew = () => {
    setEditingId(null)
    setQuestion("")
    setAnswer("")
    setError(null)
    setDialogOpen(true)
  }

  const openEdit = (card: StudyCard) => {
    setEditingId(card.id)
    setQuestion(card.question)
    setAnswer(card.answer)
    setError(null)
    setDialogOpen(true)
  }

  const saveCard = async () => {
    if (!question.trim() || !answer.trim()) return
    setIsSaving(true)
    setError(null)
    try {
      const supabase = createClient()
      if (editingId) {
        const { error: updateError } = await supabase
          .from("course_flashcards")
          .update({ question: question.trim(), answer: answer.trim(), updated_at: new Date().toISOString() })
          .eq("id", editingId)
        if (updateError) throw new Error(updateError.message)
      } else {
        const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        const { error: insertError } = await supabase.from("course_flashcards").insert({
          course_id: courseId,
          created_by: uuid.test(studentId) ? studentId : null,
          question: question.trim(),
          answer: answer.trim(),
        })
        if (insertError) throw new Error(insertError.message)
      }
      setDialogOpen(false)
      await loadFlashcards()
    } catch (cause: any) {
      setError(cause?.message || "Could not save the flashcard")
    } finally {
      setIsSaving(false)
    }
  }

  const deleteCard = async (card: StudyCard) => {
    if (!window.confirm("Delete this flashcard? Students will no longer see it.")) return
    try {
      const supabase = createClient()
      const { error: deleteError } = await supabase.from("course_flashcards").delete().eq("id", card.id)
      if (deleteError) throw new Error(deleteError.message)
      await loadFlashcards()
    } catch (cause: any) {
      setError(cause?.message || "Could not delete the flashcard")
    }
  }

  const handleNext = () => {
    setIsFlipped(false)
    setCurrentIndex((prev) => (prev + 1) % flashcards.length)
  }

  const handlePrevious = () => {
    setIsFlipped(false)
    setCurrentIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length)
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading flashcards...</p>
        </CardContent>
      </Card>
    )
  }

  if (flashcards.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Brain className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No flashcards yet</h3>
          {canManage ? (
            <>
              <p className="mb-5 max-w-md text-sm text-muted-foreground">
                Create cards for this course; every enrolled student will see them in their Flashcards view.
              </p>
              <Button onClick={openNew}>
                <Plus className="mr-2 h-4 w-4" />
                New flashcard
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Your teacher has not added flashcards for this course yet.
            </p>
          )}
        </CardContent>
        {canManage ? <FlashcardDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editing={Boolean(editingId)}
          question={question}
          answer={answer}
          onQuestionChange={setQuestion}
          onAnswerChange={setAnswer}
          onSave={saveCard}
          isSaving={isSaving}
          error={error}
        /> : null}
      </Card>
    )
  }

  const currentCard = flashcards[currentIndex]

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Card {currentIndex + 1} of {flashcards.length}
        </p>
        <div className="flex items-center gap-2">
          {canManage ? (
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" />
              New flashcard
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => setIsFlipped(!isFlipped)}>
            <RotateCw className="mr-2 h-4 w-4" />
            Flip Card
          </Button>
        </div>
      </div>

      <Card className="min-h-[300px] cursor-pointer" onClick={() => setIsFlipped(!isFlipped)}>
        <CardHeader>
          <CardTitle className="text-center">{isFlipped ? "Answer" : "Question"}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center p-8">
          <p className="text-center text-lg leading-relaxed">{isFlipped ? currentCard.answer : currentCard.question}</p>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={handlePrevious} disabled={flashcards.length <= 1}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
        <Button variant="outline" onClick={handleNext} disabled={flashcards.length <= 1}>
          Next
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">All flashcards ({flashcards.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {error ? <p className="pb-2 text-sm text-destructive">{error}</p> : null}
            {flashcards.map((card) => (
              <div
                key={card.id}
                className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/60"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{card.question}</p>
                  <p className="truncate text-xs text-muted-foreground">{card.answer}</p>
                </div>
                <Button variant="ghost" size="icon" aria-label={`Edit ${card.question}`} onClick={() => openEdit(card)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${card.question}`}
                  className="text-destructive hover:text-destructive"
                  onClick={() => void deleteCard(card)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <FlashcardDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={Boolean(editingId)}
        question={question}
        answer={answer}
        onQuestionChange={setQuestion}
        onAnswerChange={setAnswer}
        onSave={saveCard}
        isSaving={isSaving}
        error={error}
      />
    </div>
  )
}

function FlashcardDialog({
  open,
  onOpenChange,
  editing,
  question,
  answer,
  onQuestionChange,
  onAnswerChange,
  onSave,
  isSaving,
  error,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: boolean
  question: string
  answer: string
  onQuestionChange: (value: string) => void
  onAnswerChange: (value: string) => void
  onSave: () => void | Promise<void>
  isSaving: boolean
  error: string | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit flashcard" : "New flashcard"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="flashcard-question">Question</Label>
            <Textarea
              id="flashcard-question"
              value={question}
              onChange={(event) => onQuestionChange(event.target.value)}
              placeholder="What should the student be asked?"
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="flashcard-answer">Answer</Label>
            <Textarea
              id="flashcard-answer"
              value={answer}
              onChange={(event) => onAnswerChange(event.target.value)}
              placeholder="The expected answer"
              rows={3}
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={() => void onSave()} disabled={isSaving || !question.trim() || !answer.trim()}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editing ? "Save changes" : "Create flashcard"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

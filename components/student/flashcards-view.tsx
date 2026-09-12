"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Brain, ChevronLeft, ChevronRight, RotateCw } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { mockFlashcards } from "@/lib/mock-data"
import type { Flashcard } from "@/lib/types"

interface FlashcardsViewProps {
  courseId: string
  studentId: string
}

export function FlashcardsView({ courseId, studentId }: FlashcardsViewProps) {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadFlashcards()
  }, [courseId, studentId])

  const loadFlashcards = async () => {
    const isDemoStudent = studentId.startsWith("mock-")

    try {
      const supabase = createClient()
      // If studentId contains "teacher", show all flashcards for the course (teacher view)
      const isTeacherView = studentId.includes("teacher")
      
      let query = supabase
        .from("flashcards")
        .select("*")
        .eq("course_id", courseId)
      
      if (!isTeacherView) {
        query = query.eq("student_id", studentId)
      }
      
      const { data } = await query.order("created_at", { ascending: false })

      if (data && data.length > 0) {
        setFlashcards(data)
      } else if (isDemoStudent) {
        const courseFlashcards = isTeacherView
          ? mockFlashcards.filter((f) => f.course_id === courseId)
          : mockFlashcards.filter(
              (f) => f.course_id === courseId && f.student_id === studentId
            )
        setFlashcards(courseFlashcards)
      } else {
        setFlashcards([])
      }
    } catch (error) {
      if (isDemoStudent) {
        const isTeacherView = studentId.includes("teacher")
        const courseFlashcards = isTeacherView
          ? mockFlashcards.filter((f) => f.course_id === courseId)
          : mockFlashcards.filter(
              (f) => f.course_id === courseId && f.student_id === studentId
            )
        setFlashcards(courseFlashcards)
      } else {
        setFlashcards([])
      }
    } finally {
      setIsLoading(false)
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
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Brain className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">No flashcards yet</h3>
        </CardContent>
      </Card>
    )
  }

  const currentCard = flashcards[currentIndex]

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Card {currentIndex + 1} of {flashcards.length}
        </p>
        <Button variant="outline" size="sm" onClick={() => setIsFlipped(!isFlipped)}>
          <RotateCw className="mr-2 h-4 w-4" />
          Flip Card
        </Button>
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
    </div>
  )
}

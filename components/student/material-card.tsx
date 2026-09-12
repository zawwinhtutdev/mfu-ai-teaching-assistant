"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sparkles, Brain, FileText, Loader2 } from "lucide-react"
import type { CourseMaterial } from "@/lib/types"

interface MaterialCardProps {
  material: CourseMaterial
  courseId: string
  studentId: string
}

export function MaterialCard({ material, courseId, studentId }: MaterialCardProps) {
  const [showContent, setShowContent] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false)

  const handleGenerateSummary = async () => {
    setIsGeneratingSummary(true)
    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId: material.id, courseId, studentId }),
      })
      const data = await response.json()
      setSummary(data.summary)
    } catch (error) {
      console.error("Failed to generate summary:", error)
    } finally {
      setIsGeneratingSummary(false)
    }
  }

  const handleGenerateFlashcards = async () => {
    setIsGeneratingFlashcards(true)
    try {
      const response = await fetch("/api/generate-flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId: material.id, courseId, studentId }),
      })
      const data = await response.json()
      alert(`Generated ${data.flashcards.length} flashcards! Check the Flashcards tab.`)
    } catch (error) {
      console.error("Failed to generate flashcards:", error)
    } finally {
      setIsGeneratingFlashcards(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{material.title}</CardTitle>
              <CardDescription>
                {material.material_type.charAt(0).toUpperCase() + material.material_type.slice(1)} •{" "}
                {new Date(material.created_at).toLocaleDateString()}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground line-clamp-3">{material.content}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowContent(true)}>
              <FileText className="mr-2 h-4 w-4" />
              View Full Material
            </Button>
            <Button variant="outline" size="sm" onClick={handleGenerateSummary} disabled={isGeneratingSummary}>
              {isGeneratingSummary ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Generate Summary
            </Button>
            <Button variant="outline" size="sm" onClick={handleGenerateFlashcards} disabled={isGeneratingFlashcards}>
              {isGeneratingFlashcards ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Brain className="mr-2 h-4 w-4" />
              )}
              Create Flashcards
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showContent} onOpenChange={setShowContent}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{material.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{material.content}</p>
            </div>
            {summary && (
              <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
                <h3 className="mb-2 flex items-center gap-2 font-semibold">
                  <Sparkles className="h-4 w-4" />
                  AI-Generated Summary
                </h3>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{summary}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

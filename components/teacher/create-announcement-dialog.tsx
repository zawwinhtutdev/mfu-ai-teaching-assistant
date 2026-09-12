"use client"

import type React from "react"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useRouter } from "next/navigation"
import { Upload, X } from "lucide-react"

interface CreateAnnouncementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  courseId: string
  onCreated?: () => void
}

export function CreateAnnouncementDialog({ open, onOpenChange, courseId, onCreated }: CreateAnnouncementDialogProps) {
  const [content, setContent] = useState("")
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...files])
    }
  }

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleClearAllFiles = () => {
    setSelectedFiles([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const trimmedContent = content.trim()
      if (!trimmedContent) {
        throw new Error("Announcement content is required")
      }

      let filesPayload: Array<{
        file_name: string
        file_url: string
        mime_type: string
        size_bytes: number
      }> = []

      if (selectedFiles.length > 0) {
        const form = new FormData()
        selectedFiles.forEach((file) => form.append("files", file))
        const uploadResponse = await fetch("/api/uploads", {
          method: "POST",
          body: form,
        })
        const uploadData = await uploadResponse.json()
        if (!uploadResponse.ok) {
          throw new Error(uploadData?.error || "Failed to upload files")
        }

        filesPayload = (uploadData?.files || []).map((file: any) => ({
          file_name: file?.name || "attachment",
          file_url: file?.url || "",
          mime_type: file?.type || "application/octet-stream",
          size_bytes: typeof file?.size === "number" ? file.size : 0,
        }))
      }

      const response = await fetch(`/api/courses/${courseId}/announcements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: trimmedContent,
          title: trimmedContent.slice(0, 80),
          files: filesPayload,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Failed to create announcement")
      }

      onOpenChange(false)
      setContent("")
      setSelectedFiles([])
      onCreated?.()
      router.refresh()
    } catch (error: any) {
      setError(error.message || "Failed to create announcement")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Announcement</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="announcement-content">Announcement</Label>
            <Textarea
              id="announcement-content"
              placeholder=""
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="announcement-file">Attach Files (Optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="announcement-file"
                type="file"
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.jpg,.jpeg,.png"
                multiple
              />
              <Label
                htmlFor="announcement-file"
                className="flex items-center gap-2 px-4 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex-1"
              >
                <Upload className="h-4 w-4 text-gray-500" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedFiles.length > 0 
                    ? `${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''} selected`
                    : "Choose files to attach"}
                </span>
              </Label>
              {selectedFiles.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleClearAllFiles}
                  className="h-10 w-10"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {selectedFiles.length > 0 && (
              <div className="space-y-2 mt-2">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 dark:text-gray-300 truncate">{file.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveFile(index)}
                      className="h-8 w-8 ml-2"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Posting..." : "Post Announcement"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

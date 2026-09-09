"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Copy, Check } from "lucide-react"

interface CreateCourseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teacherId: string
}

export function CreateCourseDialog({ open, onOpenChange, teacherId }: CreateCourseDialogProps) {
  const [title, setTitle] = useState("")
  const [code, setCode] = useState("")
  const [semester, setSemester] = useState("")
  const [sendInvites, setSendInvites] = useState(false)
  const [studentEmails, setStudentEmails] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const router = useRouter()

  const inviteLink = code.trim() 
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/studentportal/courses?enroll=${code.trim().toUpperCase()}`
    : ''

  const copyInviteLink = async () => {
    if (!inviteLink) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    } catch (err) {
      console.error('Failed to copy link:', err)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    try {
      const { data: course, error: courseError } = await supabase
        .from("courses")
        .insert({
          teacher_id: teacherId,
          title: title.trim(),
          code: code.trim().toUpperCase(),
          semester: semester.trim() || null,
        })
        .select()
        .single()

      if (courseError) {
        if (courseError.code === "23505") {
          throw new Error("A course with this code already exists.")
        }
        throw courseError
      }

      // Create default chatbot settings
      await supabase.from("chatbot_settings").insert({
        course_id: course.id,
        tone: "professional",
        ai_model: "google/gemini-3.8-flash",
      })

      // Queue invite notifications if requested.
      if (sendInvites && studentEmails.trim()) {
        const emailList = studentEmails
          .split(/[,\n]/)
          .map(email => email.trim())
          .filter(email => email.length > 0 && email.includes("@"))
        
        if (emailList.length > 0) {
          const courseInviteLink = `${window.location.origin}/studentportal/courses?enroll=${course.code}`

          const inviteResponse = await fetch("/api/send-course-invites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              courseId: course.id,
              courseCode: course.code,
              courseTitle: course.title,
              emails: emailList,
              inviteLink: courseInviteLink,
            }),
          })

          if (!inviteResponse.ok) {
            const inviteError = await inviteResponse.json().catch(() => null)
            console.error("Failed to queue course invites:", inviteError?.error || inviteResponse.statusText)
          }
        }
      }

      onOpenChange(false)
      setTitle("")
      setCode("")
      setSemester("")
      setSendInvites(false)
      setStudentEmails("")
      setCopiedLink(false)
      router.refresh()
    } catch (error: any) {
      setError(error.message || "Failed to create course")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-bold text-[#A81D24]">Create New Course</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Course Title</Label>
            <Input
              id="title"
              placeholder=""
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">Course Code</Label>
            <Input
              id="code"
              placeholder=""
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="semester">Semester</Label>
            <Input
              id="semester"
              placeholder="e.g. 1/2026, 2/2026, Summer 2026"
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
            />
          </div>
          <div className="space-y-4 border-t pt-4">
            {code.trim() && (
              <div className="space-y-2">
                <Label>Invite Link</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={inviteLink}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={copyInviteLink}
                    className="shrink-0"
                  >
                    {copiedLink ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                
              </div>
            )}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="sendInvites"
                checked={sendInvites}
                onCheckedChange={(checked) => setSendInvites(checked === true)}
              />
              <Label htmlFor="sendInvites" className="cursor-pointer font-normal">
                Send invite link to students
              </Label>
            </div>
            {sendInvites && (
              <div className="space-y-2">
                <Textarea
                  id="studentEmails"
                  placeholder={`Enter addresses line by line (any @mfu.ac.th domain):
studentid@lamduan.mfu.ac.th
teacher@mfu.ac.th`}
                  value={studentEmails}
                  onChange={(e) => setStudentEmails(e.target.value)}
                  rows={5}
                  className="font-mono text-sm"
                />
                
              </div>
            )}
          </div>
          {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Course"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import type { ChatbotSettings } from "@/lib/types"

interface ChatbotSettingsFormProps {
  courseId: string
  settings: ChatbotSettings | null
}

export function ChatbotSettingsForm({ courseId, settings }: ChatbotSettingsFormProps) {
  const [tone, setTone] = useState<"professional" | "friendly" | "casual" | "formal">(settings?.tone || "professional")
  const [aiModel, setAiModel] = useState(settings?.ai_model || "google/gemini-3.8-flash")
  const [systemPrompt, setSystemPrompt] = useState(settings?.system_prompt || "")
  const [gradingPolicy, setGradingPolicy] = useState(settings?.grading_policy || "")
  const [courseRules, setCourseRules] = useState(settings?.course_rules || "")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    const supabase = createClient()

    try {
      const { error: upsertError } = await supabase.from("chatbot_settings").upsert(
        {
          course_id: courseId,
          tone,
          ai_model: aiModel,
          system_prompt: systemPrompt.trim() || null,
          grading_policy: gradingPolicy.trim() || null,
          course_rules: courseRules.trim() || null,
        },
        { onConflict: "course_id" },
      )
      if (upsertError) throw upsertError

      setSuccess(true)
      router.refresh()
    } catch (error: any) {
      setError(error.message || "Failed to save settings")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="tone">Chatbot Tone</Label>
        <Select value={tone} onValueChange={(value: any) => setTone(value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="professional">Professional</SelectItem>
            <SelectItem value="friendly">Friendly</SelectItem>
            <SelectItem value="casual">Casual</SelectItem>
            <SelectItem value="formal">Formal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="aiModel">AI Model</Label>
        <Select value={aiModel} onValueChange={setAiModel}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="google/gemini-3.8-flash">Gemini 3.8 Flash (Fast & Efficient)</SelectItem>
            <SelectItem value="google/gemini-3.1-pro-preview">Gemini 3.1 Pro (Advanced)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="systemPrompt">System Prompt</Label>
        <Textarea
          id="systemPrompt"
          value={systemPrompt}
          onChange={(event) => setSystemPrompt(event.target.value)}
          placeholder="Optional course-specific system instruction for AI chat."
          rows={5}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="gradingPolicy">Grading Policy</Label>
        <Textarea
          id="gradingPolicy"
          value={gradingPolicy}
          onChange={(event) => setGradingPolicy(event.target.value)}
          placeholder="Optional grading policy text the AI should follow when answering students."
          rows={4}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="courseRules">Course Rules</Label>
        <Textarea
          id="courseRules"
          value={courseRules}
          onChange={(event) => setCourseRules(event.target.value)}
          placeholder="Optional course-specific rules or constraints for AI responses."
          rows={4}
        />
      </div>

      {error && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
      {success && (
        <div className="rounded-lg bg-green-100 p-3 text-sm text-green-700 dark:bg-green-900 dark:text-green-300">
          Settings saved successfully!
        </div>
      )}

      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Saving..." : "Save Settings"}
      </Button>
    </form>
  )
}

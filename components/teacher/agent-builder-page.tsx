"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Bot, Settings, BookOpen, Sparkles, Save } from "lucide-react"
import type { Profile, Course } from "@/lib/types"
import { useRouter } from "next/navigation"

interface AgentBuilderPageProps {
  profile: Profile
  courses: Course[]
}

/** Mirrors the local model the chat route actually runs. */
const DEFAULT_MODEL = process.env.NEXT_PUBLIC_DEFAULT_AI_MODEL || "qwen2.5:7b"

/** Models the dropdown offers. Anything else would render as an empty select. */
const MODELS = ["qwen2.5:7b", "gemini-2.5-flash"] as const

function normalizeModel(stored: string | null | undefined): string {
  if (!stored) return DEFAULT_MODEL
  // Rows predate the local-model default and still hold values like
  // "google/gemini-3.8-flash". Mapping them keeps the select populated
  // instead of showing nothing while the value is silently non-empty.
  const match = MODELS.find((model) => model === stored)
  if (match) return match
  if (/gemini/i.test(stored)) return "gemini-2.5-flash"
  return DEFAULT_MODEL
}

export function AgentBuilderPage({ profile, courses }: AgentBuilderPageProps) {
  const router = useRouter()
  const [selectedCourse, setSelectedCourse] = useState<string>(courses[0]?.id || "")
  const [tone, setTone] = useState<"professional" | "friendly" | "casual" | "formal">("professional")
  const [aiModel, setAiModel] = useState(DEFAULT_MODEL)
  const [systemPrompt, setSystemPrompt] = useState("")
  const [gradingPolicy, setGradingPolicy] = useState("")
  const [courseRules, setCourseRules] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingSettings, setIsLoadingSettings] = useState(false)

  const currentCourse = courses.find(c => c.id === selectedCourse)

  useEffect(() => {
    if (!selectedCourse) return

    let cancelled = false

    const loadSettings = async () => {
      setIsLoadingSettings(true)
      setError(null)
      try {
        // Server-side lookup: the demo portal hands out seed ids like
        // "course-ai-edu", which Postgres rejects as a uuid. The route resolves
        // either form to the real course row.
        const response = await fetch(
          `/api/courses/${encodeURIComponent(selectedCourse)}/chatbot-settings`,
        )
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load existing chatbot settings")
        }
        if (cancelled) return

        const data = payload?.settings
        setTone((data?.tone as any) || "professional")
        setAiModel(normalizeModel(data?.ai_model))
        setSystemPrompt(data?.system_prompt || "")
        setGradingPolicy(data?.grading_policy || "")
        setCourseRules(data?.course_rules || "")
      } catch (loadError: any) {
        if (!cancelled) {
          setError(loadError?.message || "Failed to load existing chatbot settings")
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSettings(false)
        }
      }
    }

    void loadSettings()

    return () => {
      cancelled = true
    }
  }, [selectedCourse])

  const handleSave = async () => {
    if (!selectedCourse) return
    
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch(
        `/api/courses/${encodeURIComponent(selectedCourse)}/chatbot-settings`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tone, aiModel, systemPrompt, gradingPolicy, courseRules }),
        },
      )
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save settings")
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      router.refresh()
    } catch (saveError: any) {
      setError(saveError?.message || "Failed to save settings")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="container mx-auto flex-1 px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Course Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Course</CardTitle>
              <CardDescription>Choose which course to configure the AI agent for</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a course" />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        <span>{course.code} - {course.title}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {currentCourse && (
            <>
              <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="general">
                    <Settings className="mr-2 h-4 w-4" />
                    General Settings
                  </TabsTrigger>
                  <TabsTrigger value="behavior">
                    <Bot className="mr-2 h-4 w-4" />
                    Behavior & Tone
                  </TabsTrigger>
                  <TabsTrigger value="rules">
                    <Sparkles className="mr-2 h-4 w-4" />
                    Course Rules
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="space-y-6 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>AI Model Selection</CardTitle>
                      <CardDescription>Choose the AI model for generating responses</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="aiModel">AI Model</Label>
                        <Select value={aiModel} onValueChange={setAiModel}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a model" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="qwen2.5:7b">qwen2.5:7b — local, private (default)</SelectItem>
                            <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash — cloud, if enabled</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">
                          The local 7B model is the default: answers stay on the machine and no content leaves the campus network.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="systemPrompt">System Prompt (Advanced)</Label>
                        <Textarea
                          id="systemPrompt"
                          placeholder="You are an AI Teaching Assistant for {course_name}. Answer student questions based on course materials..."
                          value={systemPrompt}
                          onChange={(e) => setSystemPrompt(e.target.value)}
                          rows={6}
                        />
                        <p className="text-sm text-muted-foreground">
                          Customize the system prompt to define how the AI should behave. Leave empty to use default.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="behavior" className="space-y-6 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Chatbot Tone & Behavior</CardTitle>
                      <CardDescription>Set how the AI assistant communicates with students</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="tone">Communication Tone</Label>
                        <Select value={tone} onValueChange={(value: any) => setTone(value)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="professional">Professional - Clear and respectful</SelectItem>
                            <SelectItem value="friendly">Friendly - Warm and approachable</SelectItem>
                            <SelectItem value="casual">Casual - Relaxed and conversational</SelectItem>
                            <SelectItem value="formal">Formal - Academic and structured</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-sm text-muted-foreground">
                          This affects how the AI assistant addresses students and explains concepts
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="rules" className="space-y-6 mt-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Grading Policy</CardTitle>
                      <CardDescription>Define course-specific grading policies for the AI to reference</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <Label htmlFor="gradingPolicy">Grading Policy Details</Label>
                        <Textarea
                          id="gradingPolicy"
                          placeholder="e.g., Assignments: 40%, Midterm: 30%, Final: 30%. Late submissions are penalized by 10% per day..."
                          value={gradingPolicy}
                          onChange={(e) => setGradingPolicy(e.target.value)}
                          rows={6}
                        />
                        <p className="text-sm text-muted-foreground">
                          The AI will use this information when students ask about grading, assignments, or deadlines
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Course-Specific Rules</CardTitle>
                      <CardDescription>Set additional rules and guidelines for the AI assistant</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <Label htmlFor="courseRules">Course Rules & Guidelines</Label>
                        <Textarea
                          id="courseRules"
                          placeholder="e.g., Always reference the course syllabus. Do not provide direct answers to assignment questions. Encourage students to show their work..."
                          value={courseRules}
                          onChange={(e) => setCourseRules(e.target.value)}
                          rows={6}
                        />
                        <p className="text-sm text-muted-foreground">
                          These rules will guide the AI's behavior when interacting with students
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              {/* Save Button */}
              <div className="flex justify-end gap-4">
                {error && (
                  <div className="flex-1 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="flex-1 rounded-lg bg-green-100 p-3 text-sm text-green-700 dark:bg-green-900 dark:text-green-300">
                    Settings saved successfully!
                  </div>
                )}
                <Button onClick={handleSave} disabled={isLoading || isLoadingSettings}>
                  <Save className="mr-2 h-4 w-4" />
                  {isLoading ? "Saving..." : isLoadingSettings ? "Loading..." : "Save Settings"}
                </Button>
              </div>
            </>
          )}
        </div>
    </div>
  )
}

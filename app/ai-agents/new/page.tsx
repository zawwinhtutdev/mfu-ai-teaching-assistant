"use client"

import { useMemo, useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Sparkles, Upload, Wand2 } from "lucide-react"
import type { Course } from "@/lib/types"

type CapabilityKey = "webSearch" | "canvas" | "image" | "code"
type ModelId =
  | "default"
  | "mfumodelbeta"
  | "mfumodelbeta2"
  | "mfumodel"
  | "aiteachingassistantmodel"
  | "google/gemini-3.1-pro-preview"
  | "google/gemini-3.8-flash"

interface AgentConfig {
  id: string
  name: string
  description: string
  instructions: string
  starters: string[]
  model: ModelId | ""
  capabilities: Record<CapabilityKey, boolean>
  knowledgeFiles: string[]
  selectedCourseId: string
}

const DEFAULT_AGENT: AgentConfig = {
  id: "",
  name: "",
  description: "",
  instructions: "",
  starters: [],
  model: "",
  capabilities: { webSearch: false, canvas: false, image: false, code: false },
  knowledgeFiles: [],
  selectedCourseId: "",
}

export default function AgentsBuilderPage() {
  const router = useRouter()
  const [agent, setAgent] = useState<AgentConfig>(DEFAULT_AGENT)
  const [starterInput, setStarterInput] = useState("")
  const [courses, setCourses] = useState<Course[]>([])
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    const loadCourses = async () => {
      try {
        const res = await fetch("/api/teacher/courses")
        if (!res.ok) return

        const payload = await res.json()
        setCourses(Array.isArray(payload?.courses) ? payload.courses : [])
      } catch {}
    }

    loadCourses()

    // Clear sample/test data from localStorage on mount
    try {
      localStorage.removeItem("agent-draft")
    } catch {}
  }, [])

  useEffect(() => {
    if (!agent.selectedCourseId && courses.length > 0) {
      setAgent((previous) => ({
        ...previous,
        selectedCourseId: courses[0].id,
      }))
    }
  }, [courses, agent.selectedCourseId])

  useEffect(() => {
    // Only save to localStorage if agent has meaningful content
    const hasContent = agent.name.trim() || agent.description.trim() || agent.instructions.trim() || agent.model
    if (hasContent) {
      try {
        localStorage.setItem("agent-draft", JSON.stringify(agent))
      } catch {}
    }
  }, [agent])

  const isReady = useMemo(() => {
    return agent.name.trim().length > 0 && agent.instructions.trim().length > 0 && !!agent.model
  }, [agent])

  const systemPromptPreview = useMemo(() => {
    const knowledge = agent.knowledgeFiles.length
      ? `Knowledge files: ${agent.knowledgeFiles.join(", ")}`
      : ``
    return [agent.description, agent.instructions, knowledge]
      .filter(Boolean)
      .join("\n\n")
      .trim()
  }, [agent])

  const addStarter = () => {
    const s = starterInput.trim()
    if (!s) return
    setAgent((a) => ({ ...a, starters: Array.from(new Set([...(a.starters || []), s])) }))
    setStarterInput("")
  }

  const removeStarter = (s: string) => {
    setAgent((a) => ({ ...a, starters: (a.starters || []).filter((x) => x !== s) }))
  }

  const toggleCap = (k: CapabilityKey) => {
    setAgent((a) => ({ ...a, capabilities: { ...a.capabilities, [k]: !a.capabilities[k] } }))
  }

  const fileInputId = "agent-knowledge-upload"
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const form = new FormData()
    Array.from(files).forEach((f) => form.append("files", f))
    try {
      const res = await fetch("/api/uploads", { method: "POST", body: form })
      if (!res.ok) return
      const { files: uploaded } = await res.json()
      setAgent((a) => ({
        ...a,
        knowledgeFiles: [
          ...a.knowledgeFiles,
          ...uploaded.map((u: any) => `${u.name} | ${u.url}`),
        ],
      }))
    } catch {}
  }

  const resetDraft = () => {
    setAgent(DEFAULT_AGENT)
    try {
      localStorage.removeItem("agent-draft")
    } catch {}
  }

  const persistToCollection = (cfg: AgentConfig) => {
    try {
      const raw = localStorage.getItem("agents")
      const list: AgentConfig[] = raw ? JSON.parse(raw) : []
      const idx = list.findIndex((x) => x.id === cfg.id)
      if (idx >= 0) list[idx] = cfg
      else list.unshift(cfg)
      localStorage.setItem("agents", JSON.stringify(list))
    } catch {}
  }

  const saveDraft = () => {
    const withId = { ...agent, id: agent.id || `agent-${Date.now()}` }
    setAgent(withId)
    try {
      localStorage.setItem("agent-draft", JSON.stringify(withId))
      persistToCollection(withId)
    } catch {}
  }

  const createAgent = () => {
    setIsCreating(true)
    const withId = { ...agent, id: agent.id || `agent-${Date.now()}` }
    setAgent(withId)
    try {
      localStorage.setItem("agent-draft", JSON.stringify(withId))
      persistToCollection(withId)
      // Clear draft after saving
      localStorage.removeItem("agent-draft")
      // Random delay between 2-5 seconds before navigating
      const delay = Math.floor(Math.random() * 3000) + 2000 // Random between 2000ms and 5000ms
      setTimeout(() => {
        router.push("/ai-agents")
      }, delay)
    } catch {}
  }

  return (
    <div className="flex min-h-screen flex-col bg-linear-to-br from-amber-50 via-white to-orange-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="container mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-red-600" />
            <h1 className="text-xl sm:text-2xl font-bold">Create Agent</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={resetDraft}>Reset</Button>
            <Button variant="outline" onClick={saveDraft}>Save draft</Button>
            <Button 
              disabled={!isReady || isCreating} 
              onClick={createAgent}
              className={isCreating ? "bg-primary/70 opacity-80 scale-95 shadow-inner" : ""}
            >
              <Wand2 className="mr-2 h-4 w-4" />
              Create Agent
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border">
            <CardHeader>
              <CardTitle>Configure</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <Input
                  placeholder="Agent name"
                  value={agent.name}
                  onChange={(e) => setAgent((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={agent.description}
                  onChange={(e) => setAgent((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Instructions</label>
                <Textarea
                  rows={8}
                  value={agent.instructions}
                  onChange={(e) => setAgent((prev) => ({ ...prev, instructions: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Knowledge</label>
                  <div className="flex items-center gap-2">
                    <div className="relative inline-flex">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload files
                      </button>
                      <input
                        ref={fileInputRef}
                        id={fileInputId}
                        type="file"
                        multiple
                        onChange={(e) => handleUpload(e.currentTarget.files)}
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      />
                    </div>
                  </div>
                  {!!agent.knowledgeFiles.length && (
                    <ul className="list-disc pl-5 text-sm">
                      {agent.knowledgeFiles.map((f) => {
                        const parts = f.split(" | ")
                        const label = parts[0]
                        const url = parts[1]
                        return url ? (
                          <li key={f}>
                            <a className="underline" href={url} target="_blank" rel="noreferrer">{label}</a>
                          </li>
                        ) : (
                          <li key={f}>{f}</li>
                        )
                      })}
                    </ul>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Lecture</label>
                  <Select
                    value={agent.selectedCourseId}
                    onValueChange={(val) => setAgent((prev) => ({ ...prev, selectedCourseId: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select course" />
                    </SelectTrigger>
                    <SelectContent>
                      {courses.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.code} - {course.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <label className="text-sm font-medium">Model</label>
                <Select
                  value={agent.model}
                  onValueChange={(val) => setAgent({ ...agent, model: val as ModelId })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">default</SelectItem>
                    <SelectItem value="mfumodelbeta">mfumodelbeta</SelectItem>
                    <SelectItem value="mfumodelbeta2">mfumodelbeta2</SelectItem>
                    <SelectItem value="mfumodel" disabled>mfumodel</SelectItem>
                    <SelectItem value="aiteachingassistantmodel" disabled>aiteachingassistantmodel</SelectItem>
                    <SelectItem value="google/gemini-3.1-pro-preview">google/gemini-3.1-pro-preview</SelectItem>
                    <SelectItem value="google/gemini-3.8-flash">google/gemini-3.8-flash</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            </CardContent>
          </Card>

          <Card className="border">
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground">Model</div>
                <div className="font-medium">{agent.model || "Not set"}</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

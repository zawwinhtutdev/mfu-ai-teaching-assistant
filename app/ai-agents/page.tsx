"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Sparkles, Plus, Trash2, Wand2 } from "lucide-react"

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
  knowledgeFiles: string[]
}

export default function AgentsListPage() {
  const router = useRouter()
  const [agents, setAgents] = useState<AgentConfig[]>([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem("agents")
      setAgents(raw ? JSON.parse(raw) : [])
    } catch {
      setAgents([])
    }
  }, [])

  const deleteAgent = (id: string) => {
    try {
      const next = agents.filter((a) => a.id !== id)
      localStorage.setItem("agents", JSON.stringify(next))
      setAgents(next)
    } catch {}
  }

  const useInChat = (agent: AgentConfig) => {
    const systemPrompt = [agent.description, agent.instructions].filter(Boolean).join("\n\n").trim()
    const payload = { id: agent.id, name: agent.name, model: agent.model, systemPrompt, starters: agent.starters }
    try { localStorage.setItem("agent-active", JSON.stringify(payload)) } catch {}
    window.location.href = "/chat"
  }

  const hasAgents = useMemo(() => agents.length > 0, [agents])

  return (
    <div className="flex min-h-screen flex-col bg-linear-to-br from-amber-50 via-white to-orange-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="container mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Sparkles className="h-5 w-5 text-red-600" />
            <h1 className="text-xl sm:text-2xl font-bold">AI Agents</h1>
          </div>
          <Button asChild>
            <Link href="/ai-agents/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Agent
            </Link>
          </Button>
        </div>

        {hasAgents ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agents.map((a) => (
              <Card key={a.id} className="border">
                <CardHeader>
                  <CardTitle className="text-base">{a.name || "Untitled Agent"}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm text-muted-foreground line-clamp-3">{a.description || "No description"}</div>
                  <div className="text-xs text-muted-foreground">Model: {a.model || "Not set"}</div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href="/ai-agents/new" onClick={() => { try { localStorage.setItem("agent-draft", JSON.stringify(a)) } catch {} }}>
                        Edit
                      </Link>
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => deleteAgent(a.id)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                    <Button size="sm" onClick={() => useInChat(a)}>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Use in Chat
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="border">
            <CardContent className="py-10 text-center">
              <div className="mb-2 text-sm text-muted-foreground">No agents yet</div>
              <Button asChild>
                <Link href="/ai-agents/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create your first agent
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}


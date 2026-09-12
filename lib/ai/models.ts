export type ModelConfig = {
  id: string
  label: string
  providerModel: string
  systemPrompt: string
  maxOutputTokens?: number
  temperature?: number
  enabled?: boolean
}

const GOOGLE_MODEL_ALIASES: Record<string, string> = {
  "google/gemini-2.5-flash": "google/gemini-3.8-flash",
  "google/gemini-2.5-flash-lite": "google/gemini-3.8-flash",
  "google/gemini-3-flash": "google/gemini-3.8-flash",
  "google/gemini-3-flash-preview": "google/gemini-3.8-flash",
  "google/gemini-2.5-pro": "google/gemini-3.1-pro-preview",
  "google/gemini-3-pro-preview": "google/gemini-3.1-pro-preview",
}

export const normalizeGoogleProviderModel = (providerModel: string) =>
  GOOGLE_MODEL_ALIASES[providerModel] ?? providerModel

export const MODEL_CONFIGS: ModelConfig[] = [
  {
    id: "default",
    label: "Default Assistant",
    providerModel: "google/gemini-3.8-flash",
    systemPrompt: `You are a helpful and concise AI assistant. Be direct and friendly.`,
    maxOutputTokens: 600,
    temperature: 0.5,
    enabled: true,
  },
  {
    id: "mfumodelbeta",
    label: "MFU Info Guide",
    providerModel: "google/gemini-3.1-pro-preview",
    systemPrompt: `You are MFU Guide about the university and its information. Focus on MFU: campus, services, offices, policies, contacts, admissions, fees, facilities, events. If unrelated to MFU, politely decline and steer back to MFU topics. Identify yourself as "MFU Guide".`,
    maxOutputTokens: 1200,
    temperature: 0.6,
    enabled: true,
  },
  {
    id: "mfumodelbeta2",
    label: "MFU Lecture Assistant",
    providerModel: "google/gemini-3.1-pro-preview",
    systemPrompt: `You are MFU Guide about studying and courses. Help with lectures, coursework, summaries, explanations, study tips, and course planning for MFU students. Avoid non-study topics. Identify yourself as "MFU Guide".`,
    maxOutputTokens: 1400,
    temperature: 0.55,
    enabled: true,
  },
  {
    id: "mfuaiteachingassistant",
    label: "MFU AI Teaching Assistant",
    providerModel: "google/gemini-3.1-pro-preview",
    systemPrompt: `You are an MFU AI Teaching Assistant focused only on studying. Assist with concepts, assignments, quizzes, study strategies, and explanations. Refuse to answer unrelated topics and guide users back to study-related questions.`,
    maxOutputTokens: 1200,
    temperature: 0.5,
    enabled: false,
  },
  {
    id: "mfumodel",
    label: "MFU Special Info",
    providerModel: "google/gemini-3.1-pro-preview",
    systemPrompt: `You provide special information about MFU (internal facts, highlights, unique programs, notable resources). Keep responses MFU-specific; when unsure, recommend official MFU sources. Identify yourself as "MFU Guide".`,
    maxOutputTokens: 1200,
    temperature: 0.55,
    enabled: false,
  },
]

export const getModelConfig = (id?: string) =>
  MODEL_CONFIGS.find((m) => m.id === id) ?? MODEL_CONFIGS[0]

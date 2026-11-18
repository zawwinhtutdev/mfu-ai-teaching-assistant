import { createClient } from "@/lib/supabase/client"

/** Vercel serverless rejects request bodies above ~4.5 MB before route code runs. */
export const MAX_INLINE_MATERIAL_UPLOAD_BYTES = 4_000_000

/** Matches the `knowledge` bucket limit in Supabase (`52428800`). */
export const STORAGE_MAX_MATERIAL_BYTES = 52_428_800

export type StoredMaterialFileRef = {
  path: string
  fileName: string
  mimeType: string
  publicUrl: string
}

export async function readApiErrorMessage(response: Response, fallback: string): Promise<string> {
  const text = await response.text()
  try {
    const data = JSON.parse(text) as { error?: string }
    return data?.error || fallback
  } catch {
    if (response.status === 413 || /request entity too large/i.test(text)) {
      return "This file is too large to send through the app server (about 4 MB max). Sign in with your university account so the file can upload directly to storage, or use a smaller PDF."
    }
    const trimmed = text.trim()
    return trimmed ? trimmed.slice(0, 240) : fallback
  }
}

export async function uploadCourseMaterialFilesToStorage(
  courseId: string,
  files: File[],
): Promise<StoredMaterialFileRef[] | null> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) return null

  const uploaded: StoredMaterialFileRef[] = []

  for (const file of files) {
    if (file.size > STORAGE_MAX_MATERIAL_BYTES) {
      throw new Error(`"${file.name}" exceeds the 50 MB storage limit.`)
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const path = `${courseId}/${Date.now()}-${safeName}`

    const { error } = await supabase.storage.from("knowledge").upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    })

    if (error) {
      throw new Error(error.message || `Failed to upload ${file.name}`)
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("knowledge").getPublicUrl(path)

    uploaded.push({
      path,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      publicUrl,
    })
  }

  return uploaded
}
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import crypto from "crypto"

export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const form = await req.formData()
    const files = form.getAll("files") as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    const bucket = "knowledge"
    const results: Array<{
      path: string
      url: string
      name: string
      size: number
      type: string
    }> = []

    for (const file of files) {
      const arrayBuf = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuf)
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin"
      const hash = crypto.createHash("sha1").update(buffer).digest("hex").slice(0, 10)
      const ownerPrefix = user?.id || "public"
      const objectPath = `${ownerPrefix}/${Date.now()}-${hash}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(objectPath, buffer, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        })

      if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 500 })
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(objectPath)

      results.push({
        path: objectPath,
        url: publicUrl,
        name: file.name,
        size: file.size,
        type: file.type,
      })
    }

    return NextResponse.json({ files: results })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Upload failed" }, { status: 500 })
  }
}



import { NextResponse } from "next/server"
import crypto from "crypto"

import { resolvePrincipal } from "@/lib/server/principal"
import { createServiceRoleClient, hasServiceRoleKey } from "@/lib/supabase/admin"

export const maxDuration = 30

/**
 * Generic file upload used by announcements, chat attachments, and agent builder.
 *
 * Storage RLS on the `knowledge` bucket only allows course-scoped paths for
 * direct client writes. This route runs after auth checks and uses the service
 * role when available so attachments can live under the caller's id prefix.
 */
export async function POST(req: Request) {
  try {
    const principal = await resolvePrincipal()
    if (!principal) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const form = await req.formData()
    const files = form.getAll("files").filter((item): item is File => item instanceof File)

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    const admin = hasServiceRoleKey() ? createServiceRoleClient() : null
    if (!admin) {
      return NextResponse.json(
        {
          error:
            "File upload is not configured on this server (missing service role key). Contact the administrator.",
        },
        { status: 503 },
      )
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
      const objectPath = `attachments/${principal.userId}/${Date.now()}-${hash}.${ext}`

      const { error: uploadError } = await admin.storage.from(bucket).upload(objectPath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      })

      if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 500 })
      }

      const {
        data: { publicUrl },
      } = admin.storage.from(bucket).getPublicUrl(objectPath)

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

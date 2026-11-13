import { NextResponse } from "next/server"

import { resolvePrincipal, clientForPrincipal } from "@/lib/server/principal"
import { createServiceRoleClient, hasServiceRoleKey } from "@/lib/supabase/admin"

/**
 * Profile picture upload.
 *
 * Accepts a single image, stores it in the `avatars` bucket under the caller's
 * own id, and points `profiles.avatar_url` at the public URL.
 *
 * Validation happens here rather than relying on the bucket alone: the bucket
 * enforces size and MIME type, but a clear message ("that is a 5 MB PDF") beats
 * a storage error surfaced as a 500.
 */

const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"])
const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
}

export async function POST(req: Request) {
  try {
    const principal = await resolvePrincipal()
    if (!principal) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // A demo account has a seed id, not a profile row, so there is nothing to
    // store against. Say so rather than failing on a foreign key later.
    if (!principal.isPersistable) {
      return NextResponse.json(
        { error: "Demo accounts cannot upload a photo. Sign in with a university account." },
        { status: 403 },
      )
    }

    const form = await req.formData()
    const file = form.get("avatar")
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 })
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Use a PNG, JPEG, or WebP image." },
        { status: 400 },
      )
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 2 MB.` },
        { status: 400 },
      )
    }

    // The upload endpoint writes with the service role: the storage RLS policy
    // keys on auth.uid(), which is null for a service-role request, so policy
    // would reject the write. The path is still namespaced by the caller's id,
    // which is the property that actually prevents one user overwriting
    // another's picture.
    const admin = hasServiceRoleKey() ? createServiceRoleClient() : null
    const supabase = await clientForPrincipal(principal)
    const storage = admin ?? supabase

    const extension = EXTENSION_BY_TYPE[file.type] ?? "png"
    // A stable filename per user keeps the bucket from accumulating every
    // historical avatar, and the cache-busting query below handles CDN reuse.
    const path = `${principal.userId}/avatar.${extension}`

    const bytes = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await storage.storage
      .from("avatars")
      .upload(path, bytes, { contentType: file.type, upsert: true })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: publicUrl } = storage.storage.from("avatars").getPublicUrl(path)
    // Version the URL so a replaced picture is not served from cache.
    const avatarUrl = `${publicUrl.publicUrl}?v=${Date.now()}`

    const { error: updateError } = await storage
      .from("profiles")
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq("id", principal.userId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ avatarUrl })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Could not upload the photo" },
      { status: 500 },
    )
  }
}

/** Remove the caller's profile picture. */
export async function DELETE() {
  try {
    const principal = await resolvePrincipal()
    if (!principal) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!principal.isPersistable) {
      return NextResponse.json({ error: "Demo accounts cannot change their photo." }, { status: 403 })
    }

    const admin = hasServiceRoleKey() ? createServiceRoleClient() : null
    const supabase = await clientForPrincipal(principal)
    const storage = admin ?? supabase

    // Remove both possible extensions: the user may have switched format.
    const paths = ["png", "jpg", "webp"].map((ext) => `${principal.userId}/avatar.${ext}`)
    await storage.storage.from("avatars").remove(paths)

    const { error } = await storage
      .from("profiles")
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq("id", principal.userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Could not remove the photo" },
      { status: 500 },
    )
  }
}

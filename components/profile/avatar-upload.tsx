"use client"

/**
 * Profile picture uploader, shared by the teacher and student settings pages.
 *
 * Shows the current picture (or initials), lets the user pick an image, previews
 * it before saving, and can remove it. Upload posts to `/api/profile/avatar`,
 * which stores the file and updates `profiles.avatar_url`.
 */

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Camera, Loader2, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

interface AvatarUploadProps {
  /** Current stored picture, if any. */
  avatarUrl?: string | null
  /** Used for the initials fallback. */
  fullName?: string | null
  email: string
}

const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED = ["image/png", "image/jpeg", "image/webp"]

export function AvatarUpload({ avatarUrl, fullName, email }: AvatarUploadProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initials =
    fullName
      ?.split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || email[0]?.toUpperCase() || "U"

  const displayUrl = preview ?? avatarUrl ?? null

  const pick = () => inputRef.current?.click()

  const upload = async (file: File) => {
    setError(null)

    // Validate before the round trip so an oversized file fails instantly.
    if (!ALLOWED.includes(file.type)) {
      setError("Use a PNG, JPEG, or WebP image.")
      return
    }
    if (file.size > MAX_BYTES) {
      setError(`That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 2 MB.`)
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    setIsUploading(true)

    try {
      const form = new FormData()
      form.append("avatar", file)

      const res = await fetch("/api/profile/avatar", { method: "POST", body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Could not upload the photo")

      setPreview(data.avatarUrl ?? objectUrl)
      router.refresh()
    } catch (cause: any) {
      setError(cause?.message || "Could not upload the photo")
      setPreview(null)
    } finally {
      setIsUploading(false)
      // Let the file input fire again for the same file.
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const remove = async () => {
    setError(null)
    setIsUploading(true)
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Could not remove the photo")
      setPreview(null)
      router.refresh()
    } catch (cause: any) {
      setError(cause?.message || "Could not remove the photo")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar className="h-16 w-16">
        {displayUrl ? <AvatarImage src={displayUrl} alt={fullName || "Profile picture"} /> : null}
        <AvatarFallback className="text-lg text-[#A81D24]">{initials}</AvatarFallback>
      </Avatar>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void upload(file)
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={pick} disabled={isUploading}>
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Camera className="mr-2 h-4 w-4" />
            )}
            {displayUrl ? "Change photo" : "Upload photo"}
          </Button>
          {displayUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void remove()}
              disabled={isUploading}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPEG, or WebP. Up to 2 MB.</p>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  )
}

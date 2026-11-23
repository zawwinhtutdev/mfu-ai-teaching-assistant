"use client"

/**
 * Create an account with a chosen role (administrator).
 *
 * The role is chosen explicitly rather than derived from the email domain. That
 * derivation exists so public signup can never mint an admin — this dialog is the
 * trusted path an existing admin uses instead.
 */

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

type Role = "student" | "teacher" | "admin"

interface AddUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Role pre-selected from the active tab. */
  defaultRole?: Role
  onCreated: () => void
}

export function AddUserDialog({ open, onOpenChange, defaultRole = "student", onCreated }: AddUserDialogProps) {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Reset on open so a previous attempt's values never leak into a new one.
  useEffect(() => {
    if (!open) return
    setEmail("")
    setError(null)
  }, [open])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: defaultRole }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Could not create the account")

      onOpenChange(false)
      onCreated()
    } catch (cause: any) {
      setError(cause?.message || "Could not create the account")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add account</DialogTitle>
          <DialogDescription>
            Creates a confirmed account for the role shown in Members (Students, Teachers, or Administrators).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-email">Email</Label>
            <Input
              id="new-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="firstname.last@mfu.ac.th"
              required
            />
            <p className="text-xs text-muted-foreground">
              Must be a university address — @mfu.ac.th or a subdomain such as @lamduan.mfu.ac.th.
            </p>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create account
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

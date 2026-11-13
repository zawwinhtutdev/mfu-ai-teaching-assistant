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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"

type Role = "student" | "teacher" | "admin"

interface AddUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Role pre-selected from the active tab. */
  defaultRole?: Role
  onCreated: () => void
}

const ROLE_HELP: Record<Role, string> = {
  student: "Can join courses and use the AI assistant.",
  teacher: "Owns courses; can upload materials and post to them.",
  admin: "Full console access, including creating other accounts.",
}

export function AddUserDialog({ open, onOpenChange, defaultRole = "student", onCreated }: AddUserDialogProps) {
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<Role>(defaultRole)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Reset on open so a previous attempt's values never leak into a new one.
  useEffect(() => {
    if (!open) return
    setEmail("")
    setFullName("")
    setPassword("")
    setRole(defaultRole)
    setError(null)
  }, [open, defaultRole])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setError(null)

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName, password, role }),
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
            The account is created confirmed, so the person can sign in immediately with this password.
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

          <div className="space-y-2">
            <Label htmlFor="new-name">Full name</Label>
            <Input
              id="new-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-role">Role</Label>
            <Select value={role} onValueChange={(value) => setRole(value as Role)}>
              <SelectTrigger id="new-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="admin">Administrator</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{ROLE_HELP[role]}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">Temporary password</Label>
            <Input
              id="new-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              required
            />
            <p className="text-xs text-muted-foreground">
              Shown in plain text so you can pass it on. Ask them to change it after signing in.
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

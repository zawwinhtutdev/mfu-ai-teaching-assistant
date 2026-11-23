"use client"

/**
 * CSV import for user accounts.
 *
 * Three explicit steps so nothing is written before the administrator has seen
 * the parsed rows: choose a file, review per-row statuses from the dry run, then
 * commit. The file never leaves the browser except to this app's own route.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle2, Download, FileUp, Loader2, Upload } from "lucide-react"

type Role = "student" | "teacher" | "admin"

type Status = "ready" | "invalid" | "existing" | "created" | "failed"

type ImportRow = {
  line: number
  email: string
  full_name: string
  role: string
  status: Status
  message?: string
}

type Summary = {
  total: number
  ready: number
  invalid: number
  existing: number
  admins: number
  created: number
  failed: number
}

type ImportResult = {
  dryRun: boolean
  summary: Summary
  rows: ImportRow[]
  credentials?: Array<{ email: string; password: string }>
  requiresAdminConfirmation?: boolean
  adminCount?: number
  error?: string
}

const TEMPLATE_HEADERS = ["email", "full_name", "role"]

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const escape = (value: string | number) => {
    const raw = String(value ?? "")
    const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }
  const body = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join("\r\n")
  const blob = new Blob([`\uFEFF${body}\r\n`], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const STATUS_STYLE: Record<Status, { label: string; className: string }> = {
  ready: { label: "Ready", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  invalid: { label: "Invalid", className: "bg-red-50 text-red-700 border-red-200" },
  existing: { label: "Exists", className: "bg-amber-50 text-amber-700 border-amber-200" },
  created: { label: "Created", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  failed: { label: "Failed", className: "bg-red-50 text-red-700 border-red-200" },
}

interface ImportUsersDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Role applied when a row has no role column. */
  defaultRole?: Role
  onImported: () => void
}

export function ImportUsersDialog({ open, onOpenChange, defaultRole = "student", onImported }: ImportUsersDialogProps) {
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload")
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ImportResult | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [confirmAdmins, setConfirmAdmins] = useState(false)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const reset = useCallback(() => {
    setStep("upload")
    setFile(null)
    setPreview(null)
    setResult(null)
    setConfirmAdmins(false)
    setError(null)
    setIsBusy(false)
    if (inputRef.current) inputRef.current.value = ""
  }, [])

  useEffect(() => {
    if (open) reset()
  }, [open, reset])

  const send = useCallback(
    async (selected: File, dryRun: boolean, adminsConfirmed: boolean) => {
      const form = new FormData()
      form.append("file", selected)
      form.append("dryRun", dryRun ? "1" : "0")
      form.append("defaultRole", defaultRole)
      form.append("confirmAdmins", adminsConfirmed ? "1" : "0")

      const res = await fetch("/api/admin/users/import", { method: "POST", body: form })
      const data = (await res.json().catch(() => ({}))) as ImportResult
      if (!res.ok) {
        const cause: any = new Error(data?.error || "Could not read that file")
        cause.requiresAdminConfirmation = Boolean(data?.requiresAdminConfirmation)
        throw cause
      }
      return data
    },
    [defaultRole],
  )

  const validateFile = async (selected: File) => {
    setFile(selected)
    setIsBusy(true)
    setError(null)
    try {
      const data = await send(selected, true, false)
      setPreview(data)
      setStep("preview")
      setConfirmAdmins(false)
    } catch (cause: any) {
      setError(cause?.message || "Could not read that file")
      setFile(null)
    } finally {
      setIsBusy(false)
    }
  }

  const commit = async () => {
    if (!file) return
    setIsBusy(true)
    setError(null)
    try {
      const data = await send(file, false, confirmAdmins)
      setResult(data)
      setStep("done")
      onImported()
    } catch (cause: any) {
      if (cause?.requiresAdminConfirmation) {
        setError(cause.message)
      } else {
        setError(cause?.message || "Import failed")
      }
    } finally {
      setIsBusy(false)
    }
  }

  const summary = result?.summary ?? preview?.summary
  const rows = result?.rows ?? preview?.rows ?? []
  const problemRows = rows.filter((row) => row.status === "invalid" || row.status === "failed")
  const needsAdminConfirmation = Boolean(summary?.admins)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import accounts from CSV</DialogTitle>
          <DialogDescription>
            Columns: <code>email</code> (required), <code>full_name</code> and <code>role</code> (optional, defaults
            to {defaultRole}). Existing addresses are skipped.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {step === "upload" && (
          <div className="space-y-4">
            <input
              ref={inputRef}
              id="users-csv"
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const selected = event.target.files?.[0]
                if (selected) void validateFile(selected)
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={isBusy}
              className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center transition-colors hover:bg-muted/40"
            >
              {isBusy ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <FileUp className="h-6 w-6 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">{isBusy ? "Reading file…" : "Choose a CSV file"}</span>
              <span className="text-xs text-muted-foreground">Up to 1,000 rows · 2 MB</span>
            </button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsv(
                  "users-import-template.csv",
                  TEMPLATE_HEADERS,
                  [
                    ["kanya.wong@lamduan.mfu.ac.th", "Kanya Wong", "student"],
                    ["new.teacher@mfu.ac.th", "Dr. New Teacher", "teacher"],
                  ],
                )
              }
            >
              <Download className="mr-2 h-4 w-4" />
              Download template
            </Button>
          </div>
        )}

        {step === "preview" && summary && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline">{summary.total} rows</Badge>
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">{summary.ready} ready</Badge>
              {summary.existing > 0 && (
                <Badge className="border-amber-200 bg-amber-50 text-amber-700">{summary.existing} already exist</Badge>
              )}
              {summary.invalid > 0 && (
                <Badge className="border-red-200 bg-red-50 text-red-700">{summary.invalid} invalid</Badge>
              )}
              {summary.admins > 0 && (
                <Badge className="border-purple-200 bg-purple-50 text-purple-700">
                  {summary.admins} administrator{summary.admins === 1 ? "" : "s"}
                </Badge>
              )}
            </div>

            <div className="max-h-72 overflow-auto rounded-md border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted/80 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Line</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 200).map((row) => (
                    <tr key={row.line} className="border-t">
                      <td className="px-3 py-1.5 text-muted-foreground">{row.line}</td>
                      <td className="max-w-[220px] truncate px-3 py-1.5">{row.email || "—"}</td>
                      <td className="max-w-[160px] truncate px-3 py-1.5">{row.full_name || "—"}</td>
                      <td className="px-3 py-1.5">{row.role || "—"}</td>
                      <td className="px-3 py-1.5">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${STATUS_STYLE[row.status]?.className ?? ""}`}
                          title={row.message}
                        >
                          {STATUS_STYLE[row.status]?.label ?? row.status}
                        </span>
                        {row.message && row.status !== "ready" && (
                          <span className="ml-2 text-[11px] text-muted-foreground">{row.message}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 200 && (
              <p className="text-xs text-muted-foreground">Showing the first 200 rows of {rows.length}.</p>
            )}

            {needsAdminConfirmation && (
              <label className="flex items-start gap-2 rounded-md border border-purple-200 bg-purple-50/60 px-3 py-2 text-xs text-purple-900">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={confirmAdmins}
                  onChange={(event) => setConfirmAdmins(event.target.checked)}
                />
                <span>
                  This file creates {summary.admins} administrator account{summary.admins === 1 ? "" : "s"} with full
                  console access. I have reviewed those rows.
                </span>
              </label>
            )}
          </div>
        )}

        {step === "done" && summary && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">
                  {summary.created} account{summary.created === 1 ? "" : "s"} created
                  {summary.existing > 0 ? ` · ${summary.existing} skipped` : ""}
                  {summary.failed > 0 ? ` · ${summary.failed} failed` : ""}
                </p>
                <p className="text-xs">
                  Share the generated passwords with each person — they are shown only in this result and are not
                  stored anywhere.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {result?.credentials && result.credentials.length > 0 && (
                <Button
                  size="sm"
                  onClick={() =>
                    downloadCsv(
                      `users-credentials-${new Date().toISOString().slice(0, 10)}.csv`,
                      ["email", "password"],
                      result.credentials!.map((credential) => [credential.email, credential.password]),
                    )
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download credentials ({result.credentials.length})
                </Button>
              )}
              {problemRows.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    downloadCsv(
                      `users-import-errors-${new Date().toISOString().slice(0, 10)}.csv`,
                      ["line", "email", "name", "role", "status", "message"],
                      problemRows.map((row) => [row.line, row.email, row.full_name, row.role, row.status, row.message ?? ""]),
                    )
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download failed rows ({problemRows.length})
                </Button>
              )}
            </div>

            <div className="max-h-56 overflow-auto rounded-md border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted/80 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.line} className="border-t">
                      <td className="max-w-[240px] truncate px-3 py-1.5">{row.email}</td>
                      <td className="px-3 py-1.5">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${STATUS_STYLE[row.status]?.className ?? ""}`}
                        >
                          {STATUS_STYLE[row.status]?.label ?? row.status}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">{row.message ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "upload" && (
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isBusy}>
              Cancel
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="ghost" onClick={() => reset()} disabled={isBusy}>
                Back
              </Button>
              <Button
                onClick={() => void commit()}
                disabled={isBusy || !summary?.ready || (needsAdminConfirmation && !confirmAdmins)}
              >
                {isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Create {summary?.ready ?? 0} account{summary?.ready === 1 ? "" : "s"}
              </Button>
            </>
          )}
          {step === "done" && <Button onClick={() => onOpenChange(false)}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

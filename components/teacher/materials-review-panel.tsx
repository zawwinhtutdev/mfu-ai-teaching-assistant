"use client"

/**
 * Teacher-side material review.
 *
 * Spec §2.2 requires that AI-generated summaries and course content be edited
 * or approved before release. The RLS policy in
 * `20261118001000_study_assets_and_approval_gate.sql` enforces the gate on the
 * database side; this panel is how a teacher moves a material through it.
 *
 * The layout mirrors the student Materials tab: one compact row per file with
 * the review actions behind the row menu, so both portals read the same way.
 */

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CheckCircle2, Eye, EyeOff, FileText, MoreVertical, Upload } from "lucide-react"
import type { CourseMaterial } from "@/lib/types"
import { UploadMaterialDialog } from "./upload-material-dialog"
import { FilePreviewDialog, type PreviewFile } from "@/components/shared/file-preview-dialog"

type ApprovalStatus = "draft" | "approved" | "published"

const STATUS_LABEL: Record<ApprovalStatus, string> = {
  draft: "Draft",
  approved: "Approved",
  published: "Published",
}

const STATUS_STYLE: Record<ApprovalStatus, string> = {
  draft: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  approved: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200",
  published: "bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200",
}

interface MaterialsReviewPanelProps {
  courseId: string
  materials: CourseMaterial[]
}

export function MaterialsReviewPanel({ courseId, materials: initialMaterials }: MaterialsReviewPanelProps) {
  const [materials, setMaterials] = useState(initialMaterials)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [preview, setPreview] = useState<PreviewFile | null>(null)

  /** PDFs open in a new tab; other formats use the in-app preview dialog. */
  const openFile = (material: CourseMaterial) => {
    const url = material.file_url
    if (!url) return
    if (/\.pdf($|[?#])/i.test(url)) {
      window.open(url, "_blank", "noopener,noreferrer")
      return
    }
    setPreview({ name: material.title, url })
  }

  /**
   * Re-read the material list after an upload.
   *
   * The dialog posts and closes; without this the panel would keep showing the
   * list it was rendered with, so a teacher would upload and see nothing —
   * the exact complaint this panel exists to prevent.
   */
  const reload = async () => {
    try {
      const res = await fetch(`/api/courses/${courseId}/materials`, { cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data?.materials)) setMaterials(data.materials)
    } catch {
      // Leaving the previous list is better than blanking it.
    }
  }

  const updateStatus = async (materialId: string, approvalStatus: ApprovalStatus) => {
    setBusyId(materialId)
    setError(null)
    try {
      const response = await fetch(`/api/courses/${courseId}/materials/${materialId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approval_status: approvalStatus }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.error || "Could not update the material")
      }
      // Optimistic only after the request succeeded, so the badge never claims
      // a state the database rejected.
      setMaterials((current) =>
        current.map((material) =>
          material.id === materialId ? { ...material, approval_status: approvalStatus } : material,
        ),
      )
    } catch (cause: any) {
      setError(cause?.message || "Could not update the material")
    } finally {
      setBusyId(null)
    }
  }

  const posted = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ""
    return `Posted ${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {materials.length} material{materials.length === 1 ? "" : "s"} in this course
        </p>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Upload material
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {materials.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No materials yet</p>
          <p className="max-w-md text-xs text-muted-foreground">
            Upload slides, notes, or a handbook. Materials are published to students immediately
            and indexed for the AI assistant.
          </p>
          <Button size="sm" className="mt-2" onClick={() => setUploadOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload material
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="divide-y">
            {materials.map((material) => {
              const status = (material.approval_status ?? "published") as ApprovalStatus
              const isBusy = busyId === material.id

              return (
                <div
                  key={material.id}
                  className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/30"
                >
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full border text-muted-foreground"
                    aria-hidden
                  >
                    <FileText className="h-5 w-5" />
                  </span>

                  <button
                    type="button"
                    onClick={() => openFile(material)}
                    className="min-w-0 flex-1 text-left"
                    title={material.title}
                    disabled={!material.file_url}
                  >
                    <span className="block truncate text-sm font-medium">{material.title}</span>
                  </button>

                  <Badge className={STATUS_STYLE[status]} variant="secondary">
                    {STATUS_LABEL[status]}
                  </Badge>

                  <span className="hidden whitespace-nowrap text-sm text-muted-foreground sm:block">
                    {posted(material.created_at)}
                  </span>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Actions for ${material.title}`}
                        disabled={isBusy}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      {material.file_url && (
                        <>
                          <DropdownMenuItem onSelect={() => openFile(material)}>
                            <FileText className="mr-2 h-4 w-4" />
                            Open file
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </>
                      )}
                      {status === "published" ? (
                        <DropdownMenuItem onSelect={() => void updateStatus(material.id, "draft")}>
                          <EyeOff className="mr-2 h-4 w-4" />
                          Unpublish
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onSelect={() => void updateStatus(material.id, "published")}>
                          <Eye className="mr-2 h-4 w-4" />
                          Publish to students
                        </DropdownMenuItem>
                      )}
                      {status === "draft" && (
                        <DropdownMenuItem onSelect={() => void updateStatus(material.id, "approved")}>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Approve
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <FilePreviewDialog
        file={preview}
        onOpenChange={(next) => {
          if (!next) setPreview(null)
        }}
      />

      <UploadMaterialDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        courseId={courseId}
        onUploaded={() => void reload()}
      />
    </div>
  )
}

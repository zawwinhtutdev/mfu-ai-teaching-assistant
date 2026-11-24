"use client"

/**
 * Teacher-side material review.
 *
 * Spec §2.2 requires that AI-generated summaries and course content be edited
 * or approved before release. The RLS policy in
 * `20261118001000_study_assets_and_approval_gate.sql` enforces the gate on the
 * database side; this panel is how a teacher moves a material through it.
 */

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Eye, EyeOff, FileText, Sparkles, Upload } from "lucide-react"
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

  /**
   * Re-read the material list after an upload.
   *
   * The dialog posts and closes; without this the panel would keep showing the
   * list it was rendered with, so a teacher would upload and see nothing —
   * the exact complaint this panel exists to prevent.
   */
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

  if (materials.length === 0) {
    return (
      <>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">No materials yet</h3>
            <p className="mb-5 max-w-md text-sm text-muted-foreground">
              Upload slides, notes, or a handbook as a PDF. Uploaded material is published to
              students immediately and indexed for the AI assistant.
            </p>
            <Button onClick={() => setUploadOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Upload material
            </Button>
          </CardContent>
        </Card>
        <UploadMaterialDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          courseId={courseId}
          onUploaded={() => void reload()}
        />
      </>
    )
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {materials.length} material{materials.length === 1 ? "" : "s"} in this course
        </p>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Upload material
        </Button>
      </div>

      {materials.map((material) => {
        const status = (material.approval_status ?? "published") as ApprovalStatus
        const isBusy = busyId === material.id

        return (
          <Card key={material.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {material.file_url ? (
                      <button
                        type="button"
                        onClick={() => openFile(material)}
                        className="truncate text-left hover:underline"
                      >
                        {material.title}
                      </button>
                    ) : (
                      material.title
                    )}
                    <Badge className={STATUS_STYLE[status]} variant="secondary">
                      {STATUS_LABEL[status]}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {material.material_type.charAt(0).toUpperCase() + material.material_type.slice(1)} •{" "}
                    {new Date(material.created_at).toLocaleDateString()}
                    {status !== "published" && " • hidden from students"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {material.summary_text && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950">
                  <h4 className="mb-1 flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="h-4 w-4" />
                    AI summary
                  </h4>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{material.summary_text}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {material.file_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Open ${material.title}`}
                    onClick={() => openFile(material)}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Open file
                  </Button>
                )}
                {status !== "published" ? (
                  <Button
                    size="sm"
                    disabled={isBusy}
                    onClick={() => updateStatus(material.id, "published")}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Publish to students
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => updateStatus(material.id, "draft")}
                  >
                    <EyeOff className="mr-2 h-4 w-4" />
                    Unpublish
                  </Button>
                )}

                {status === "draft" && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => updateStatus(material.id, "approved")}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}

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

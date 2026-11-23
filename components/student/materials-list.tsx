"use client"

/**
 * Materials as a Classroom-style list.
 *
 * The card grid gave every material three buttons and a large chunk of vertical
 * space for a course with many uploads. A topic header with compact rows — icon,
 * title, posted date, one actions menu — keeps the whole course scannable, which
 * is what the classwork list this mirrors does.
 */

import { useState } from "react"
import { FileText, MoreVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { CourseMaterial } from "@/lib/types"
import { cleanExtractedText } from "@/lib/text/extracted-text"
import { FilePreviewDialog, type PreviewFile } from "@/components/shared/file-preview-dialog"

const INITIAL_VISIBLE = 5

function postedLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return `Posted ${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
}

export function MaterialsList({ materials }: { materials: CourseMaterial[] }) {
  const [showAll, setShowAll] = useState(false)
  const [selected, setSelected] = useState<CourseMaterial | null>(null)
  const [preview, setPreview] = useState<PreviewFile | null>(null)

  const visible = showAll ? materials : materials.slice(0, INITIAL_VISIBLE)

  return (
    <>
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="divide-y">
          {visible.map((material) => (
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
                onClick={() => setSelected(material)}
                className="min-w-0 flex-1 text-left"
                title={material.title}
              >
                <span className="block truncate text-sm font-medium">{material.title}</span>
              </button>

              <span className="hidden whitespace-nowrap text-sm text-muted-foreground sm:block">
                {postedLabel(material.created_at)}
              </span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={`Actions for ${material.title}`}>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onSelect={() => setSelected(material)}>View details</DropdownMenuItem>
                  {material.file_url && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() =>
                          setPreview({ name: material.title, url: material.file_url as string })
                        }
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Open file
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>

        {materials.length > INITIAL_VISIBLE && !showAll && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="w-full border-t py-3 text-sm font-medium text-blue-600 hover:bg-muted/40"
          >
            View more
          </button>
        )}
      </div>

      <FilePreviewDialog
        file={preview}
        onOpenChange={(next) => {
          if (!next) setPreview(null)
        }}
      />

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(next) => {
          if (!next) setSelected(null)
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-lg bg-muted p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{cleanExtractedText(selected?.content ?? "")}</p>
          </div>
          {selected?.file_url && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                aria-label={`Open ${selected.title}`}
                onClick={() => setPreview({ name: selected.title, url: selected.file_url as string })}
              >
                <FileText className="mr-2 h-4 w-4" />
                Open file
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

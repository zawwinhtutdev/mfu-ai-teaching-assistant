"use client"

/**
 * In-app file preview.
 *
 * PDFs render natively in an iframe. Office documents (including legacy .ppt)
 * cannot be rendered by browsers, so they use Microsoft's viewer — which needs a
 * publicly reachable URL. On local storage that viewer cannot fetch the file, so
 * the dialog says so instead of silently downloading it.
 */

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Download, FileText } from "lucide-react"

export type PreviewFile = { name: string; url: string }

const OFFICE_EXTENSIONS = [".ppt", ".pptx", ".doc", ".docx", ".xls", ".xlsx", ".odt", ".odp", ".ods"]

/** Extensions come from the URL (material titles often omit them). */
function extensionOf(nameOrUrl: string) {
  const withoutQuery = nameOrUrl.trim().split(/[?#]/)[0]
  const lastSegment = withoutQuery.split("/").pop() ?? withoutQuery
  const match = lastSegment.toLowerCase().match(/\.[a-z0-9]+$/)
  return match?.[0] ?? ""
}

function isLocalUrl(url: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url)
}

export function FilePreviewDialog({
  file,
  onOpenChange,
}: {
  file: PreviewFile | null
  onOpenChange: (open: boolean) => void
}) {
  const url = file?.url ?? ""
  // The URL carries the real extension; material titles often omit it.
  const extension = extensionOf(url) || extensionOf(file?.name ?? "")
  const isPdf = extension === ".pdf"
  const isOffice = OFFICE_EXTENSIONS.includes(extension)
  const local = isLocalUrl(url)

  const embedUrl = isPdf
    ? url
    : isOffice && !local
      ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`
      : ""

  return (
    <Dialog open={Boolean(file)} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-4 py-3 pr-12">
          <DialogTitle className="truncate text-sm font-medium">{file?.name}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 bg-muted/30">
          {embedUrl ? (
            <iframe src={embedUrl} title={file?.name ?? "File preview"} className="h-full w-full border-0" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium">Preview isn&apos;t available for this file</p>
              <p className="max-w-md text-xs text-muted-foreground">
                {isOffice && local
                  ? "Office files preview through Microsoft's viewer, which needs a public file URL. This file is served from local storage, so it can only be downloaded here."
                  : "Your browser cannot display this file type inline."}
              </p>
              <Button size="sm" asChild>
                <a href={url} download={file?.name} rel="noopener noreferrer">
                  <Download className="mr-2 h-4 w-4" />
                  Download file
                </a>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

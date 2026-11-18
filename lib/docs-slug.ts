// Client-safe helpers shared by the docs page (server) and the markdown
// renderer (client). Keep this free of `server-only` and `node:*` imports.

export function stripMarkdown(value: string) {
  return value
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .trim()
}

export function slugifyHeading(value: string) {
  return stripMarkdown(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u0E00-\u0E7F]+/g, "-")
    .replace(/^-|-$/g, "")
}

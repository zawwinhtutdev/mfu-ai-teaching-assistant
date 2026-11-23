/**
 * Minimal RFC 4180 CSV codec.
 *
 * Import and export both need the same rules — quoted separators, doubled
 * quotes, CRLF line endings and a UTF-8 BOM — and neither side is big enough to
 * justify a dependency. Excel is the real consumer here, so the writer emits a
 * BOM (Thai names otherwise render as mojibake) and neutralises cells that
 * Excel would treat as formulas.
 */

export type CsvTable = {
  /** Header cells, normalised to snake_case so "Joined Date" and "joined_at" match. */
  headers: string[]
  /** Data rows, still strings. Callers validate and coerce. */
  rows: string[][]
}

const FORMULA_PREFIX = /^[=+\-@\t\r]/

/** Strip a leading UTF-8 BOM; Excel writes one when saving as "CSV UTF-8". */
function stripBom(value: string) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value
}

/** Quote a field only when it needs it, and block spreadsheet formula injection. */
function escapeField(value: string | number | null | undefined) {
  const raw = value == null ? "" : String(value)
  const safe = FORMULA_PREFIX.test(raw) ? `'${raw}` : raw
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/**
 * Parse CSV text into a header row plus data rows.
 *
 * Malformed quoting is tolerated rather than thrown on: an unterminated quote
 * simply consumes the rest of the file, which the caller reports as missing
 * rows instead of a 500.
 */
export function parseCsv(text: string, maxRows = 5000): CsvTable {
  const input = stripBom(text)
  const records: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ",") {
      row.push(field)
      field = ""
    } else if (char === "\r" || char === "\n") {
      if (char === "\r" && input[i + 1] === "\n") i += 1
      row.push(field)
      records.push(row)
      row = []
      field = ""
    } else {
      field += char
    }
  }

  // Flush the final field unless the file ended exactly on a newline.
  if (field !== "" || row.length > 0) {
    row.push(field)
    records.push(row)
  }

  while (records.length > 0 && records[records.length - 1].every((cell) => cell.trim() === "")) {
    records.pop()
  }

  const [headerRow = [], ...dataRows] = records
  const headers = headerRow.map((header) => header.trim().toLowerCase().replace(/\s+/g, "_"))

  return { headers, rows: dataRows.slice(0, maxRows) }
}

/** Serialise a table to CSV text, with CRLF endings, a BOM and formula guards. */
export function serializeCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
  { bom = true }: { bom?: boolean } = {},
) {
  const lines = [headers.map(escapeField).join(",")]
  for (const row of rows) {
    lines.push(row.map(escapeField).join(","))
  }
  const body = `${lines.join("\r\n")}\r\n`
  return bom ? `\uFEFF${body}` : body
}

/** Map one data row onto the parsed headers, ignoring unknown columns. */
export function toRecord(headers: string[], row: string[]) {
  const record: Record<string, string> = {}
  headers.forEach((header, index) => {
    record[header] = (row[index] ?? "").trim()
  })
  return record
}

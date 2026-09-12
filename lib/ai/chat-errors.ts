const RATE_LIMIT_MESSAGE =
  "The AI service has reached its request limit. Please try again later. If this continues, contact the site administrator."

const CONFIGURATION_MESSAGE =
  "The AI service is not configured correctly. Please contact the site administrator."

const GENERIC_MESSAGE =
  "The AI could not generate a response. Please try again in a moment."

function collectErrorText(error: unknown, depth = 0): string {
  if (depth > 2 || error == null) return ""
  if (typeof error === "string") return error
  if (error instanceof Error) {
    const nested = "cause" in error ? collectErrorText(error.cause, depth + 1) : ""
    return `${error.message} ${nested}`.trim()
  }
  if (typeof error !== "object") return String(error)

  const value = error as Record<string, unknown>
  const nestedErrors = Array.isArray(value.errors)
    ? value.errors.map((item) => collectErrorText(item, depth + 1)).join(" ")
    : ""

  return [value.message, value.statusCode, value.responseBody, value.cause, nestedErrors]
    .map((item) => collectErrorText(item, depth + 1))
    .filter(Boolean)
    .join(" ")
}

export function getUserFacingChatError(error: unknown): string {
  const text = collectErrorText(error).toLowerCase()

  if (
    text.includes("429") ||
    text.includes("quota") ||
    text.includes("rate limit") ||
    text.includes("resource_exhausted")
  ) {
    return RATE_LIMIT_MESSAGE
  }

  if (
    text.includes("api key") ||
    text.includes("not configured") ||
    text.includes("permission_denied") ||
    text.includes("unauthorized")
  ) {
    return CONFIGURATION_MESSAGE
  }

  return GENERIC_MESSAGE
}

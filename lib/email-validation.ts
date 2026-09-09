// Email domain validation utilities

const ALLOWED_EMAIL_DOMAIN = "mfu.ac.th"
const UNIVERSITY_NAME = "Mae Fah Luang University"

/**
 * Validates if an email belongs to the university domain
 */
export function isUniversityEmail(email: string): boolean {
  const normalizedEmail = email.trim().toLowerCase()
  const atIndex = normalizedEmail.lastIndexOf("@")

  if (atIndex <= 0 || atIndex === normalizedEmail.length - 1) return false

  const domain = normalizedEmail.slice(atIndex + 1)
  return domain === ALLOWED_EMAIL_DOMAIN || domain.endsWith(`.${ALLOWED_EMAIL_DOMAIN}`)
}

/**
 * Gets a user-friendly error message for invalid email domains
 */
export function getEmailDomainError(): string {
  return `Please use your ${UNIVERSITY_NAME} email address (ending with @${ALLOWED_EMAIL_DOMAIN})`
}

/**
 * Extracts student ID from university email
 * Example: 6631503101@lamduan.mfu.ac.th -> 6631503101
 * Example: teacher@mfu.ac.th -> teacher
 */
export function extractStudentId(email: string): string | null {
  if (!isUniversityEmail(email)) return null
  return email.split("@")[0]
}

/**
 * Gets the allowed email domain
 */
export function getAllowedDomain(): string {
  return ALLOWED_EMAIL_DOMAIN
}

/**
 * Gets the university name
 */
export function getUniversityName(): string {
  return UNIVERSITY_NAME
}

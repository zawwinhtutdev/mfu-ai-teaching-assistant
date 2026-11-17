import { headers } from "next/headers"

/**
 * True only when the current request really arrived over HTTPS.
 *
 * `process.env.NODE_ENV === "production"` is not a safe proxy for this: the app
 * ships a production build that is routinely served over plain http (localhost
 * or a LAN address such as http://10.0.50.8:3000). Browsers silently drop
 * Secure cookies on those origins, which breaks demo login, document and
 * conversation persistence.
 */
export async function isHttpsRequest() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""
  if (appUrl.toLowerCase().startsWith("https://")) {
    return true
  }

  try {
    const headerStore = await headers()
    const forwardedProto = headerStore.get("x-forwarded-proto")
    if (forwardedProto) {
      return forwardedProto.split(",")[0]!.trim().toLowerCase() === "https"
    }
  } catch {
    // headers() is unavailable outside a request scope — assume http.
  }

  return false
}

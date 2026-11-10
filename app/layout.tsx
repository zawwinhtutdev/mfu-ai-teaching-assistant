import type React from "react"
import type { Metadata, Viewport } from "next"
import { ThemeProvider } from "@/components/theme-provider"
import { ServiceWorkerRegister } from "@/components/sw-register"
import "./globals.css"

export const metadata: Metadata = {
  title: "MFU AI Teaching Assistant",
  description: "AI-powered learning platform for students and teachers",
  applicationName: "MFU AI Teaching Assistant",
  generator: "v0.app",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/crest-tab-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/crest-tab-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/crest-tab-48.png", sizes: "48x48", type: "image/png" },
    ],
    shortcut: "/icons/crest-tab-32.png",
    apple: [
      {
        url: "/icons/crest-180.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MFU AI TA",
  },
}

export const viewport: Viewport = {
  themeColor: "#890C25",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={true} disableTransitionOnChange>
          {children}
        </ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}

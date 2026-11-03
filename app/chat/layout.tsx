"use client"

import type React from "react"
import { useState } from "react"
import { ChatSidebar } from "@/components/chat/chat-sidebar"
import { SettingsModal } from "@/components/settings-modal"
import { useMobileSidebar } from "@/hooks/use-mobile-sidebar"
import { Menu, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import "./mf-chat.css"

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const { isSidebarOpen, isMobile, openSidebar, closeSidebar } = useMobileSidebar()
  const router = useRouter()
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <div className="mfchat">
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css"
      />

      <ChatSidebar
        isOpen={isSidebarOpen}
        onClose={closeSidebar}
        isMobile={isMobile}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {isMobile && (
        <div className="mf-topbar" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 40, background: "var(--mf-bg)" }}>
          <button type="button" className="mf-railbtn" onClick={openSidebar} aria-label="Open navigation">
            <Menu size={19} />
          </button>
          <span className="mf-wordmark">
            MFU<span className="mf-wordmark-thin">AI</span>
          </span>
          <button
            type="button"
            className="mf-railbtn"
            style={{ marginLeft: "auto" }}
            onClick={() => router.push("/chat")}
            aria-label="New chat"
          >
            <Plus size={19} />
          </button>
        </div>
      )}

      <main className="mf-main" style={isMobile ? { paddingTop: 56 } : undefined}>
        {children}
      </main>
    </div>
  )
}

"use client"

import type React from "react"
import { ChatSidebar } from "@/components/chat/chat-sidebar"
import { Button } from "@/components/ui/button"
import { Menu } from "lucide-react"
import { useMobileSidebar } from "@/hooks/use-mobile-sidebar"
import { BrandIcon } from "@/components/brand-icon"

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const { isSidebarOpen, isMobile, openSidebar, closeSidebar } = useMobileSidebar()

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile Header */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 z-30 flex h-16 items-center justify-between border-b bg-card px-3 sm:px-4 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={openSidebar}
            className="h-8 w-8"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <BrandIcon size={32} className="rounded-full" priority />
          <div className="w-8" /> {/* Spacer for centering */}
        </div>
      )}

      {/* Sidebar */}
      <ChatSidebar
        isOpen={isSidebarOpen}
        onClose={closeSidebar}
        isMobile={isMobile}
      />

      {/* Main Content */}
      <main className={`flex-1 overflow-hidden ${isMobile ? 'pt-16' : ''}`}>
        {children}
      </main>
    </div>
  )
}

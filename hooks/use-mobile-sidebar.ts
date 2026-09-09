"use client"

import { useState, useEffect } from "react"

export function useMobileSidebar() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024 // lg breakpoint
      setIsMobile(mobile)
      
      if (!mobile) {
        setIsSidebarOpen(true) // Always open on desktop
      } else {
        setIsSidebarOpen(false) // Closed by default on mobile
      }
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const openSidebar = () => setIsSidebarOpen(true)
  const closeSidebar = () => setIsSidebarOpen(false)
  const toggleSidebar = () => setIsSidebarOpen(prev => !prev)

  return {
    isSidebarOpen,
    isMobile,
    openSidebar,
    closeSidebar,
    toggleSidebar,
  }
}

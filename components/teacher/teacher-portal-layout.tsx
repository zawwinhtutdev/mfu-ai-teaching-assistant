"use client"

import { useState } from "react"
import { Menu, ChevronRight } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { Profile, Course } from "@/lib/types"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserNav } from "@/components/user-nav"
import { TeacherSidebar } from "./teacher-sidebar"
import { Button } from "@/components/ui/button"
import { Calendar, BarChart3, Bot, Building, Settings, Home, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { BrandIcon } from "@/components/brand-icon"

interface TeacherPortalLayoutProps {
  profile: Profile
  courses: Course[]
  children: React.ReactNode
}

// Page configuration for breadcrumbs and titles
const pageConfig: Record<string, { title: string; icon: React.ComponentType<{ className?: string }>; breadcrumb: string }> = {
  "/teacherportal/mycourses": { title: "My Courses", icon: Home, breadcrumb: "My Courses" },
  "/teacherportal/calendar": { title: "Calendar & Schedule", icon: Calendar, breadcrumb: "Calendar" },
  "/teacherportal/analytics": { title: "Analytics Dashboard", icon: BarChart3, breadcrumb: "Analytics" },
  "/teacherportal/agentbuilder": { title: "Agent Builder", icon: Bot, breadcrumb: "Agent Builder" },
  "/teacherportal/documents": { title: "Documents RAG", icon: FileText, breadcrumb: "Documents RAG" },
  "/teacherportal/mfucampusresources": { title: "MFU Campus Guide", icon: Building, breadcrumb: "MFU Campus Guide" },
  "/teacherportal/settings": { title: "Settings", icon: Settings, breadcrumb: "Settings" },
}

export function TeacherPortalLayout({ profile, courses, children }: TeacherPortalLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const pathname = usePathname()
  
  // Get current page config - check for course pages first
  let currentPage: string | undefined
  let currentCourse: Course | undefined
  
  if (pathname.startsWith("/teacherportal/mycourses/")) {
    const courseId = pathname.split("/teacherportal/mycourses/")[1]?.split("/")[0]
    currentCourse = courses.find(c => c.id === courseId)
    currentPage = "/teacherportal/mycourses"
  } else {
    currentPage = Object.keys(pageConfig).find(path => 
      pathname === path || (pathname.startsWith(path + "/") && path !== "/teacherportal/mycourses")
    )
  }
  
  const pageInfo = currentPage && pageConfig[currentPage] 
    ? pageConfig[currentPage] 
    : { title: "Teacher Portal", icon: Home, breadcrumb: "My Courses" }
  
  const breadcrumbText = currentCourse ? currentCourse.title : pageInfo.breadcrumb

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
      {/* Sidebar */}
      <TeacherSidebar 
        courses={courses} 
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Main Content */}
      <div className={cn(
        "flex-1 flex flex-col transition-all duration-300",
        sidebarOpen ? "lg:ml-64" : "lg:ml-0"
      )}>
        {/* Header with University Theme Color */}
        <header className="sticky top-0 z-30 border-b bg-[#A81D24] text-white backdrop-blur-sm dark:bg-[#A81D24]">
          <div className="flex h-16 items-center justify-between px-6">
            {/* Left side - Hamburger, Logo, and Breadcrumb */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="h-10 w-10 rounded-xl text-white hover:bg-white/20 transition-all"
              >
                <Menu className="h-5 w-5" />
              </Button>
              
              {/* Logo */}
              <BrandIcon size={40} tone="light" className="shrink-0" />
              
              {/* Breadcrumb Navigation */}
              <div className="flex items-center gap-2 text-sm">
                <Link 
                  href="/teacherportal/mycourses"
                  className="text-white hover:text-white/80 transition-colors font-medium"
                >
                  Teacher Portal
                </Link>
                <ChevronRight className="h-4 w-4 text-white/70" />
                {currentCourse ? (
                  <>
                <Link 
                      href="/teacherportal/mycourses"
                  className="text-white hover:text-white/80 transition-colors font-medium"
                >
                  My Courses
                </Link>
                    <ChevronRight className="h-4 w-4 text-white/70" />
                    <span className="text-white/90">{currentCourse.title}</span>
                  </>
                ) : (
                  <span className="text-white/90">{breadcrumbText}</span>
                )}
              </div>
            </div>

            {/* Right side - Utility Icons */}
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <UserNav profile={profile} />
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-950 dark:to-gray-900">
          {children}
        </main>
      </div>
    </div>
  )
}

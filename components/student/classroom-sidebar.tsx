"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  Home, 
  Calendar, 
  Bell,
  ClipboardList, 
  Archive, 
  Settings,
  Brain,
  Search,
  Building,
  FileText,
  ChevronDown,
  ChevronUp,
  X,
  MessageSquare,
  Users
} from "lucide-react"
import { cn, slugify } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { Course } from "@/lib/types"

interface ClassroomSidebarProps {
  courses: Course[]
  isOpen: boolean
  onToggle: () => void
}

export function ClassroomSidebar({ courses, isOpen, onToggle }: ClassroomSidebarProps) {
  const pathname = usePathname()
  const [enrolledOpen, setEnrolledOpen] = useState(true)

  const isActive = (path: string) => {
    // For home path, only match exactly
    if (path === "/studentportal/mycourses") {
      return pathname === path
    }
    // For other paths, match exact or if pathname starts with the path
    return pathname === path || pathname.startsWith(path + "/")
  }

  const sidebarItems = [
    { icon: Home, label: "My courses", path: "/studentportal/mycourses" },
    { icon: Calendar, label: "Calendar", path: "/studentportal/calendar" },
    { icon: Bell, label: "Reminders", path: "/studentportal/reminders" },
    { icon: Brain, label: "AI Study Tools", path: "/studentportal/aistudytools" },
    { icon: FileText, label: "Documents RAG", path: "/studentportal/documents" },
    { icon: Building, label: "MFU Campus Guide", path: "/studentportal/mfucampusresources" },
    { icon: Users, label: "MFU Social", path: "/studentportal/mfuclubs" },
    { icon: Settings, label: "Settings", path: "/studentportal/settings" },
  ]

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 shadow-[4px_0_12px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_12px_rgba(0,0,0,0.3)] z-50 transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "w-64"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Close button for mobile */}
          <div className="flex items-center justify-between p-4 border-b border-gray-300/50 dark:border-gray-700/50 lg:hidden">
            <span className="font-semibold text-gray-800 dark:text-gray-100">Menu</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggle}
              className="h-9 w-9 rounded-xl bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-[4px_4px_8px_rgba(0,0,0,0.08),-4px_-4px_8px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.2),-4px_-4px_8px_rgba(255,255,255,0.05)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.08),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] text-gray-700 dark:text-gray-300 transition-all"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto p-2">
            {/* Top Section - My Courses (with expandable enrolled courses) */}
            <div className="space-y-1 mb-4">
              {/* My Courses - Expandable */}
              <div className="mb-4">
                <Link
                  href="/studentportal/mycourses"
                  onClick={(e) => {
                    // Toggle enrolled courses when clicking the chevron
                    const target = e.target as HTMLElement
                    if (target.closest('svg') || target.closest('[aria-label="Toggle enrolled courses"]')) {
                      e.preventDefault()
                      setEnrolledOpen(!enrolledOpen)
                    } else {
                      // Close sidebar on mobile when navigating
                      if (window.innerWidth < 1024) {
                        onToggle()
                      }
                    }
                  }}
                  className={cn(
                    "flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all w-full",
                    isActive("/studentportal/mycourses")
                      ? "bg-gradient-to-br from-blue-200 to-blue-300 dark:from-blue-800 dark:to-blue-900 text-blue-800 dark:text-blue-200 font-semibold shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_rgba(255,255,255,0.5)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)]"
                      : "text-gray-700 dark:text-gray-300 shadow-[4px_4px_8px_rgba(0,0,0,0.08),-4px_-4px_8px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.2),-4px_-4px_8px_rgba(255,255,255,0.05)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.08),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Home className="h-5 w-5" />
                    <span>My courses</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      setEnrolledOpen(!enrolledOpen)
                    }}
                    className="flex items-center justify-center"
                    aria-label="Toggle enrolled courses"
                  >
                    {enrolledOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </Link>

                {enrolledOpen && (
                  <div className="mt-1 ml-8 space-y-1">
                    {courses.map((course) => {
                      const courseSlug = slugify(course.title)
                      const coursePath = `/studentportal/mycourses/${courseSlug}`
                      const active = isActive(coursePath)
                      return (
                        <Link
                          key={course.id}
                          href={coursePath}
                          onClick={() => {
                            if (window.innerWidth < 1024) {
                              onToggle()
                            }
                          }}
                          className={cn(
                            "block px-2 py-1.5 rounded-lg text-xs transition-all truncate",
                            active
                              ? "bg-gradient-to-br from-blue-200 to-blue-300 dark:from-blue-800 dark:to-blue-900 text-blue-800 dark:text-blue-200 font-semibold shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1),inset_-1px_-1px_2px_rgba(255,255,255,0.5)] dark:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.05)]"
                              : "text-gray-600 dark:text-gray-400 hover:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.05),inset_-1px_-1px_2px_rgba(255,255,255,0.5)] dark:hover:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.2),inset_-1px_-1px_2px_rgba(255,255,255,0.05)] bg-gradient-to-br from-white/50 to-gray-50/50 dark:from-gray-800/50 dark:to-gray-900/50"
                          )}
                          title={course.title}
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-500 dark:text-gray-500">
                              [{course.code}]
                            </span>
                            <span className="truncate">{course.title}</span>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Calendar */}
              {sidebarItems.slice(1, 2).map((item) => {
                const Icon = item.icon
                const active = isActive(item.path)
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => {
                      // Close sidebar on mobile when navigating
                      if (window.innerWidth < 1024) {
                        onToggle()
                      }
                    }}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                      active
                        ? "bg-gradient-to-br from-blue-200 to-blue-300 dark:from-blue-800 dark:to-blue-900 text-blue-800 dark:text-blue-200 font-semibold shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_rgba(255,255,255,0.5)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)]"
                        : "text-gray-700 dark:text-gray-300 shadow-[4px_4px_8px_rgba(0,0,0,0.08),-4px_-4px_8px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.2),-4px_-4px_8px_rgba(255,255,255,0.05)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.08),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>

            {/* Bottom Section - AI Study Tools, Browse Courses, Settings */}
            <div className="space-y-1 pt-4 mt-4 border-t border-gray-300/50 dark:border-gray-700/50">
              {sidebarItems.slice(2).map((item) => {
                const Icon = item.icon
                const active = isActive(item.path)
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => {
                      if (window.innerWidth < 1024) {
                        onToggle()
                      }
                    }}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                      active
                        ? "bg-gradient-to-br from-blue-200 to-blue-300 dark:from-blue-800 dark:to-blue-900 text-blue-800 dark:text-blue-200 font-semibold shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_rgba(255,255,255,0.5)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)]"
                        : "text-gray-700 dark:text-gray-300 shadow-[4px_4px_8px_rgba(0,0,0,0.08),-4px_-4px_8px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.2),-4px_-4px_8px_rgba(255,255,255,0.05)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.08),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </nav>

          {/* Bottom Footer - Back to AI Chat */}
          <div className="p-2 border-t border-gray-300/50 dark:border-gray-700/50">
            <Link
              href="/chat"
              onClick={() => {
                if (window.innerWidth < 1024) {
                  onToggle()
                }
              }}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all w-full",
                isActive("/chat")
                  ? "bg-gradient-to-br from-blue-200 to-blue-300 dark:from-blue-800 dark:to-blue-900 text-blue-800 dark:text-blue-200 font-semibold shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_rgba(255,255,255,0.5)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)]"
                  : "text-gray-700 dark:text-gray-300 shadow-[4px_4px_8px_rgba(0,0,0,0.08),-4px_-4px_8px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.2),-4px_-4px_8px_rgba(255,255,255,0.05)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.08),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900"
              )}
            >
              <MessageSquare className="h-5 w-5" />
              <span>Back to AI Chat</span>
            </Link>
          </div>
        </div>
      </aside>
    </>
  )
}

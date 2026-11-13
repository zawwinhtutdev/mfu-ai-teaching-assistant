"use client"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MessageSquare, BookOpen, Brain, FileText, Bell, Bot, MoreVertical, Clipboard, Calendar, CalendarClock } from "lucide-react"
import type { Course, CourseMaterial, ChatbotSettings } from "@/lib/types"
import { AIChatbot } from "./ai-chatbot"
import { MaterialCard } from "./material-card"
import { FlashcardsView } from "./flashcards-view"
import { QuizzesView } from "./quizzes-view"
import { StudyPlannerView } from "./study-planner-view"
import { SurveyWidget } from "./survey-widget"
import { AssignmentsPanel } from "@/components/shared/assignments-panel"
import { useEffect, useState } from "react"

interface CoursePageProps {
  course: Course
  materials: CourseMaterial[]
  chatbotSettings: ChatbotSettings | null
  studentId: string
}

interface AnnouncementFileItem {
  id: string
  file_name: string
  file_url: string
}

interface AnnouncementFeedItem {
  id: string | number
  content?: string
  created_at?: string
  updated_at?: string
  author?: string
  authorAvatar?: string
  date?: string
  edited?: boolean
  type?: string
  assignmentTitle?: string
  groups?: Array<{ color: string; icon: string; name: string; message: string; time: string }>
  attachment?: string
  files?: AnnouncementFileItem[]
}

export function CoursePage({ course, materials, chatbotSettings, studentId }: CoursePageProps) {
  const [liveAnnouncements, setLiveAnnouncements] = useState<AnnouncementFeedItem[]>([])
  const [isAnnouncementsLoading, setIsAnnouncementsLoading] = useState(false)
  // Mock announcement data for CSD323
  const csd323Announcements = [
    {
      id: 1,
      author: "Prasara Jakkaew",
      authorAvatar: "/placeholder-user.jpg",
      date: "Nov 4",
      content: "The group below, please respond to my message.",
      groups: [],
      attachment: "Screenshot 2568-11-04 at 13.41.24.png"
    },
    {
      id: 2,
      author: "Nacha Chondamrongkul",
      authorAvatar: "/placeholder-user.jpg",
      date: "Nov 4",
      type: "assignment",
      assignmentTitle: "Final Document"
    },
    {
      id: 3,
      author: "Nang Hsu Mon Pyae",
      authorAvatar: "/placeholder-user.jpg",
      date: "Nov 4",
      content: `Dear all,

On 13 November, there will be a final presentation for your Senior Project at SE Lab starting at 1:00 p.m., sharply.

Groups:
• Group 1: ATA
• Group 2: Ed Game
• Group 3: DTBI (Mental Health)
• Group 4: DTBI (Career)
• Group 5: DTBI (Tourism)

Please follow the instructions:
• Please wear your MFU uniform.
• All members must participate in the presentation.
• Each group will have 15 minutes to present.

Regards,
Hsu`
    },
    {
      id: 4,
      author: "Nacha Chondamrongkul",
      authorAvatar: "/placeholder-user.jpg",
      date: "Sep 25",
      type: "assignment",
      assignmentTitle: "Proposal Document [15 points]"
    },
    {
      id: 5,
      author: "Nacha Chondamrongkul",
      authorAvatar: "/placeholder-user.jpg",
      date: "Sep 25",
      content: "If you made the presentation last week and decide to skip the class today, I will give you 0 marks for presentation for now, until you come to the class."
    },
    {
      id: 6,
      author: "Nacha Chondamrongkul",
      authorAvatar: "/placeholder-user.jpg",
      date: "Sep 25",
      content: "Nirvana\nThreetie\nCodeCrafters\nClock Chasers\nTo Eang\nNOVA\nXVerse\nLeeroy\nKWAN\nSystem Four\nPELICAN\nArchiDevs\nSpaceZ\nMongkhol99\nMhu Thod"
    },
    {
      id: 7,
      author: "Nang Hsu Mon Pyae",
      authorAvatar: "/placeholder-user.jpg",
      date: "Sep 12",
      edited: true,
      content: `Dear all,

This is the student list that I will supervise for the senior projects. Please prepare the and meet me at the SE Lab at 11:00 a.m. on coming 16th September, after the Software Project Management class.

For the group, please first think about a simple game design, including the game mechanics, game flow, and decide which scope you would like to develop (e.g., Programming, Disaster Preparedness, SPQA, PM, etc.).

P.S. First Come, First Served

Regards,
Hsu`
    },
    {
      id: 8,
      author: "Nacha Chondamrongkul",
      authorAvatar: "/placeholder-user.jpg",
      date: "Sep 12",
      content: `All Groups have assigned topic and supervisor.

https://docs.google.com/spreadsheets/d/1PJx18MMb4n_in09t2D1hkGxU7Jypv4nqrgiV0UXNrV4/edit?usp=sharing

Please contact your supervisor before your presentation on next Thursday 18. Before the discussion, you should conduct some research and prepare proposed solutions or ideas. Do not come empty-handed or rely solely on your supervisor to provide all the input.

Prepare your presentation (only the presentation for now; no document is required at this stage). You will be asked to prepare a proposal document after your presentation. The presentation should clearly outline the problem, the proposed solution, and the deliverables for this semester.`
    }
  ]

  // Mock announcement data for CSB321 - Software Business Entrepreneurship
  const csb321Announcements = [
    {
      id: 102,
      author: "Aj. Alex",
      authorAvatar: "/placeholder-user.jpg",
      date: "Nov 8",
      type: "assignment",
      assignmentTitle: "Business Model Canvas Assignment [20 points]"
    },
    {
      id: 103,
      author: "Aj. Alex",
      authorAvatar: "/placeholder-user.jpg",
      date: "Nov 5",
      content: `Dear students,

I've uploaded new lecture materials on Market Research and Validation. Please review Lecture 3 before our next class session. This is crucial for your upcoming Business Model Canvas assignment.

Key topics covered:
• TAM, SAM, and SOM analysis
• Customer validation techniques
• Competitive analysis methods

The assignment is due on November 20th. If you have any questions, feel free to ask during office hours or via the AI Assistant.

Best regards,
Aj. Alex`
    },
    {
      id: 104,
      author: "Aj. Alex",
      authorAvatar: "/placeholder-user.jpg",
      date: "Nov 3",
      type: "assignment",
      assignmentTitle: "Startup Pitch Deck [25 points]"
    },
    {
      id: 105,
      author: "Aj. Alex",
      authorAvatar: "/placeholder-user.jpg",
      date: "Oct 30",
      content: "Reminder: The Startup Basics Quiz is now available in the AI Assistant > Quizzes section. You have until November 15th to complete it. This quiz covers fundamental entrepreneurship concepts and will help prepare you for the midterm exam."
    },
    {
      id: 106,
      author: "Aj. Alex",
      authorAvatar: "/placeholder-user.jpg",
      date: "Oct 28",
      content: `Important Update:

The Business Plan Development assignment deadline has been extended to December 10th. This gives you more time to conduct thorough market research and develop comprehensive financial projections.

Please note:
• Minimum 15 pages required
• Must include all sections: executive summary, market analysis, financial projections, etc.
• Submit via Google Classroom

Good luck with your projects!`
    }
  ]

  // Mock announcement data for CSD322 - Platform Development
  const csd322Announcements = [
    {
      id: 201,
      author: "Vittayasak Rujivorakul",
      authorAvatar: "/placeholder-user.jpg",
      date: "Nov 4",
      content: `Cancel class 4 Nov 2025

Due to university duties in Chiangmai, the class will be cancelled during the above time. Make-up session or substitute assignment will be announced later via the course communication channel.

Sorry for any inconvenience.
Vittayasak Rujivorakul`,
    },
    {
      id: 202,
      author: "Vittayasak Rujivorakul",
      authorAvatar: "/placeholder-user.jpg",
      date: "Oct 6",
      content: `ประกาศ หาคนสนใจรับงานเขียนเว็ป ผู้ประกอบการท่องเที่ยว

เน้นเคยมีผลงานการทำเว็ปมาแล้ว ทักติดต่อ อ.บี เพื่อให้ contact กับเจ้าของงานโดยตรง

(Announcement: Looking for people interested in web writing work, tourism operators. Emphasizing previous web development experience. Please contact Aj. B directly to get in touch with the project owner.)`,
    },
    {
      id: 203,
      author: "Vittayasak Rujivorakul",
      authorAvatar: "/placeholder-user.jpg",
      date: "Oct 5",
      content: `Class Cancellation Notice 7 Oct 2025

Due to university duties in Bangkok, the class will be cancelled during the above time (Tuesday, 7 October 2025 — 13:00-17:00). Make-up session or substitute assignment will be announced later via the course communication channel.

Sorry for any inconvenience.
Vittayasak Rujivorakul`,
    },
    {
      id: 204,
      author: "Vittayasak Rujivorakul",
      authorAvatar: "/placeholder-user.jpg",
      date: "Oct 28",
      type: "assignment",
      assignmentTitle: "Assignment #4: DevOps CI/CD"
    },
    {
      id: 205,
      author: "Vittayasak Rujivorakul",
      authorAvatar: "/placeholder-user.jpg",
      date: "Aug 14",
      content: `AI Agent challenge

2025 Platform Dev

Check out the MiniMax $150,000 AI Agent Challenge!

https://minimax-agent-hackathon.space.minimax.io

This is a great opportunity to apply your platform development skills and compete for significant prizes. The challenge runs from Aug 11-25 with 2 categories.

Good luck!`,
    },
    {
      id: 206,
      author: "Assignments",
      authorAvatar: "/placeholder-user.jpg",
      date: "Aug 5",
      type: "assignment",
      assignmentTitle: "Assignment #2: Learn from Anthropic Courses"
    },
    {
      id: 207,
      author: "Assignments",
      authorAvatar: "/placeholder-user.jpg",
      date: "Aug 5",
      type: "assignment",
      assignmentTitle: "Assignment #1: Analyze the Platform by SketchNote"
    },
  ]

  // Mock announcement data for CSA411 - Software Automation Testing with AI
  const csa411Announcements = [
    {
      id: 302,
      author: "Aj. Alex",
      authorAvatar: "/placeholder-user.jpg",
      date: "Nov 10",
      type: "assignment",
      assignmentTitle: "Assignment: AI-Powered Test Case Generation [25 points]"
    },
    {
      id: 303,
      author: "Aj. Alex",
      authorAvatar: "/placeholder-user.jpg",
      date: "Nov 8",
      content: `New Lecture Material Available

I've uploaded Lecture 3 on "AI-Driven Test Automation Frameworks". This covers:
• Selenium with AI enhancements
• TestCraft and AI-powered test creation
• Self-healing test automation
• Machine learning for test optimization

Please review before our next lab session on November 15th.

Best regards,
Aj. Alex`
    },
    {
      id: 304,
      author: "Aj. Alex",
      authorAvatar: "/placeholder-user.jpg",
      date: "Nov 5",
      type: "assignment",
      assignmentTitle: "Lab Exercise: Setting Up Test Automation Environment"
    },
    {
      id: 305,
      author: "Aj. Alex",
      authorAvatar: "/placeholder-user.jpg",
      date: "Oct 30",
      content: "Reminder: The Test Automation Quiz is available in AI Assistant > Quizzes. Complete it by November 20th. This quiz covers fundamental concepts of automated testing and AI integration in testing workflows."
    },
  ]

  // Mock announcement data for AI-EDU - AI for Edu week (staffs)
  const aieduAnnouncements = [
    {
      id: 403,
      author: "Aj. Alex",
      authorAvatar: "/placeholder-user.jpg",
      date: "Nov 12",
      type: "assignment",
      assignmentTitle: "Pre-Workshop Survey: Current AI Usage in Teaching"
    },
    {
      id: 404,
      author: "Aj. Alex",
      authorAvatar: "/placeholder-user.jpg",
      date: "Nov 10",
      content: `Resource Materials Available

I've uploaded reading materials and tool guides:
• ChatGPT for Educators Guide
• AI-Powered Grading Tools Comparison
• Ethical AI Use in Academic Settings
• Practical AI Integration Examples

Please review these materials before the workshop to maximize your learning experience.`,
    },
    {
      id: 405,
      author: "Aj. Alex",
      authorAvatar: "/placeholder-user.jpg",
      date: "Nov 8",
      content: "Important: Please bring your laptops to the workshop sessions. We'll be doing hands-on exercises with various AI tools. If you need a laptop, please contact the Center for Teaching and Learning in advance."
    },
  ]

  // Mock announcement data for CSM324 - Introduction to Formal English
  const csm324Announcements = [
    {
      id: 503,
      author: "Aj. Alex",
      authorAvatar: "/placeholder-user.jpg",
      date: "Nov 9",
      content: `New Reading Material Available

I've uploaded "Formal Writing Guidelines" which covers:
• Academic writing conventions
• Formal tone and style
• Proper citation formats
• Professional email writing
• Report structure and formatting

Please review this material before our next class session on November 16th.

Best regards,
Aj. Alex`
    },
    {
      id: 504,
      author: "Aj. Alex",
      authorAvatar: "/placeholder-user.jpg",
      date: "Nov 7",
      type: "assignment",
      assignmentTitle: "Worksheet: Grammar and Syntax Exercises"
    },
    {
      id: 505,
      author: "Aj. Alex",
      authorAvatar: "/placeholder-user.jpg",
      date: "Nov 4",
      content: "Reminder: The Formal English Quiz is available in AI Assistant > Quizzes. Complete it by November 25th. This quiz covers formal grammar rules, sentence structure, and academic writing conventions."
    },
    {
      id: 506,
      author: "Aj. Alex",
      authorAvatar: "/placeholder-user.jpg",
      date: "Oct 30",
      content: `Important: Midterm Exam Schedule

The midterm examination for Introduction to Formal English will be held on December 5th from 9:00 AM - 11:00 AM.

Topics covered:
• Formal grammar and syntax
• Academic writing styles
• Professional communication
• Essay structure and organization

Please prepare accordingly and bring your student ID.`
    },
  ]

  const isDemoCourse = course.id.startsWith("course-") || course.id.startsWith("mock-")

  const mapApiAnnouncement = (item: any): AnnouncementFeedItem => ({
    id: item.id,
    content: item.content || "",
    created_at: item.created_at,
    updated_at: item.updated_at,
    author: item.author?.full_name || "Teacher",
    authorAvatar: item.author?.avatar_url || "/placeholder-user.jpg",
    date: item.created_at ? new Date(item.created_at).toLocaleString() : "",
    edited: !!(item.updated_at && item.created_at && item.updated_at !== item.created_at),
    files: Array.isArray(item.files)
      ? item.files.map((f: any) => ({ id: f.id, file_name: f.file_name, file_url: f.file_url }))
      : [],
  })

  useEffect(() => {
    if (isDemoCourse) return

    let canceled = false
    const loadAnnouncements = async () => {
      setIsAnnouncementsLoading(true)
      try {
        const response = await fetch(`/api/courses/${course.id}/announcements`, { cache: "no-store" })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data?.error || "Failed to load announcements")
        }
        if (!canceled) {
          const nextItems = Array.isArray(data?.announcements) ? data.announcements.map(mapApiAnnouncement) : []
          setLiveAnnouncements(nextItems)
        }
      } catch (error) {
        if (!canceled) {
          setLiveAnnouncements([])
        }
      } finally {
        if (!canceled) {
          setIsAnnouncementsLoading(false)
        }
      }
    }

    loadAnnouncements()
    return () => {
      canceled = true
    }
  }, [course.id, isDemoCourse])

  const demoAnnouncements: AnnouncementFeedItem[] = course.code === "CSD323"
    ? csd323Announcements
    : course.code === "CSB321"
      ? csb321Announcements
      : course.code === "CSD322"
        ? csd322Announcements
        : course.code === "CSA411"
          ? csa411Announcements
          : course.code === "AI-EDU"
            ? aieduAnnouncements
            : course.code === "CSM324"
              ? csm324Announcements
              : []

  // Use hardcoded fixtures only for demo courses. Real courses load from API.
  const announcements: AnnouncementFeedItem[] = isDemoCourse ? demoAnnouncements : liveAnnouncements

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      <main className="container mx-auto flex-1 px-4 py-8">
        <Tabs defaultValue="announcements" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-[4px_4px_8px_rgba(0,0,0,0.08),-4px_-4px_8px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.2),-4px_-4px_8px_rgba(255,255,255,0.05)] rounded-xl p-1">
            <TabsTrigger 
              value="announcements"
              className="rounded-lg data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-200 data-[state=active]:to-blue-300 dark:data-[state=active]:from-blue-800 dark:data-[state=active]:to-blue-900 data-[state=active]:text-blue-800 dark:data-[state=active]:text-blue-200 data-[state=active]:font-semibold data-[state=active]:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_rgba(255,255,255,0.5)] dark:data-[state=active]:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)]"
            >
              <Bell className="mr-2 h-4 w-4" />
              Announcements
            </TabsTrigger>
            <TabsTrigger 
              value="assignments"
              className="rounded-lg data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-200 data-[state=active]:to-blue-300 dark:data-[state=active]:from-blue-800 dark:data-[state=active]:to-blue-900 data-[state=active]:text-blue-800 dark:data-[state=active]:text-blue-200 data-[state=active]:font-semibold data-[state=active]:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_rgba(255,255,255,0.5)] dark:data-[state=active]:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)]"
            >
              <CalendarClock className="mr-2 h-4 w-4" />
              Assignments
            </TabsTrigger>
            <TabsTrigger 
              value="ai-assistant"
              className="rounded-lg data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-200 data-[state=active]:to-blue-300 dark:data-[state=active]:from-blue-800 dark:data-[state=active]:to-blue-900 data-[state=active]:text-blue-800 dark:data-[state=active]:text-blue-200 data-[state=active]:font-semibold data-[state=active]:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_rgba(255,255,255,0.5)] dark:data-[state=active]:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)]"
            >
              <Bot className="mr-2 h-4 w-4" />
              AI Assistant
            </TabsTrigger>
          </TabsList>

          <TabsContent value="announcements" className="mt-6">
            {/* Announcements Feed */}
            <div className="space-y-4">
              {!isDemoCourse && isAnnouncementsLoading ? (
                <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-12 shadow-[8px_8px_16px_rgba(0,0,0,0.08),-8px_-8px_16px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_16px_rgba(0,0,0,0.3),-8px_-8px_16px_rgba(255,255,255,0.05)] text-center">
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Loading announcements...</h3>
                </div>
              ) : announcements.length === 0 ? (
                <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-12 shadow-[8px_8px_16px_rgba(0,0,0,0.08),-8px_-8px_16px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_16px_rgba(0,0,0,0.3),-8px_-8px_16px_rgba(255,255,255,0.05)] text-center">
                  <Bell className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">No announcements yet</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Your teacher hasn&apos;t posted any announcements for this course.
                  </p>
                </div>
              ) : (
                announcements.map((announcement) => (
                  <div
                    key={announcement.id}
                    className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-5 shadow-[8px_8px_16px_rgba(0,0,0,0.08),-8px_-8px_16px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_16px_rgba(0,0,0,0.3),-8px_-8px_16px_rgba(255,255,255,0.05)]"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                          <img 
                            src={announcement.authorAvatar} 
                            alt={announcement.author}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">
                            {announcement.author}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {announcement.date}
                            {announcement.edited && " (Edited " + announcement.date + ")"}
                          </p>
                        </div>
                      </div>
                      <button 
                        type="button"
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer relative z-10 p-1 -mr-1"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          console.log('Button clicked')
                          return false
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                        }}
                        style={{ pointerEvents: 'auto' }}
                      >
                        <MoreVertical className="h-5 w-5 pointer-events-none" />
                      </button>
                    </div>

                    {/* Assignment Type */}
                    {announcement.type === "assignment" && (
                      <div className="mb-4 flex items-center gap-3 p-3 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl shadow-[inset_2px_2px_4px_rgba(0,0,0,0.05),inset_-2px_-2px_4px_rgba(255,255,255,0.5)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2),inset_-2px_-2px_4px_rgba(255,255,255,0.05)]">
                        <Clipboard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <p className="text-gray-700 dark:text-gray-300">
                          {announcement.author} posted a new assignment: <span className="font-semibold">{announcement.assignmentTitle}</span>
                        </p>
                      </div>
                    )}

                    {/* Content */}
                    {announcement.content && (
                      <div className="mb-4">
                        <div className="text-gray-800 dark:text-gray-200 whitespace-pre-line leading-relaxed">
                          {announcement.content.split(/(https?:\/\/[^\s]+)/g).map((part, idx) => {
                            if (part.match(/^https?:\/\//)) {
                              return (
                                <a
                                  key={idx}
                                  href={part}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                                >
                                  {part}
                                </a>
                              )
                            }
                            return <span key={idx}>{part}</span>
                          })}
                        </div>
                      </div>
                    )}

                    {/* Groups */}
                    {announcement.groups && (
                      <div className="mb-4 space-y-3">
                        {announcement.groups.map((group, idx) => (
                          <div
                            key={idx}
                            className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.05),inset_-2px_-2px_4px_rgba(255,255,255,0.5)] dark:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2),inset_-2px_-2px_4px_rgba(255,255,255,0.05)]"
                          >
                            <div className="flex items-center gap-3 mb-2">
                              <div className={`w-8 h-8 rounded-full ${group.color} flex items-center justify-center text-white font-semibold text-sm`}>
                                {group.icon}
                              </div>
                              <span className="font-medium text-gray-800 dark:text-gray-200">{group.name}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-sm text-gray-600 dark:text-gray-400">{group.message}</p>
                              <span className="text-xs text-gray-500 dark:text-gray-500">{group.time}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Attachment */}
                    {announcement.attachment && (
                      <div className="mb-4">
                        <a 
                          href="#" 
                          className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                        >
                          {announcement.attachment}
                        </a>
                      </div>
                    )}
                    {Array.isArray(announcement.files) && announcement.files.length > 0 && (
                      <div className="mb-4 space-y-1">
                        {announcement.files.map((file) => (
                          <a
                            key={file.id}
                            href={file.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-blue-600 dark:text-blue-400 hover:underline text-sm break-all"
                          >
                            {file.file_name}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Survey Widget */}
            <SurveyWidget courseId={course.id} />
          </TabsContent>

          <TabsContent value="assignments" className="mt-6">
            <AssignmentsPanel courseId={course.id} canManage={false} />
          </TabsContent>

          <TabsContent value="ai-assistant" className="mt-6">
            <Tabs defaultValue="chat" className="w-full">
              <TabsList className="grid w-full grid-cols-4 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-[4px_4px_8px_rgba(0,0,0,0.08),-4px_-4px_8px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.2),-4px_-4px_8px_rgba(255,255,255,0.05)] rounded-xl p-1">
                <TabsTrigger 
                  value="chat"
                  className="rounded-lg data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-200 data-[state=active]:to-blue-300 dark:data-[state=active]:from-blue-800 dark:data-[state=active]:to-blue-900 data-[state=active]:text-blue-800 dark:data-[state=active]:text-blue-200 data-[state=active]:font-semibold data-[state=active]:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_rgba(255,255,255,0.5)] dark:data-[state=active]:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)]"
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  AI Chat
                </TabsTrigger>
                <TabsTrigger 
                  value="flashcards"
                  className="rounded-lg data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-200 data-[state=active]:to-blue-300 dark:data-[state=active]:from-blue-800 dark:data-[state=active]:to-blue-900 data-[state=active]:text-blue-800 dark:data-[state=active]:text-blue-200 data-[state=active]:font-semibold data-[state=active]:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_rgba(255,255,255,0.5)] dark:data-[state=active]:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)]"
                >
                  <Brain className="mr-2 h-4 w-4" />
                  Flashcards
                </TabsTrigger>
                <TabsTrigger 
                  value="quizzes"
                  className="rounded-lg data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-200 data-[state=active]:to-blue-300 dark:data-[state=active]:from-blue-800 dark:data-[state=active]:to-blue-900 data-[state=active]:text-blue-800 dark:data-[state=active]:text-blue-200 data-[state=active]:font-semibold data-[state=active]:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_rgba(255,255,255,0.5)] dark:data-[state=active]:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)]"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Quizzes
                </TabsTrigger>
                <TabsTrigger 
                  value="planner"
                  className="rounded-lg data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-200 data-[state=active]:to-blue-300 dark:data-[state=active]:from-blue-800 dark:data-[state=active]:to-blue-900 data-[state=active]:text-blue-800 dark:data-[state=active]:text-blue-200 data-[state=active]:font-semibold data-[state=active]:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_rgba(255,255,255,0.5)] dark:data-[state=active]:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)]"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  Planner
                </TabsTrigger>
              </TabsList>

              <TabsContent value="chat" className="mt-6">
                <AIChatbot
                  courseId={course.id}
                  studentId={studentId}
                  materials={materials}
                  chatbotSettings={chatbotSettings}
                />
              </TabsContent>

              <TabsContent value="flashcards" className="mt-6">
                <FlashcardsView courseId={course.id} studentId={studentId} />
              </TabsContent>

              <TabsContent value="quizzes" className="mt-6">
                <QuizzesView courseId={course.id} studentId={studentId} />
              </TabsContent>

              <TabsContent value="planner" className="mt-6">
                <StudyPlannerView courseId={course.id} courseName={course.title} />
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

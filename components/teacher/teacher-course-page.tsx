"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Upload, Settings, FileText, Sparkles, Bell, Bot, Pencil, MoreVertical, FileText as FileTextIcon, Clipboard, MessageSquare, Brain, Plus, Trash2, Users, Copy, HelpCircle, CalendarClock } from "lucide-react"
import type { Course, CourseMaterial, ChatbotSettings } from "@/lib/types"
import { UploadMaterialDialog } from "./upload-material-dialog"
import { CreateAnnouncementDialog } from "./create-announcement-dialog"
import { ChatbotSettingsForm } from "./chatbot-settings-form"
import { EditCourseDialog } from "./edit-course-dialog"
import { AssignmentsPanel } from "@/components/shared/assignments-panel"
import { ManageStudentsDialog } from "./manage-students-dialog"
import { AIChatbot } from "../student/ai-chatbot"
import { FlashcardsView } from "../student/flashcards-view"
import { QuizzesView } from "../student/quizzes-view"
import { useState, useMemo, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useToast } from "@/hooks/use-toast"

interface TeacherCoursePageProps {
  course: Course
  materials: CourseMaterial[]
  studentsCount: number
  chatbotSettings: ChatbotSettings | null
}

interface AnnouncementFileItem {
  id: string
  file_name: string
  file_url: string
  mime_type?: string | null
  size_bytes?: number | null
}

interface AnnouncementFeedItem {
  id: string | number
  content?: string
  title?: string
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

export function TeacherCoursePage({ course, materials, studentsCount, chatbotSettings }: TeacherCoursePageProps) {
  const searchParams = useSearchParams()
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false)
  const [showEditCourseDialog, setShowEditCourseDialog] = useState(false)
  const [showManageStudentsDialog, setShowManageStudentsDialog] = useState(false)
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false)
  const [liveAnnouncements, setLiveAnnouncements] = useState<AnnouncementFeedItem[]>([])
  const [isAnnouncementsLoading, setIsAnnouncementsLoading] = useState(false)
  const [faqs, setFaqs] = useState<Array<{ id: string; question: string; answer: string; created_at: string }>>([])
  const [isFaqLoading, setIsFaqLoading] = useState(false)
  const [newFaqQuestion, setNewFaqQuestion] = useState("")
  const [newFaqAnswer, setNewFaqAnswer] = useState("")
  const [isSavingFaq, setIsSavingFaq] = useState(false)
  
  // Get tab from URL query parameter, default to "materials" (Announcements)
  const tabFromUrl = searchParams.get('tab') || 'materials'
  const [activeTab, setActiveTab] = useState(tabFromUrl)
  
  // Update activeTab when URL changes
  useEffect(() => {
    const tab = searchParams.get('tab') || 'materials'
    setActiveTab(tab)
  }, [searchParams])
  
  const { toast } = useToast()

  // Generate mock enrolled students list (in production, this would come from API)
  const enrolledStudents = useMemo(() => {
    const firstNames = ["Alex", "Sarah", "John", "Emma", "Michael", "Sophia", "David", "Olivia", "James", "Isabella", "William", "Mia", "Benjamin", "Charlotte", "Daniel", "Amelia", "Matthew", "Harper", "Joseph", "Evelyn", "Andrew", "Abigail", "Joshua", "Emily", "Ryan", "Nathan", "Grace", "Lucas", "Chloe", "Henry", "Lily", "Ethan", "Zoe", "Aiden", "Madison", "Noah", "Ava", "Logan", "Ella", "Mason", "Scarlett", "Liam", "Victoria", "Jacob", "Aria", "Jackson", "Sofia", "Levi", "Hannah", "Sebastian"]
    const lastNames = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Thompson", "White", "Harris", "Sanchez", "Clark", "Lewis", "Robinson", "Walker", "Young", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell", "Carter", "Roberts", "Gomez", "Phillips", "Evans", "Turner"]
    
    return Array.from({ length: studentsCount }, (_, index) => {
      const studentNumber = 6631503101 + index
      const email = `${studentNumber}@lamduan.mfu.ac.th`
      const studentId = `mock-student-${studentNumber}`
      const firstName = firstNames[index % firstNames.length]
      const lastName = lastNames[index % lastNames.length]
      const fullName = `${firstName} ${lastName}`
      
      return {
        id: studentId,
        email,
        full_name: fullName,
      }
    })
  }, [studentsCount])

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

  const isDemoCourse = course.id.startsWith("course-") || course.id.startsWith("mock-")

  const mapApiAnnouncement = (item: any): AnnouncementFeedItem => ({
    id: item.id,
    title: item.title,
    content: item.content || "",
    created_at: item.created_at,
    updated_at: item.updated_at,
    author: item.author?.full_name || "Teacher",
    authorAvatar: item.author?.avatar_url || "/placeholder-user.jpg",
    date: item.created_at ? new Date(item.created_at).toLocaleString() : "",
    edited: !!(item.updated_at && item.created_at && item.updated_at !== item.created_at),
    files: Array.isArray(item.files)
      ? item.files.map((f: any) => ({
          id: f.id,
          file_name: f.file_name,
          file_url: f.file_url,
          mime_type: f.mime_type,
          size_bytes: f.size_bytes,
        }))
      : [],
  })

  const loadAnnouncements = async () => {
    if (isDemoCourse) return
    setIsAnnouncementsLoading(true)
    try {
      const response = await fetch(`/api/courses/${course.id}/announcements`, { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load announcements")
      }
      const nextItems = Array.isArray(data?.announcements) ? data.announcements.map(mapApiAnnouncement) : []
      setLiveAnnouncements(nextItems)
    } catch (error: any) {
      toast({
        title: "Failed to load announcements",
        description: error?.message || "Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsAnnouncementsLoading(false)
    }
  }

  useEffect(() => {
    loadAnnouncements()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            : []

  // Use hardcoded fixtures only for demo courses. Real courses load from API.
  const announcements: AnnouncementFeedItem[] = isDemoCourse ? demoAnnouncements : liveAnnouncements

  const handleDeleteAnnouncement = async (announcementId: string) => {
    if (isDemoCourse) return
    if (!confirm("Are you sure you want to delete this announcement?")) return
    try {
      const response = await fetch(`/api/courses/${course.id}/announcements/${announcementId}`, {
        method: "DELETE",
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Failed to delete announcement")
      }
      setLiveAnnouncements((prev) => prev.filter((item) => item.id !== announcementId))
      toast({
        title: "Announcement deleted",
      })
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleEditAnnouncement = async (announcement: AnnouncementFeedItem) => {
    if (isDemoCourse) return
    const nextContent = window.prompt("Edit announcement content:", announcement.content || "")
    if (nextContent == null) return
    const trimmed = nextContent.trim()
    if (!trimmed) return

    try {
      const response = await fetch(`/api/courses/${course.id}/announcements/${announcement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: trimmed,
          title: trimmed.slice(0, 80),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || "Failed to update announcement")
      }
      await loadAnnouncements()
      toast({
        title: "Announcement updated",
      })
    } catch (error: any) {
      toast({
        title: "Update failed",
        description: error?.message || "Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleGenerateQuiz = async (materialId: string) => {
    setIsGeneratingQuiz(true)
    try {
      const response = await fetch("/api/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId, courseId: course.id }),
      })
      const data = await response.json()
      alert(`Quiz "${data.quiz.title}" generated successfully!`)
    } catch (error) {
      console.error("Failed to generate quiz:", error)
      alert("Failed to generate quiz")
    } finally {
      setIsGeneratingQuiz(false)
    }
  }

  return (
    <div className="container mx-auto flex-1 px-4 py-8 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 min-h-screen">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-[4px_4px_8px_rgba(0,0,0,0.08),-4px_-4px_8px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.2),-4px_-4px_8px_rgba(255,255,255,0.05)] rounded-xl p-1">
            <TabsTrigger 
              value="materials"
              className="rounded-lg data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-200 data-[state=active]:to-blue-300 dark:data-[state=active]:from-blue-800 dark:data-[state=active]:to-blue-900 data-[state=active]:text-blue-800 dark:data-[state=active]:text-blue-200 data-[state=active]:font-semibold data-[state=active]:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_rgba(255,255,255,0.5)] dark:data-[state=active]:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)]"
            >
              <Bell className="mr-2 h-4 w-4" />
              Announcements
            </TabsTrigger>
            <TabsTrigger 
              value="settings"
              className="rounded-lg data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-200 data-[state=active]:to-blue-300 dark:data-[state=active]:from-blue-800 dark:data-[state=active]:to-blue-900 data-[state=active]:text-blue-800 dark:data-[state=active]:text-blue-200 data-[state=active]:font-semibold data-[state=active]:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_rgba(255,255,255,0.5)] dark:data-[state=active]:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)]"
            >
              <Bot className="mr-2 h-4 w-4" />
              AI Assistant
            </TabsTrigger>
          </TabsList>

          <TabsContent value="materials" className="mt-6">
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
                    Start by creating your first announcement for this course.
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button 
                          type="button"
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer relative z-10 p-1 -mr-1"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                          }}
                        >
                          <MoreVertical className="h-5 w-5 pointer-events-none" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[150px]">
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleEditAnnouncement(announcement)
                          }}
                          className="cursor-pointer"
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleDeleteAnnouncement(String(announcement.id))
                          }}
                          className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-900/20"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <Tabs defaultValue="chat" className="w-full">
              <TabsList className="grid w-full grid-cols-6 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-[4px_4px_8px_rgba(0,0,0,0.08),-4px_-4px_8px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.2),-4px_-4px_8px_rgba(255,255,255,0.05)] rounded-xl p-1">
                <TabsTrigger 
                  value="chat"
                  className="rounded-lg data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-200 data-[state=active]:to-blue-300 dark:data-[state=active]:from-blue-800 dark:data-[state=active]:to-blue-900 data-[state=active]:text-blue-800 dark:data-[state=active]:text-blue-200 data-[state=active]:font-semibold data-[state=active]:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_rgba(255,255,255,0.5)] dark:data-[state=active]:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)]"
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  AI Chat
                </TabsTrigger>
                <TabsTrigger 
                  value="assignments"
                  className="rounded-lg data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-200 data-[state=active]:to-blue-300 dark:data-[state=active]:from-blue-800 dark:data-[state=active]:to-blue-900 data-[state=active]:text-blue-800 dark:data-[state=active]:text-blue-200 data-[state=active]:font-semibold data-[state=active]:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_rgba(255,255,255,0.5)] dark:data-[state=active]:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)]"
                >
                  <CalendarClock className="mr-2 h-4 w-4" />
                  Assignments
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
                  value="faqs"
                  className="rounded-lg data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-200 data-[state=active]:to-blue-300 dark:data-[state=active]:from-blue-800 dark:data-[state=active]:to-blue-900 data-[state=active]:text-blue-800 dark:data-[state=active]:text-blue-200 data-[state=active]:font-semibold data-[state=active]:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_rgba(255,255,255,0.5)] dark:data-[state=active]:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)]"
                  onClick={() => {
                    if (faqs.length === 0 && !isFaqLoading) {
                      setIsFaqLoading(true)
                      fetch(`/api/courses/${course.id}/faqs`)
                        .then(r => r.json())
                        .then(data => setFaqs(data?.faqs || []))
                        .catch(() => {})
                        .finally(() => setIsFaqLoading(false))
                    }
                  }}
                >
                  <HelpCircle className="mr-2 h-4 w-4" />
                  FAQs
                </TabsTrigger>
                <TabsTrigger 
                  value="settings"
                  className="rounded-lg data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-200 data-[state=active]:to-blue-300 dark:data-[state=active]:from-blue-800 dark:data-[state=active]:to-blue-900 data-[state=active]:text-blue-800 dark:data-[state=active]:text-blue-200 data-[state=active]:font-semibold data-[state=active]:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.1),inset_-2px_-2px_4px_rgba(255,255,255,0.5)] dark:data-[state=active]:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)]"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="chat" className="mt-6">
                <AIChatbot
                  courseId={course.id}
                  studentId={course.teacher_id || "mock-teacher-1"}
                  materials={materials}
                  chatbotSettings={chatbotSettings}
                />
              </TabsContent>

              <TabsContent value="assignments" className="mt-6">
                <AssignmentsPanel courseId={course.id} canManage />
              </TabsContent>

              <TabsContent value="flashcards" className="mt-6">
                <FlashcardsView courseId={course.id} studentId={course.teacher_id || "mock-teacher-1"} />
              </TabsContent>

              <TabsContent value="quizzes" className="mt-6">
                <QuizzesView courseId={course.id} studentId={course.teacher_id || "mock-teacher-1"} />
              </TabsContent>

              <TabsContent value="faqs" className="mt-6">
                <Card className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-[8px_8px_16px_rgba(0,0,0,0.08),-8px_-8px_16px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_16px_rgba(0,0,0,0.3),-8px_-8px_16px_rgba(255,255,255,0.05)] border-0 rounded-2xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <HelpCircle className="h-5 w-5" />
                      Course FAQs
                    </CardTitle>
                    <CardDescription>Add frequently asked questions that the AI chatbot will prioritize when answering students.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Add new FAQ form */}
                    <div className="space-y-3 border rounded-xl p-4 bg-gray-50/50 dark:bg-gray-800/50">
                      <Input
                        placeholder="Question (e.g., What is the grading policy?)"
                        value={newFaqQuestion}
                        onChange={(e) => setNewFaqQuestion(e.target.value)}
                      />
                      <Textarea
                        placeholder="Answer"
                        value={newFaqAnswer}
                        onChange={(e) => setNewFaqAnswer(e.target.value)}
                        rows={3}
                      />
                      <Button
                        size="sm"
                        disabled={!newFaqQuestion.trim() || !newFaqAnswer.trim() || isSavingFaq}
                        onClick={async () => {
                          setIsSavingFaq(true)
                          try {
                            const res = await fetch(`/api/courses/${course.id}/faqs`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ question: newFaqQuestion, answer: newFaqAnswer }),
                            })
                            const data = await res.json()
                            if (!res.ok) throw new Error(data?.error || "Failed")
                            setFaqs((prev) => [data.faq, ...prev])
                            setNewFaqQuestion("")
                            setNewFaqAnswer("")
                            toast({ title: "FAQ added" })
                          } catch (err: any) {
                            toast({ title: "Failed", description: err?.message, variant: "destructive" })
                          } finally {
                            setIsSavingFaq(false)
                          }
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        {isSavingFaq ? "Adding..." : "Add FAQ"}
                      </Button>
                    </div>

                    {/* FAQ list */}
                    {isFaqLoading ? (
                      <p className="text-center text-muted-foreground py-4">Loading FAQs...</p>
                    ) : faqs.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">No FAQs yet. Add your first FAQ above.</p>
                    ) : (
                      <div className="space-y-3">
                        {faqs.map((faq) => (
                          <div key={faq.id} className="border rounded-xl p-4 space-y-2 group relative">
                            <p className="font-semibold text-sm">Q: {faq.question}</p>
                            <p className="text-sm text-muted-foreground">A: {faq.answer}</p>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/courses/${course.id}/faqs`, {
                                    method: "DELETE",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ faqId: faq.id }),
                                  })
                                  if (!res.ok) throw new Error("Failed")
                                  setFaqs((prev) => prev.filter((f) => f.id !== faq.id))
                                  toast({ title: "FAQ deleted" })
                                } catch {
                                  toast({ title: "Delete failed", variant: "destructive" })
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings" className="mt-6">
                <Card className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-[8px_8px_16px_rgba(0,0,0,0.08),-8px_-8px_16px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_16px_rgba(0,0,0,0.3),-8px_-8px_16px_rgba(255,255,255,0.05)] border-0 rounded-2xl">
                  <CardHeader>
                    <CardTitle>AI Chatbot Settings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChatbotSettingsForm courseId={course.id} settings={chatbotSettings} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="course-settings" className="mt-6">
            <div className="space-y-6">
              {/* Course Information Card */}
              <Card className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-[8px_8px_16px_rgba(0,0,0,0.08),-8px_-8px_16px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_16px_rgba(0,0,0,0.3),-8px_-8px_16px_rgba(255,255,255,0.05)] border-0 rounded-2xl">
                <CardHeader>
                  <CardTitle>Course Information</CardTitle>
                  <CardDescription>
                    Manage course details and settings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Course Code</Label>
                      <p className="font-medium">{(course as any).code || "N/A"}</p>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-muted-foreground">Course Title</Label>
                      <p className="font-medium">{course.title}</p>
                    </div>
                    <div className="col-span-2">
                      <Label className="text-muted-foreground">Enrolled Students</Label>
                      <p className="font-medium">{studentsCount} students</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4 border-t border-gray-300/50 dark:border-gray-700/50">
                    <Button 
                      onClick={() => setShowEditCourseDialog(true)}
                      className="bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-[4px_4px_8px_rgba(0,0,0,0.15),-4px_-4px_8px_rgba(255,255,255,0.3)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2),inset_-2px_-2px_4px_rgba(255,255,255,0.3)] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.3),-4px_-4px_8px_rgba(255,255,255,0.05)] rounded-xl transition-all"
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit Course
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={async () => {
                        const shareLink = `${window.location.origin}/studentportal/courses?enroll=${(course as any).code || course.id}`
                        try {
                          await navigator.clipboard.writeText(shareLink)
                          toast({
                            title: "Share link copied!",
                            description: "The course enrollment link has been copied to your clipboard.",
                          })
                        } catch (err) {
                          toast({
                            title: "Failed to copy",
                            description: "Please try again.",
                            variant: "destructive",
                          })
                        }
                      }}
                      className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-[4px_4px_8px_rgba(0,0,0,0.08),-4px_-4px_8px_rgba(255,255,255,0.8)] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.2),-4px_-4px_8px_rgba(255,255,255,0.05)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.08),inset_-2px_-2px_4px_rgba(255,255,255,0.8)] dark:hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] border-0 rounded-xl transition-all"
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Share Link
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Student Management Card */}
              <Card className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-[8px_8px_16px_rgba(0,0,0,0.08),-8px_-8px_16px_rgba(255,255,255,0.9)] dark:shadow-[8px_8px_16px_rgba(0,0,0,0.3),-8px_-8px_16px_rgba(255,255,255,0.05)] border-0 rounded-2xl">
                <CardHeader>
                  <CardTitle>Student Management</CardTitle>
                  <CardDescription>
                    Add or remove students from this course
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={() => setShowManageStudentsDialog(true)} 
                    className="w-full bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-[4px_4px_8px_rgba(0,0,0,0.15),-4px_-4px_8px_rgba(255,255,255,0.3)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.2),inset_-2px_-2px_4px_rgba(255,255,255,0.3)] dark:shadow-[4px_4px_8px_rgba(0,0,0,0.3),-4px_-4px_8px_rgba(255,255,255,0.05)] rounded-xl transition-all"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Manage Students
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

      <UploadMaterialDialog open={showUploadDialog} onOpenChange={setShowUploadDialog} courseId={course.id} />
      <CreateAnnouncementDialog
        open={showAnnouncementDialog}
        onOpenChange={setShowAnnouncementDialog}
        courseId={course.id}
        onCreated={loadAnnouncements}
      />
      <EditCourseDialog 
        open={showEditCourseDialog} 
        onOpenChange={setShowEditCourseDialog} 
        course={course as any}
      />
      <ManageStudentsDialog
        open={showManageStudentsDialog}
        onOpenChange={setShowManageStudentsDialog}
        courseId={course.id}
        enrolledStudents={enrolledStudents}
      />
      
      {/* Floating Action Button - Bottom Right (only show in Announcements tab) */}
      {activeTab === "materials" && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-[6px_6px_12px_rgba(0,0,0,0.2),-6px_-6px_12px_rgba(255,255,255,0.3)] hover:shadow-[inset_3px_3px_6px_rgba(0,0,0,0.25),inset_-3px_-3px_6px_rgba(255,255,255,0.3)] dark:shadow-[6px_6px_12px_rgba(0,0,0,0.4),-6px_-6px_12px_rgba(255,255,255,0.05)] transition-all duration-200 z-50 p-0"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="mb-2 min-w-[200px]">
            <DropdownMenuItem 
              onClick={() => setShowAnnouncementDialog(true)}
              className="cursor-pointer"
            >
              <Bell className="mr-2 h-4 w-4" />
              New announcement
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setShowUploadDialog(true)}
              className="cursor-pointer"
            >
              <FileText className="mr-2 h-4 w-4" />
              New material
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

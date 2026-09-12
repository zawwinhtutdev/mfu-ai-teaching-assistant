"use client"

import { motion } from "framer-motion"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  GraduationCap, 
  BookOpen, 
  Briefcase, 
  Home, 
  Leaf, 
  ExternalLink,
  Copy,
  Check,
  ArrowLeft
} from "lucide-react"
import Link from "next/link"
import { useState } from "react"

const campusLinks = {
  academic: {
    title: "🏛️ Academic & Learning Systems",
    links: [
      { name: "LMS Student", url: "https://online-learning.mfu.ac.th/", description: "Learning Management System" },
      { name: "e-Academic Doc", url: "https://regdoc.mfu.ac.th/", description: "Academic documents and records" },
      { name: "E-Services", url: "https://mfu.ac.th/mfu-5268/e-service.html", description: "University e-services portal" },
      { name: "MFU 333", url: "https://mfu333.mfu.ac.th/", description: "Student information system" },
      { name: "MFU Academy", url: "https://academy.mfu.ac.th/th", description: "Online learning platform" },
      { name: "AI for Work", url: "https://ai.mfu.ac.th/ai-%e0%b8%81%e0%b8%b1%e0%b8%9a%e0%b8%87%e0%b8%b2%e0%b8%99%e0%b8%81%e0%b8%b1%e0%b8%9a%e0%b8%84%e0%b8%99", description: "AI tools for work" }
    ]
  },
  internship: {
    title: "💼 Internship & Job Opportunities",
    links: [
      { name: "MFU JOB", url: "https://jobs.mfu.ac.th/jobs/student/login", description: "Full-time job opportunities" },
      { name: "MFU PART TIME", url: "https://jobs.mfu.ac.th/parttime/student/login", description: "Part-time job listings" },
      { name: "PRE INTERNSHIP", url: "https://pre-internship.mfu.ac.th/en/login", description: "Pre-internship preparation" },
      { name: "MFU TZWIE", url: "https://internship.mfu.ac.th", description: "Internship program management" }
    ]
  },
  services: {
    title: "🏠 Student Services",
    links: [
      { name: "Dorm Roommate", url: "https://dormitory.mfu.ac.th/info/LoginStuNew", description: "Dormitory roommate finder" },
      { name: "Student Loan", url: "https://studentloan-sdad.mfu.ac.th/login", description: "Student loan management" },
      { name: "Loan Queue Booking", url: "https://dslequeue.mfu.ac.th/", description: "Book loan consultation" },
      { name: "E-Services", url: "https://mfu.ac.th/mfu-5268/e-service.html", description: "University e-services portal" },
      { name: "MFU Smart Campus", url: "https://smart.app.mfu.ac.th/home", description: "Smart campus services" },
      { name: "REGULATION", url: "https://reg.mfu.ac.th", description: "University regulations and policies" }
    ]
  },
  campus: {
    title: "🌱 Campus Life & Facilities",
    links: [
      { name: "App Feedback", url: "https://forms.gle/mmPeLhxe1xyn9PbH8", description: "Submit app feedback" },
      { name: "MFU BookFair", url: "https://web.library.mfu.ac.th/bookfair2025/home/", description: "Library book fair" },
      { name: "Net Zero", url: "https://mfugroogreen.app.mfu.ac.th/home/", description: "Sustainability initiatives" },
      { name: "Gem Car", url: "https://shuttle.mfu.ac.th/", description: "Campus shuttle service" },
      { name: "Library", url: "https://library.mfu.ac.th/th/home/", description: "University library" },
      { name: "Digi Twins", url: "https://digitaltwins.mfu.ac.th/", description: "Digital campus twin" }
    ]
  }
}

export default function MFUCampusResourcesPage() {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedUrl(url)
      setTimeout(() => setCopiedUrl(null), 2000)
    } catch (err) {
      console.error('Failed to copy: ', err)
    }
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5
      }
    }
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <motion.div 
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-6xl"
      >
        {/* Page Header */}
        <motion.div variants={itemVariants} className="text-center mb-6 sm:mb-12">
          <h2 className="text-3xl font-bold text-balance mb-2">MFU Campus Resources</h2>
        </motion.div>

        {/* Campus Links Grid */}
        <div className="grid gap-4 sm:gap-6 lg:gap-8 grid-cols-1 md:grid-cols-2">
          {Object.entries(campusLinks).map(([key, section]) => (
            <motion.div key={key} variants={itemVariants}>
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg sm:text-xl">{section.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 sm:space-y-3">
                  {section.links.map((link, index) => (
                    <motion.div
                      key={index}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className="flex items-center justify-between p-2 sm:p-3 rounded-lg border bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors touch-manipulation"
                    >
                      <div className="flex-1 min-w-0 mr-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                          <h4 className="font-semibold text-sm sm:text-sm truncate">{link.name}</h4>
                          <Badge variant="secondary" className="text-xs w-fit">
                            {link.description}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                          {link.url}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(link.url)}
                          className="h-8 w-8 sm:h-8 sm:w-8 p-0 touch-manipulation"
                        >
                          {copiedUrl === link.url ? (
                            <Check className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                          ) : (
                            <Copy className="h-3 w-3 sm:h-4 sm:w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                          className="h-8 w-8 sm:h-8 sm:w-8 p-0 touch-manipulation"
                        >
                          <Link href={link.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Link>
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <motion.div variants={itemVariants} className="mt-6 sm:mt-8 lg:mt-12 text-center">
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 px-4">
            Need help? Contact the AI Teaching Assistant or visit the university help desk.
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}








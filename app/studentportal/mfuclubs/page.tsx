"use client"

import { motion } from "framer-motion"
import { 
  Users,
  Facebook,
  Building2,
  GraduationCap
} from "lucide-react"

const clubLinks = {
  studentClubs: {
    title: "Student Clubs",
    icon: Users,
    color: "bg-[#A81D24]",
    links: [
      { name: "Global MFU", url: "https://www.facebook.com/global.mfu", description: "Global Relations Division" },
      { name: "International Student Club MFU", url: "https://www.facebook.com/International-Student-Club-MFU-100864178254350", description: "For international students" },
      { name: "MFU Board Game Club", url: "https://www.facebook.com/MFU.BG.Club", description: "Board game enthusiasts" },
      { name: "Muslim Student Society (MC MFU)", url: "https://www.facebook.com/MuslimMFU", description: "Muslim student community" },
      { name: "MFU Speak Up Society", url: "https://sites.google.com/mfu.ac.th/mfuspeakupsociety/home", description: "Public speaking & critical thinking" },
    ]
  },
  organizations: {
    title: "Student Organizations",
    icon: Building2,
    color: "bg-[#A81D24]",
    links: [
      { name: "Student Development Affairs Division", url: "https://www.facebook.com/sdadmfu", description: "Student activities & development" },
      { name: "MFU Student Union", url: "https://www.facebook.com/mfu.su", description: "Student representation" },
      { name: "Student Council of MFU", url: "https://www.facebook.com/StudentCouncilofMaeFahLuangUniversity", description: "Official student council" },
      { name: "MFU Character", url: "https://www.facebook.com/mfucharacter", description: "Character development programs" },
      { name: "MFU Activities", url: "https://www.facebook.com/mfuactivities", description: "Student activities & events" },
      { name: "MFU Library", url: "https://www.facebook.com/MFULIBRARY", description: "University library services" },
    ]
  }
}

export default function MFUClubsPage() {

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-black dark:via-gray-950 dark:to-black">
      {/* iOS-style blur background */}
      <div className="fixed inset-0 bg-gradient-to-br from-blue-50/30 via-purple-50/20 to-pink-50/30 dark:from-blue-950/20 dark:via-purple-950/10 dark:to-pink-950/20 pointer-events-none" />
      
      <div className="relative z-10 container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-4xl">
        {/* iOS-style Section Groups */}
        <div className="space-y-6">
          {Object.entries(clubLinks).map(([key, section], sectionIndex) => {
            const Icon = section.icon
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2 + sectionIndex * 0.1 }}
              >
                {/* Section Header */}
                <div className="mb-3 px-1">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl ${section.color} flex items-center justify-center shadow-md`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {section.title}
                    </h2>
                  </div>
                </div>

                {/* iOS-style List Group */}
                <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-3xl overflow-hidden border border-gray-200/50 dark:border-gray-800/50 shadow-lg shadow-black/5">
                  {section.links.map((link, index) => (
                    <motion.a
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      className={`
                        flex items-center p-4 active:bg-gray-50 dark:active:bg-gray-800/50 transition-colors
                        ${index !== section.links.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''}
                      `}
                    >
                      {/* Club Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-semibold text-gray-900 dark:text-white text-base truncate">
                            {link.name}
                          </h3>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {link.description}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Facebook className="h-3 w-3 text-blue-500" />
                          <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
                            {link.url.replace('https://www.', '').replace('https://', '')}
                          </span>
                        </div>
                      </div>
                    </motion.a>
                  ))}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* iOS-style Footer Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="mt-8"
        >
          <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-3xl p-5 border border-gray-200/50 dark:border-gray-800/50 shadow-lg shadow-black/5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center flex-shrink-0">
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-2">
                  Need More Information?
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  Contact the Student Development Affairs Division at{" "}
                  <a 
                    href="mailto:student.division@mfu.ac.th" 
                    className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
                  >
                    student.division@mfu.ac.th
                  </a>
                  {" "}or visit the M for U Centre (M4U).
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Bottom spacing for iOS-style safe area */}
        <div className="h-8" />
      </div>
    </div>
  )
}

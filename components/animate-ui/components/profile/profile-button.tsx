"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { User, Settings, LogOut, Coins, MessageSquare, ChevronUp } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/animate-ui/components/radix/dropdown-menu"
import { cn } from "@/lib/utils"
import { SettingsModal } from "@/components/settings-modal"
import { FeedbackModal } from "@/components/feedback-modal"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface ProfileButtonProps {
  userName?: string
  userEmail?: string
  userRole?: string
  className?: string
  onProfileClick?: () => void
  onSettingsClick?: () => void
  onLogoutClick?: () => void
  onTokenUsageClick?: () => void
  onFeedbackClick?: () => void
}

export function ProfileButton({
  userName = "Manoj Rayi",
  userEmail = "manoj@mfu.ac.th",
  userRole = "Student",
  className,
  onProfileClick,
  onSettingsClick,
  onLogoutClick,
  onTokenUsageClick,
  onFeedbackClick,
}: ProfileButtonProps) {
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false)
  const [isFeedbackOpen, setIsFeedbackOpen] = React.useState(false)
  const [isProfileOpen, setIsProfileOpen] = React.useState(false)
  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <motion.button
          className={cn(
            "flex items-center gap-3 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 px-3 py-2 text-gray-900 dark:text-gray-100 transition-all duration-200 border border-gray-200 dark:border-gray-700 w-full",
            className
          )}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-red-500 to-red-600">
            <User className="h-4 w-4 text-white" />
          </div>
          <div className="flex flex-col items-start flex-1">
            <span className="text-sm font-medium">{userName}</span>
            <span className="text-xs text-gray-600 dark:text-gray-400 capitalize">{userRole}</span>
          </div>
          <ChevronUp className="h-4 w-4 text-gray-500" />
        </motion.button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <div className="px-3 py-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-red-500 to-red-600">
              <User className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-gray-900">{userName}</span>
              <span className="text-xs text-gray-500">{userEmail}</span>
            </div>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setIsSettingsOpen(true)} className="cursor-pointer">
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => e.preventDefault()} className="cursor-pointer">
          <Coins className="mr-2 h-4 w-4" />
          <span>Token Usage</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setIsFeedbackOpen(true)} className="cursor-pointer">
          <MessageSquare className="mr-2 h-4 w-4" />
          <span>Feedback</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogoutClick} className="cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    
    {/* Settings Modal */}
    <SettingsModal 
      isOpen={isSettingsOpen} 
      onClose={() => setIsSettingsOpen(false)} 
    />
    
    {/* Feedback Modal */}
    <FeedbackModal 
      isOpen={isFeedbackOpen} 
      onClose={() => setIsFeedbackOpen(false)} 
    />

    {/* Profile Card Dialog */}
    <Dialog open={isProfileOpen} onOpenChange={(open) => { if (!open) setIsProfileOpen(false) }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Profile</DialogTitle>
        </DialogHeader>
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-red-500 to-red-600">
              <User className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-col">
              <CardTitle className="text-base">{userName}</CardTitle>
              <span className="text-xs text-gray-500">{userEmail}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="text-gray-500">Role</div>
              <div className="capitalize">{userRole}</div>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  </>
  )
}

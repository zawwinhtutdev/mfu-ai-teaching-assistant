"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface TextAnimateProps {
  children: string
  animation?: "blurInUp" | "fadeInUp" | "slideInUp" | "bounceInUp" | "zoomInUp"
  by?: "character" | "word" | "line"
  once?: boolean
  delay?: number
  duration?: number
  className?: string
}

export function TextAnimate({
  children,
  animation = "blurInUp",
  by = "character",
  once = true,
  delay = 0,
  duration = 0.5,
  className,
}: TextAnimateProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [animatedText, setAnimatedText] = useState("")
  const elementRef = useRef<HTMLSpanElement>(null)

  // Initialize with the text content
  useEffect(() => {
    const text = typeof children === 'string' ? children : String(children)
    setAnimatedText(text)
  }, [children])

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          if (once) {
            observer.unobserve(entry.target)
          }
        } else if (!once) {
          setIsVisible(false)
        }
      },
      { threshold: 0.1 }
    )

    if (elementRef.current) {
      observer.observe(elementRef.current)
    }

    return () => observer.disconnect()
  }, [once])

  useEffect(() => {
    if (!isVisible) return

    // Ensure children is a string and not empty
    const text = typeof children === 'string' ? children : String(children)
    if (!text || text.trim() === '') return
    
    const delayPerItem = 50 // ms

    if (by === "character") {
      let currentIndex = 0
      const interval = setInterval(() => {
        if (currentIndex <= text.length) {
          setAnimatedText(text.slice(0, currentIndex))
          currentIndex++
        } else {
          clearInterval(interval)
        }
      }, delayPerItem)
      return () => clearInterval(interval)
    } else if (by === "word") {
      const words = text.split(" ")
      let currentIndex = 0
      const interval = setInterval(() => {
        if (currentIndex <= words.length) {
          setAnimatedText(words.slice(0, currentIndex).join(" "))
          currentIndex++
        } else {
          clearInterval(interval)
        }
      }, delayPerItem * 2)
      return () => clearInterval(interval)
    } else if (by === "line") {
      const lines = text.split("\n")
      let currentIndex = 0
      const interval = setInterval(() => {
        if (currentIndex <= lines.length) {
          setAnimatedText(lines.slice(0, currentIndex).join("\n"))
          currentIndex++
        } else {
          clearInterval(interval)
        }
      }, delayPerItem * 3)
      return () => clearInterval(interval)
    }
  }, [isVisible, children, by])

  const getAnimationClasses = () => {
    const baseClasses = "transition-all duration-500 ease-out"
    
    if (!isVisible) {
      switch (animation) {
        case "blurInUp":
          return `${baseClasses} opacity-0 blur-sm translate-y-4`
        case "fadeInUp":
          return `${baseClasses} opacity-0 translate-y-4`
        case "slideInUp":
          return `${baseClasses} opacity-0 translate-y-8`
        case "bounceInUp":
          return `${baseClasses} opacity-0 translate-y-12 scale-95`
        case "zoomInUp":
          return `${baseClasses} opacity-0 translate-y-4 scale-95`
        default:
          return `${baseClasses} opacity-0 translate-y-4`
      }
    } else {
      return `${baseClasses} opacity-100 translate-y-0 blur-0 scale-100`
    }
  }

  return (
    <span
      ref={elementRef}
      className={cn(getAnimationClasses(), className)}
      style={{
        transitionDelay: `${delay}ms`,
        transitionDuration: `${duration}s`,
      }}
    >
      {animatedText}
      {isVisible && by === "character" && (
        <span className="animate-pulse">|</span>
      )}
    </span>
  )
}

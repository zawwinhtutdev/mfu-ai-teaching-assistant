"use client"

import * as React from "react"
import { AnimateButton } from "../../../components/buttons/button"
import { cn } from "@/lib/utils"

interface DemoButtonProps {
  children: React.ReactNode
  className?: string
  animationType?: "bounce" | "pulse" | "shake" | "glow" | "slide" | "rotate"
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "gradient" | "animated"
  size?: "default" | "sm" | "lg" | "icon" | "animated"
  onClick?: () => void
}

const DemoButton = React.forwardRef<HTMLButtonElement, DemoButtonProps>(
  ({ 
    children, 
    className, 
    animationType = "pulse",
    variant = "gradient",
    size = "default",
    onClick,
    ...props 
  }, ref) => {
    return (
      <AnimateButton
        ref={ref}
        animationType={animationType}
        variant={variant}
        size={size}
        className={cn(
          "font-medium",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
          className
        )}
        onClick={onClick}
        {...props}
      >
        {children}
      </AnimateButton>
    )
  }
)

DemoButton.displayName = "DemoButton"

export { DemoButton }

"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Button as BaseButton, type ButtonProps } from "../../primitives/buttons/button"

interface AnimateButtonProps extends ButtonProps {
  animationType?: "bounce" | "pulse" | "shake" | "glow" | "slide" | "rotate"
  delay?: number
  duration?: number
}

const animationVariants = {
  bounce: {
    hover: { y: -4, transition: { type: "spring", stiffness: 400, damping: 10 } },
    tap: { y: 0, scale: 0.95 }
  },
  pulse: {
    hover: { scale: 1.05 },
    tap: { scale: 0.95 }
  },
  shake: {
    hover: { x: [-2, 2, -2, 2, 0], transition: { duration: 0.5 } },
    tap: { scale: 0.95 }
  },
  glow: {
    hover: { 
      boxShadow: "0 0 20px rgba(59, 130, 246, 0.5)",
      scale: 1.05
    },
    tap: { scale: 0.95 }
  },
  slide: {
    hover: { x: 4, transition: { type: "spring", stiffness: 300 } },
    tap: { scale: 0.95 }
  },
  rotate: {
    hover: { rotate: 5, scale: 1.05 },
    tap: { rotate: 0, scale: 0.95 }
  }
}

const AnimateButton = React.forwardRef<HTMLButtonElement, AnimateButtonProps>(
  ({ 
    className, 
    animationType = "pulse", 
    delay = 0, 
    duration = 0.2,
    children,
    ...props 
  }, ref) => {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration }}
        whileHover={animationVariants[animationType].hover as any}
        whileTap={animationVariants[animationType].tap as any}
      >
        <BaseButton
          ref={ref}
          className={cn(
            "relative overflow-hidden",
            "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent",
            "before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-700",
            className
          )}
          {...props}
        >
          <span className="relative z-10">{children}</span>
        </BaseButton>
      </motion.div>
    )
  }
)

AnimateButton.displayName = "AnimateButton"

export { AnimateButton }

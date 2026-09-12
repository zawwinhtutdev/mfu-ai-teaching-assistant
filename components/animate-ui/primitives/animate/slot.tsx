"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"

interface AnimateSlotProps extends React.ComponentPropsWithoutRef<typeof Slot> {
  children: React.ReactNode
}

const AnimateSlot = React.forwardRef<
  React.ElementRef<typeof Slot>,
  AnimateSlotProps
>(({ className, children, ...props }, ref) => {
  return (
    <Slot
      ref={ref}
      className={cn(
        "transition-all duration-200 ease-in-out",
        "hover:scale-105 active:scale-95",
        className
      )}
      {...props}
    >
      {children}
    </Slot>
  )
})

AnimateSlot.displayName = "AnimateSlot"

export { AnimateSlot }

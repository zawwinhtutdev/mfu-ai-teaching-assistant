'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { ChevronDownIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

const AnimatedAccordion = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Root> & {
    animationType?: 'slide' | 'fade' | 'scale' | 'bounce'
  }
>(({ animationType = 'slide', ...props }, ref) => {
  return (
    <AccordionPrimitive.Root
      ref={ref}
      data-slot="accordion"
      className={cn('space-y-2', props.className)}
      {...props}
    />
  )
})
AnimatedAccordion.displayName = 'AnimatedAccordion'

const AnimatedAccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => {
  return (
    <AccordionPrimitive.Item
      ref={ref}
      data-slot="accordion-item"
      className={cn(
        'rounded-lg border bg-card text-card-foreground shadow-sm',
        className
      )}
      {...props}
    />
  )
})
AnimatedAccordionItem.displayName = 'AnimatedAccordionItem'

const AnimatedAccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger> & {
    animationType?: 'bounce' | 'pulse' | 'glow' | 'slide'
  }
>(({ className, children, animationType = 'slide', ...props }, ref) => {
  const getAnimationVariants = () => {
    switch (animationType) {
      case 'bounce':
        return {
          whileHover: { scale: 1.02 },
          whileTap: { scale: 0.98 }
        }
      case 'pulse':
        return {
          whileHover: { scale: 1.01 },
          transition: { duration: 0.2, repeat: Infinity, repeatType: 'reverse' as const }
        }
      case 'glow':
        return {
          whileHover: { boxShadow: '0 0 20px rgba(147, 51, 234, 0.3)' }
        }
      case 'slide':
      default:
        return {
          whileHover: { x: 4 }
        }
    }
  }

  return (
    <AccordionPrimitive.Header className="flex">
      <motion.div
        {...getAnimationVariants()}
        className="w-full"
      >
        <AccordionPrimitive.Trigger
          ref={ref}
          data-slot="accordion-trigger"
          className={cn(
            'flex flex-1 items-center justify-between rounded-md px-4 py-3 text-left text-sm font-medium transition-all hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180',
            className
          )}
          {...props}
        >
          {children}
          <ChevronDownIcon className="text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-200" />
        </AccordionPrimitive.Trigger>
      </motion.div>
    </AccordionPrimitive.Header>
  )
})
AnimatedAccordionTrigger.displayName = 'AnimatedAccordionTrigger'

const AnimatedAccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content> & {
    animationType?: 'slide' | 'fade' | 'scale' | 'bounce'
  }
>(({ className, children, animationType = 'slide', ...props }, ref) => {
  const getAnimationVariants = () => {
    switch (animationType) {
      case 'fade':
        return {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 }
        }
      case 'scale':
        return {
          initial: { opacity: 0, scale: 0.95 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.95 }
        }
      case 'bounce':
        return {
          initial: { opacity: 0, y: -10 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: -10 }
        }
      case 'slide':
      default:
        return {
          initial: { opacity: 0, height: 0 },
          animate: { opacity: 1, height: 'auto' },
          exit: { opacity: 0, height: 0 }
        }
    }
  }

  return (
    <AnimatePresence>
      <AccordionPrimitive.Content
        ref={ref}
        data-slot="accordion-content"
        className="overflow-hidden"
        {...props}
      >
        <motion.div
          variants={getAnimationVariants()}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className={cn('px-4 pb-3 text-sm', className)}
        >
          {children}
        </motion.div>
      </AccordionPrimitive.Content>
    </AnimatePresence>
  )
})
AnimatedAccordionContent.displayName = 'AnimatedAccordionContent'

export {
  AnimatedAccordion,
  AnimatedAccordionItem,
  AnimatedAccordionTrigger,
  AnimatedAccordionContent
}

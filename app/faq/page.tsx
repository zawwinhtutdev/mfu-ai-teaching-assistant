'use client'

import { motion } from 'framer-motion'
import { HelpCircle } from 'lucide-react'
import { 
  AnimatedAccordion, 
  AnimatedAccordionItem, 
  AnimatedAccordionTrigger, 
  AnimatedAccordionContent 
} from '@/components/animate-ui'

const faqData = [
      {
        question: 'How do I start a conversation with the AI assistant?',
        answer: 'Simply navigate to the Chat page from your dashboard and type your question in the message input. The AI assistant will respond instantly with helpful information about your courses, study materials, or any academic questions you have.'
      },
      {
        question: 'Can I generate flashcards from my course materials?',
        answer: 'Yes! Go to your enrolled course page and click on the "Flashcards" tab. You can generate AI-powered flashcards based on the course materials, or create custom flashcards for specific topics you want to study.'
      },
      {
        question: 'How do I create a new course?',
        answer: 'From your teacher dashboard, click the "Create Course" button. Fill in the course details including title, description, and schedule. Once created, you can start adding materials and enrolling students.'
      },
      {
        question: 'What browsers are supported?',
        answer: 'We recommend using the latest versions of Chrome, Firefox, Safari, or Edge for the best experience. The platform is built with modern web standards and works on all major browsers.'
      },
      {
    question: 'Can I access the platform with any email address?',
    answer: 'No, the AI Teaching Assistant platform is exclusively available to university students and faculty. You can only access the platform using your official university email address (e.g., @mfu.ac.th, @lamduan.mfu.ac.th). This ensures that only authorized university members can use the educational AI assistant.'
      }
    ]

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

export default function FAQPage() {

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="space-y-8"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="text-center space-y-4">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <HelpCircle className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Frequently Asked Questions</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Find answers to common questions about the AI Teaching Assistant platform
          </p>
        </motion.div>


        {/* FAQ List */}
        <motion.div variants={itemVariants}>
                    <AnimatedAccordion 
                      type="multiple" 
            className="space-y-0"
                      animationType="slide"
                    >
            {faqData.map((faq, index) => (
              <AnimatedAccordionItem key={index} value={`item-${index}`} className="border-none">
                          <AnimatedAccordionTrigger 
                  animationType="slide"
                  className="text-left border-none hover:underline hover:bg-transparent py-4 transition-all duration-200"
                          >
                            {faq.question}
                          </AnimatedAccordionTrigger>
                <AnimatedAccordionContent animationType="fade" className="pb-4">
                            <div className="text-muted-foreground leading-relaxed">
                              {faq.answer}
                            </div>
                          </AnimatedAccordionContent>
                {index < faqData.length - 1 && (
                  <div className="border-b border-gray-200/20" />
                )}
                        </AnimatedAccordionItem>
                      ))}
                    </AnimatedAccordion>
        </motion.div>


      </motion.div>
    </div>
  )
}

export type DocsNavItem = {
  title: string
  description: string
  href: string
  file: string
  icon: string
  keywords?: string[]
}

export type DocsNavGroup = {
  type: "group"
  title: string
  icon: string
  defaultOpen?: boolean
  items: DocsNavNode[]
}

export type DocsNavNode = DocsNavItem | DocsNavGroup

export type DocsNavSection = {
  title: string
  items: DocsNavNode[]
}

export type DocsSearchItem = DocsNavItem & {
  content: string
  section: string
}

export function isDocsNavGroup(node: DocsNavNode): node is DocsNavGroup {
  return "type" in node && node.type === "group"
}

export const docsNavigation: DocsNavSection[] = [
  {
    title: "Getting started",
    items: [
      {
        title: "Find your way around MFU AI",
        description: "Choose a practical learning, teaching, or platform-operations mission.",
        href: "/docs",
        file: "index.md",
        icon: "sparkles",
        keywords: ["introduction", "overview", "home"],
      },
      {
        title: "Create an account",
        description: "Register with your university email address.",
        href: "/docs/getting-started/create-account",
        file: "getting-started/create-account.md",
        icon: "user-plus",
        keywords: ["signup", "register", "email"],
      },
      {
        title: "Sign in",
        description: "Access the platform and the correct portal.",
        href: "/docs/getting-started/sign-in",
        file: "getting-started/sign-in.md",
        icon: "log-in",
        keywords: ["login", "password", "authentication"],
      },
      {
        title: "Platform interface",
        description: "Understand navigation, themes, and account controls.",
        href: "/docs/getting-started/interface",
        file: "getting-started/interface.md",
        icon: "panels-top-left",
        keywords: ["navigation", "sidebar", "settings"],
      },
    ],
  },
  {
    title: "Core platform features",
    items: [
      {
        type: "group",
        title: "AI workspace",
        icon: "sparkles",
        items: [
          {
            title: "AI chat and conversations",
            description: "Start chats, choose a model, attach files, and revisit saved conversations.",
            href: "/docs/core/ai-chat",
            file: "core/ai-chat.md",
            icon: "message-circle",
            keywords: ["chat", "conversation history", "model", "attachments", "feedback"],
          },
          {
            title: "Document RAG workspace",
            description: "Upload, index, search, and chat with supported documents.",
            href: "/docs/core/document-rag",
            file: "core/document-rag.md",
            icon: "files",
            keywords: ["rag", "upload", "index", "reindex", "documents"],
          },
          {
            title: "Study workspace",
            description: "Understand how course chat, flashcards, quizzes, and plans fit together.",
            href: "/docs/core/study-workspace",
            file: "core/study-workspace.md",
            icon: "brain",
            keywords: ["study", "flashcards", "quiz", "planner", "courses"],
          },
        ],
      },
      {
        type: "group",
        title: "Planning and resources",
        icon: "layout-list",
        items: [
          {
            title: "Calendar and reminders",
            description: "Keep track of course dates, events, and personal reminders.",
            href: "/docs/core/calendar-reminders",
            file: "core/calendar-reminders.md",
            icon: "calendar-days",
            keywords: ["schedule", "events", "deadlines", "notifications"],
          },
          {
            title: "MFU campus resources",
            description: "Find useful university services and community links.",
            href: "/docs/core/campus-resources",
            file: "core/campus-resources.md",
            icon: "landmark",
            keywords: ["campus", "links", "services", "social"],
          },
          {
            title: "Account and settings",
            description: "Manage profile, display, privacy, and sign-out options.",
            href: "/docs/core/account-settings",
            file: "core/account-settings.md",
            icon: "settings",
            keywords: ["profile", "theme", "password", "account"],
          },
        ],
      },
    ],
  },
  {
    title: "AI skills and responsible use",
    items: [
      {
        type: "group",
        title: "Prompting techniques",
        icon: "lightbulb",
        items: [
          {
            title: "Prompting basics",
            description: "Write focused prompts that produce useful learning support.",
            href: "/docs/ai-skills/prompting-basics",
            file: "ai-skills/prompting-basics.md",
            icon: "message-square-text",
            keywords: ["prompt engineering", "questions", "instructions"],
          },
          {
            title: "Role and audience prompting",
            description: "Set a useful role, learner level, and communication style.",
            href: "/docs/ai-skills/role-audience",
            file: "ai-skills/role-audience.md",
            icon: "users-round",
            keywords: ["persona", "audience", "level", "tone", "role"],
          },
          {
            title: "Examples and output formats",
            description: "Use examples and explicit formats to make responses more consistent.",
            href: "/docs/ai-skills/examples-output",
            file: "ai-skills/examples-output.md",
            icon: "layout-list",
            keywords: ["few shot", "examples", "format", "rubric", "template"],
          },
          {
            title: "Choose source context",
            description: "Tell the assistant which course and documents to use.",
            href: "/docs/ai-skills/source-context",
            file: "ai-skills/source-context.md",
            icon: "book-open-check",
            keywords: ["rag", "sources", "grounding", "context"],
          },
          {
            title: "Evaluate AI answers",
            description: "Check accuracy, evidence, relevance, and uncertainty.",
            href: "/docs/ai-skills/evaluate-answers",
            file: "ai-skills/evaluate-answers.md",
            icon: "badge-check",
            keywords: ["verify", "fact check", "hallucination", "citations"],
          },
        ],
      },
      {
        title: "Responsible AI use",
        description: "Use AI in ways that support learning and academic integrity.",
        href: "/docs/ai-skills/responsible-use",
        file: "ai-skills/responsible-use.md",
        icon: "scale",
        keywords: ["ethics", "integrity", "assessment", "policy"],
      },
    ],
  },
  {
    title: "For students",
    items: [
      {
        title: "Student portal",
        description: "Find courses, reminders, resources, and settings.",
        href: "/docs/students/student-portal",
        file: "students/student-portal.md",
        icon: "graduation-cap",
        keywords: ["dashboard", "courses", "student"],
      },
      {
        title: "Course workspace",
        description: "Use announcements, materials, FAQs, AI support, and practice activities in one course.",
        href: "/docs/students/course-workspace",
        file: "students/course-workspace.md",
        icon: "book-open-check",
        keywords: ["course", "announcements", "materials", "faq", "tabs"],
      },
      {
        type: "group",
        title: "Learning with AI",
        icon: "brain",
        items: [
          {
            title: "Chat with the AI assistant",
            description: "Ask useful, course-focused questions and review answers.",
            href: "/docs/students/ai-assistant",
            file: "students/ai-assistant.md",
            icon: "message-circle",
            keywords: ["chat", "prompt", "conversation", "assistant"],
          },
          {
            title: "AI study tools",
            description: "Use summaries, quizzes, flashcards, and study support.",
            href: "/docs/students/study-tools",
            file: "students/study-tools.md",
            icon: "brain",
            keywords: ["quiz", "flashcards", "summary", "study"],
          },
          {
            title: "Study with flashcards",
            description: "Open a course card set, reveal answers, and review each concept.",
            href: "/docs/students/flashcards",
            file: "students/flashcards.md",
            icon: "brain",
            keywords: ["flashcards", "flip", "question", "answer", "review"],
          },
          {
            title: "Take a practice quiz",
            description: "Complete course quizzes and use the result to plan another review cycle.",
            href: "/docs/students/quizzes",
            file: "students/quizzes.md",
            icon: "badge-check",
            keywords: ["quiz", "score", "answer", "practice", "questions"],
          },
          {
            title: "Plan study tasks",
            description: "Create, prioritize, complete, and generate course study tasks.",
            href: "/docs/students/study-planner",
            file: "students/study-planner.md",
            icon: "calendar-days",
            keywords: ["study planner", "tasks", "priority", "ai plan", "schedule"],
          },
          {
            title: "Course documents",
            description: "Work with course materials used by document search.",
            href: "/docs/students/course-documents",
            file: "students/course-documents.md",
            icon: "files",
            keywords: ["rag", "pdf", "materials", "documents"],
          },
        ],
      },
    ],
  },
  {
    title: "For teachers",
    items: [
      {
        title: "Teacher portal",
        description: "Manage courses, teaching tools, and learner activity.",
        href: "/docs/teachers/teacher-portal",
        file: "teachers/teacher-portal.md",
        icon: "presentation",
        keywords: ["teacher", "dashboard", "courses"],
      },
      {
        type: "group",
        title: "Course setup and delivery",
        icon: "folder-cog",
        items: [
          {
            title: "Create and manage courses",
            description: "Set up course details and manage the teaching workspace.",
            href: "/docs/teachers/course-management",
            file: "teachers/course-management.md",
            icon: "folder-plus",
            keywords: ["create course", "course details", "enrollment"],
          },
          {
            title: "Invite and enroll students",
            description: "Share the course enrollment link and verify student access.",
            href: "/docs/teachers/student-enrollment",
            file: "teachers/student-enrollment.md",
            icon: "users-round",
            keywords: ["invite", "enrollment", "share link", "students", "access"],
          },
          {
            title: "Announcements and FAQs",
            description: "Publish course updates and maintain trusted answers to common questions.",
            href: "/docs/teachers/announcements-faqs",
            file: "teachers/announcements-faqs.md",
            icon: "message-square-text",
            keywords: ["announcement", "faq", "attachment", "course updates"],
          },
          {
            title: "Manage course materials",
            description: "Upload and organize content that grounds AI answers.",
            href: "/docs/teachers/course-materials",
            file: "teachers/course-materials.md",
            icon: "folder-up",
            keywords: ["upload", "documents", "rag", "pdf"],
          },
        ],
      },
      {
        type: "group",
        title: "Course AI assistant",
        icon: "bot",
        items: [
          {
            title: "Build a course assistant",
            description: "Configure an AI assistant for a course.",
            href: "/docs/teachers/course-assistant",
            file: "teachers/course-assistant.md",
            icon: "bot",
            keywords: ["agent builder", "instructions", "assistant"],
          },
          {
            title: "Model and system prompt",
            description: "Choose a course model and write the assistant's main instruction.",
            href: "/docs/teachers/assistant-model-prompt",
            file: "teachers/assistant-model-prompt.md",
            icon: "settings",
            keywords: ["model", "system prompt", "gemini", "instruction", "general settings"],
          },
          {
            title: "Tone, grading, and rules",
            description: "Control communication style and add course-specific boundaries.",
            href: "/docs/teachers/assistant-tone-rules",
            file: "teachers/assistant-tone-rules.md",
            icon: "sliders-horizontal",
            keywords: ["tone", "grading policy", "course rules", "behavior", "boundaries"],
          },
          {
            title: "Test the assistant",
            description: "Use a repeatable test set before students rely on the assistant.",
            href: "/docs/teachers/test-assistant",
            file: "teachers/test-assistant.md",
            icon: "badge-check",
            keywords: ["test", "quality", "release", "evaluation", "edge cases"],
          },
        ],
      },
      {
        title: "Analytics",
        description: "Review usage and learning activity signals.",
        href: "/docs/teachers/analytics",
        file: "teachers/analytics.md",
        icon: "chart-no-axes-combined",
        keywords: ["reports", "usage", "queries"],
      },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        title: "Admin console",
        description: "Manage users, policies, privacy, and audit records.",
        href: "/docs/administrators/admin-console",
        file: "administrators/admin-console.md",
        icon: "shield-check",
        keywords: ["admin", "users", "audit", "policies"],
      },
      {
        type: "group",
        title: "Platform operations",
        icon: "sliders-horizontal",
        items: [
          {
            title: "Users and roles",
            description: "Review accounts and apply role-based access carefully.",
            href: "/docs/administrators/users-roles",
            file: "administrators/users-roles.md",
            icon: "users-round",
            keywords: ["accounts", "rbac", "permissions", "roles"],
          },
          {
            title: "Privacy and security",
            description: "Apply privacy controls and handle sensitive data safely.",
            href: "/docs/administrators/privacy-security",
            file: "administrators/privacy-security.md",
            icon: "lock-keyhole",
            keywords: ["privacy", "security", "consent", "data"],
          },
          {
            title: "Audits and notifications",
            description: "Review audit records and notification operations.",
            href: "/docs/administrators/audits-notifications",
            file: "administrators/audits-notifications.md",
            icon: "scroll-text",
            keywords: ["audit log", "notifications", "events", "jobs"],
          },
        ],
      },
    ],
  },
  {
    title: "Account and support",
    items: [
      {
        title: "Frequently asked questions",
        description: "Quick answers to common platform questions.",
        href: "/docs/support/faq",
        file: "support/faq.md",
        icon: "circle-help",
        keywords: ["faq", "questions", "help"],
      },
      {
        title: "Troubleshooting",
        description: "Resolve sign-in, browser, upload, and response issues.",
        href: "/docs/support/troubleshooting",
        file: "support/troubleshooting.md",
        icon: "wrench",
        keywords: ["error", "problem", "support", "fix"],
      },
      {
        title: "Contact the team",
        description: "Prepare a useful support request and reach the project team.",
        href: "/docs/support/contact",
        file: "support/contact.md",
        icon: "life-buoy",
        keywords: ["contact", "bug report", "feedback", "support"],
      },
    ],
  },
]

function flattenNodes(nodes: DocsNavNode[]): DocsNavItem[] {
  return nodes.flatMap((node) => isDocsNavGroup(node) ? flattenNodes(node.items) : [node])
}

export const docsPages = docsNavigation.flatMap((section) => flattenNodes(section.items))

export function getDocsPageByHref(href: string) {
  return docsPages.find((page) => page.href === href)
}

export function getDocsPageNeighbors(href: string) {
  const index = docsPages.findIndex((page) => page.href === href)

  return {
    previous: index > 0 ? docsPages[index - 1] : null,
    next: index >= 0 && index < docsPages.length - 1 ? docsPages[index + 1] : null,
  }
}

function findNodeTrail(nodes: DocsNavNode[], href: string, trail: string[] = []): string[] | null {
  for (const node of nodes) {
    if (isDocsNavGroup(node)) {
      const result = findNodeTrail(node.items, href, [...trail, node.title])
      if (result) return result
    } else if (node.href === href) {
      return trail
    }
  }
  return null
}

export function getDocsBreadcrumbs(href: string) {
  for (const section of docsNavigation) {
    const trail = findNodeTrail(section.items, href)
    if (trail) return [section.title, ...trail]
  }
  return ["Documentation"]
}

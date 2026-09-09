# Architecture Diagram

```
[ Users ]
  Students & Teachers (web/mobile)
        ↓
[ Next.js App Router UI ]
  React 19 • TypeScript • Tailwind • shadcn/ui
        ↓
[ Supabase Auth & Middleware ]
  Email login • Session refresh • Role redirect
        ↓
[ App APIs / Services (Next.js app/api) ]
  Chat → Vercel AI SDK + OpenAI GPT-4o/mini
  Study Tools → Quiz • Flashcards • Summary
  Uploads → Supabase Storage "knowledge"
        ↓
[ Supabase Data Platform ]
  Postgres tables:
    profiles • courses • materials • enrollments
    flashcards • quizzes • reminders
    chatbot_settings • conversations • messages
  Storage bucket: PDFs / docs / media
        ↓
[ Portals ]
  Student Portal → study tools, reminders, analytics
  Teacher Portal → course mgmt, AI config, insights
        ↘
[ Future RAG / Gemini ]
  Index storage files → augment chat answers
```


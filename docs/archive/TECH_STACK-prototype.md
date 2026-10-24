# AI Teaching Assistant - Tech Stack

## 🚀 **Current Technology Stack**

### **Frontend Framework**
- **Next.js 16.4.2** - React framework with App Router (Turbopack builds, `proxy.ts` request boundary)
- **React 19.3.1** - UI library
- **TypeScript 6.0** - Type-safe JavaScript (TS 7 deferred until typescript-eslint supports it)
- **Node.js 22+** - Runtime requirement (AI SDK 7 is ESM-only)

### **Styling & UI Components**
- **Tailwind CSS 4.3.3** - Utility-first CSS framework
- **Radix UI** - Headless UI components
  - Accordion, Alert Dialog, Avatar, Checkbox, Dialog, Dropdown Menu, etc.
- **Shadcn/ui** - Pre-built UI components based on Radix
- **Next Themes 0.4.6** - Dark mode support
- **Lucide React 1.59** - Icon library
- **Recharts 3.10.1** - Charts and data visualization
- **Framer Motion 14.3** - Animation

### **State Management & Forms**
- **React Hook Form 7.90.0** - Form handling
- **Zod 4.6.7** - Schema validation
- **@hookform/resolvers 5.9.2** - Form validation integration

### **Backend & Database**
- **Supabase** - Backend as a Service
  - **@supabase/supabase-js 2.118.0** - Supabase client
  - **@supabase/ssr 0.12.7** - Server-side rendering support
  - **PostgreSQL** - Database (via Supabase)
  - **Row Level Security (RLS)** - Data security
- **DigitalOcean Spaces** - Document storage
  - **@aws-sdk/client-s3 3.1152** + s3-request-presigner - S3-compatible client

### **AI & Chat Features** ⭐
- **Vercel AI SDK 7.0.143 (`ai`)** - AI framework
- **@ai-sdk/google 4.0.99** - Google Gemini provider integration
- **@ai-sdk/react 4.0.147** - React hooks for AI (`useChat` + `DefaultChatTransport`)
- **Gemini 3.8 Flash** - AI model for chat responses
- **@google/genai 2.30** - Direct Gemini client (file search, embeddings, audio transcription)

### **Authentication**
- **Supabase Auth** - User authentication
  - Email/password authentication
  - Session management
  - Role-based access control (Student/Teacher)

### **Development Tools**
- **ESLint 10** - Code linting (flat config in `eslint.config.mjs`)
- **Turbopack** - Default bundler for `next dev` and `next build`
- **PostCSS 8.5** - CSS processing
- **Autoprefixer 10.6** - CSS vendor prefixing

### **Additional Libraries**
- **cmdk 1.1** - Command menu
- **sonner 2.0** - Toast notifications
- **embla-carousel-react 8.6** - Carousel component
- **class-variance-authority** - CSS variant handling
- **clsx & tailwind-merge 3** - Conditional CSS classes
- **pdf-parse 2.4** - PDF text extraction
- **web-push 3.6** - Browser push notifications

---

## 📊 **Architecture Overview**

### **Database Schema**
```sql
- profiles (user profiles with roles)
- conversations (chat conversations)
- messages (chat messages)
```

### **Authentication Flow**
1. User signs up/logs in via Supabase Auth
2. Automatic profile creation via database trigger
3. Session management with cookies
4. Role-based access (Student/Teacher dashboards)

### **AI Chat Flow**
1. User sends message → Creates conversation (if new)
2. Message saved to Supabase database
3. Request sent to Gemini via Vercel AI SDK
4. Streaming response back to user
5. Assistant response saved to database

---

## 🔑 **Environment Variables Required**

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Gemini
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key

# DigitalOcean Spaces (Documents)
DO_SPACES_REGION=your_spaces_region
DO_SPACES_BUCKET=your_documents_bucket_name
DO_SPACES_KEY=your_spaces_access_key
DO_SPACES_SECRET=your_spaces_secret_key
DO_SPACES_PUBLIC=false
# Optional
# DO_SPACES_CDN_URL=https://your-cdn-domain
```

---

## 🌟 **Key Features**

### **For Students:**
- AI-powered teaching assistant
- Course enrollment and materials access
- Quiz and flashcard generation
- Study reminders
- Interactive chat interface

### **For Teachers:**
- Course management
- Material uploads
- Student analytics
- AI chatbot configuration
- Course insights dashboard

---

## 🛠️ **Development Commands**

```bash
# Install dependencies (Node.js 22+)
npm ci

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

---

## 📦 **Project Structure**

```
ai-teaching-assistant/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── chat/         # AI chat endpoint
│   │   ├── conversations/
│   │   ├── generate-flashcards/
│   │   ├── generate-quiz/
│   │   └── summarize/
│   ├── auth/             # Authentication pages
│   ├── chat/             # Chat interface
│   └── dashboard/        # Student/Teacher dashboards
├── components/            # React components
│   ├── chat/             # Chat components
│   ├── student/          # Student components
│   ├── teacher/          # Teacher components
│   └── ui/               # Reusable UI components
├── lib/                  # Utilities & configs
│   ├── supabase/         # Supabase client/server
│   └── types.ts          # TypeScript types
├── scripts/              # Database migration scripts
└── public/               # Static assets
```

---

## 🔄 **Recent Updates**

### ✅ **Tech Stack Upgrade — October 19, 2026**
- Next.js 15.5.12 → **16.4.2** (Turbopack by default; `middleware.ts` → `proxy.ts`)
- AI SDK 5 → **7** (`generateObject` → `generateText` + `Output.object`, async `convertToModelMessages`, stateless UI stream helpers)
- React 19.2 → **19.3.1**; TypeScript 5.9 → **6.0** (TS 7 builds but breaks `typescript-eslint`); ESLint 9 → **10** (flat config)
- Zod 3 → **4**; `@hookform/resolvers` 3 → **5**
- Tailwind CSS 4.1 → **4.3.3**; lucide-react 0.454 → **1.59**; Recharts 2 → **3**
- Supabase SSR 0.7 → **0.12.7**; `@google/genai` 1 → **2**; framer-motion 12 → **14**
- Removed unused deps: `animate-ui`, `tokenlens`, `streamdown`, `nanoid`, `slick-carousel`, `date-fns`, `tailwindcss-animate`, `motion`
- Removed `legacy-peer-deps` (`.npmrc` deleted); Vercel installs with `npm ci`
- `npm audit`: 3 critical / 10 high → **0 critical**, 5 high (dev-only ESLint transitive deps)
- Verified after every step with `tsc --noEmit`, `eslint .`, `next build` and a production-server smoke test

### ✅ **Earlier Work**
- Migrated from Vercel AI Gateway to the direct Gemini provider
- Streaming AI responses with database persistence for chat history
- Supabase auth, profiles/conversations/messages tables, RLS and triggers
- Role-based route protection (now enforced in `proxy.ts`)

---

## 📝 **Next Steps / Recommended Enhancements**

1. **Add More AI Features**
   - Document summarization
   - Quiz generation from materials
   - Flashcard creation
   - Assignment grading assistance

2. **Enhanced Analytics**
   - Student progress tracking
   - Course completion rates
   - Engagement metrics

3. **Real-time Features**
   - Live notifications
   - Real-time chat updates
   - Collaborative features

4. **File Management**
   - PDF viewer integration
   - Document upload/download
   - Material organization

---

## 🔐 **Security Features**

- Row Level Security (RLS) on all tables
- Server-side authentication validation
- Protected API routes
- Environment variable management
- Secure session handling

---

## 🌐 **Deployment**

**Recommended Platform:** Vercel

```bash
# Deploy to Vercel
vercel --prod

# Or connect your GitHub repository to Vercel for automatic deployments
```

**Environment Variables to Set:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`
- `DO_SPACES_REGION`
- `DO_SPACES_BUCKET`
- `DO_SPACES_KEY`
- `DO_SPACES_SECRET`
- `DO_SPACES_PUBLIC`
- `DO_SPACES_CDN_URL` (optional)

---

**Last Updated:** October 19, 2026
**Version:** 0.1.0

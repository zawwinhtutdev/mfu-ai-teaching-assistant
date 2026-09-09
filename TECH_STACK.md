# AI Teaching Assistant - Tech Stack

## 🚀 **Current Technology Stack**

### **Frontend Framework**
- **Next.js 15.5.6** - React framework with App Router
- **React 19.2.0** - UI library
- **TypeScript 5** - Type-safe JavaScript

### **Styling & UI Components**
- **Tailwind CSS 4.1.9** - Utility-first CSS framework
- **Radix UI** - Headless UI components
  - Accordion, Alert Dialog, Avatar, Checkbox, Dialog, Dropdown Menu, etc.
- **Shadcn/ui** - Pre-built UI components based on Radix
- **Next Themes** - Dark mode support
- **Lucide React** - Icon library
- **Recharts 2.15.4** - Charts and data visualization

### **State Management & Forms**
- **React Hook Form 7.60.0** - Form handling
- **Zod 3.25.76** - Schema validation
- **@hookform/resolvers** - Form validation integration

### **Backend & Database**
- **Supabase** - Backend as a Service
  - **@supabase/supabase-js** - Supabase client
  - **@supabase/ssr** - Server-side rendering support
  - **PostgreSQL** - Database (via Supabase)
  - **Row Level Security (RLS)** - Data security

### **AI & Chat Features** ⭐
- **Vercel AI SDK (ai)** - AI framework
- **@ai-sdk/google** - Google Gemini provider integration
- **@ai-sdk/react** - React hooks for AI
- **Gemini 2.5 Flash** - AI model for chat responses

### **Authentication**
- **Supabase Auth** - User authentication
  - Email/password authentication
  - Session management
  - Role-based access control (Student/Teacher)

### **Development Tools**
- **ESLint** - Code linting
- **PostCSS** - CSS processing
- **Autoprefixer** - CSS vendor prefixing

### **Additional Libraries**
- **date-fns 4.1.0** - Date manipulation
- **cmdk** - Command menu
- **sonner** - Toast notifications
- **embla-carousel-react** - Carousel component
- **class-variance-authority** - CSS variant handling
- **clsx & tailwind-merge** - Conditional CSS classes

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
# Install dependencies
npm install --legacy-peer-deps

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

### ✅ **Vercel AI SDK Integration** (Latest)
- Migrated from Vercel AI Gateway to direct Gemini provider
- Added `@ai-sdk/google` package
- Configured Gemini 2.5 Flash model
- Streaming AI responses
- Database persistence for chat history

### ✅ **Database Setup**
- Created profiles, conversations, and messages tables
- Implemented Row Level Security (RLS)
- Automatic profile creation trigger
- Foreign key constraints and indexes

### ✅ **Authentication**
- Supabase authentication integration
- Role-based access control
- Protected routes with middleware
- Session management

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

**Last Updated:** October 23, 2025
**Version:** 0.1.0

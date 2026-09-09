# 🎓 AI Teaching Assistant

An intelligent teaching assistant platform built with Next.js, Supabase, and Gemini, designed to enhance learning experiences for students and streamline course management for teachers.

![Next.js](https://img.shields.io/badge/Next.js-15.5.6-black)
![React](https://img.shields.io/badge/React-19.2.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Supabase](https://img.shields.io/badge/Supabase-Latest-green)
![Gemini](https://img.shields.io/badge/Gemini-2.5--flash-orange)

---

## ✨ Features

### 👨‍🎓 For Students
- 🤖 **AI-Powered Chat Assistant** - Get instant answers to your questions
- 📚 **Course Materials** - Access study materials and resources
- 📝 **Interactive Quizzes** - Test your knowledge
- 🎴 **Flashcards** - AI-generated flashcards for better retention
- ⏰ **Study Reminders** - Never miss important deadlines
- 🌓 **Dark Mode** - Comfortable studying day or night

### 👨‍🏫 For Teachers
- 📊 **Course Management** - Create and manage courses easily
- 📤 **Material Upload** - Share resources with students
- 📈 **Analytics Dashboard** - Track student engagement
- ⚙️ **AI Configuration** - Customize chatbot behavior
- 👥 **Student Insights** - Monitor learning progress

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 18+**
- **npm** or **pnpm**
- **Supabase Account** ([Sign up free](https://supabase.com))
- **Gemini API Key** ([Get one here](https://aistudio.google.com/app/apikey))

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd ai-teaching-assistant
   ```

2. **Install dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Set up environment variables**
   
   Create a `.env.local` file in the root directory:
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

   # Gemini Configuration
   GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key

   # DigitalOcean Spaces (Documents feature)
   DO_SPACES_REGION=your_spaces_region
   DO_SPACES_BUCKET=your_documents_bucket_name
   DO_SPACES_KEY=your_spaces_access_key
   DO_SPACES_SECRET=your_spaces_secret_key
   DO_SPACES_PUBLIC=false
   # Optional CDN base URL (without trailing slash)
   # DO_SPACES_CDN_URL=https://your-cdn-domain
   ```

4. **Set up Supabase Database**

   Preferred (migration-first):
   ```bash
   npm run db:bootstrap
   ```

   Use linked cloud project instead of local:
   ```bash
   npm run db:bootstrap -- linked
   ```

   Legacy/manual SQL setup (only if you are not using Supabase CLI):

   Go to your Supabase project → SQL Editor, and run these scripts in order:

   **a) Create profiles table:**
   ```sql
   CREATE TABLE IF NOT EXISTS profiles (
     id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
     email TEXT UNIQUE NOT NULL,
     full_name TEXT,
     role TEXT NOT NULL CHECK (role IN ('student', 'teacher')) DEFAULT 'student',
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );

   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
   CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
   CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
   ```

   **b) Create auto-profile trigger:**
   ```sql
   CREATE OR REPLACE FUNCTION public.handle_new_user()
   RETURNS TRIGGER AS $$
   BEGIN
     INSERT INTO public.profiles (id, email, full_name, role)
     VALUES (
       NEW.id,
       NEW.email,
       COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
       COALESCE(NEW.raw_user_meta_data->>'role', 'student')
     );
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;

   DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
   CREATE TRIGGER on_auth_user_created
     AFTER INSERT ON auth.users
     FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
   ```

   **c) Create conversations and messages tables:**
   ```sql
   CREATE TABLE IF NOT EXISTS conversations (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
     title TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );

   CREATE TABLE IF NOT EXISTS messages (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
     role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
     content TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );

   CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
   CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
   CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
   CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

   ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
   ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Users can view their own conversations"
     ON conversations FOR SELECT USING (auth.uid() = user_id);
   CREATE POLICY "Users can create their own conversations"
     ON conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
   CREATE POLICY "Users can update their own conversations"
     ON conversations FOR UPDATE USING (auth.uid() = user_id);
   CREATE POLICY "Users can delete their own conversations"
     ON conversations FOR DELETE USING (auth.uid() = user_id);

   CREATE POLICY "Users can view messages in their conversations"
     ON messages FOR SELECT
     USING (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid()));
   CREATE POLICY "Users can create messages in their conversations"
     ON messages FOR INSERT
     WITH CHECK (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid()));
   ```

   **d) Create user documents metadata table (for DigitalOcean Spaces):**
   ```sql
   -- Run scripts/005_create_user_documents.sql
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000) (or the port shown in terminal)

---

## 🛠️ Development

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

### Project Structure

```
ai-teaching-assistant/
├── app/                    # Next.js App Router
│   ├── api/               # API routes (chat, quiz, etc.)
│   ├── auth/              # Authentication pages
│   ├── chat/              # Chat interface
│   └── dashboard/         # Student/Teacher dashboards
├── components/            # React components
│   ├── chat/             # Chat UI components
│   ├── student/          # Student features
│   ├── teacher/          # Teacher features
│   └── ui/               # Reusable UI components
├── lib/                  # Utilities & configurations
│   ├── supabase/         # Supabase client setup
│   └── types.ts          # TypeScript types
├── scripts/              # Database migration scripts
└── public/               # Static assets
```

---

## 🔐 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | ✅ Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key | ✅ Yes |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API key for AI features | ✅ Yes |
| `DO_SPACES_REGION` | DigitalOcean Spaces region (e.g. `sgp1`) | ✅ Yes (Documents) |
| `DO_SPACES_BUCKET` | Spaces bucket name for user documents | ✅ Yes (Documents) |
| `DO_SPACES_KEY` | Spaces access key | ✅ Yes (Documents) |
| `DO_SPACES_SECRET` | Spaces secret key | ✅ Yes (Documents) |
| `DO_SPACES_PUBLIC` | `true` for public bucket, `false` for signed URLs | ✅ Yes (Documents) |
| `DO_SPACES_CDN_URL` | Optional CDN base URL for public links | ❌ Optional |

---

## 📚 Tech Stack

- **Framework:** Next.js 15.5.6 with App Router
- **Frontend:** React 19.2.0, TypeScript
- **Styling:** Tailwind CSS 4.1.9, Radix UI
- **Backend:** Supabase (PostgreSQL + Auth)
- **AI:** Vercel AI SDK + Gemini 2.5 Flash
- **State Management:** React Hook Form + Zod
- **UI Components:** Shadcn/ui

For detailed tech stack information, see [TECH_STACK.md](./TECH_STACK.md)

---

## 🚢 Deployment

### Deploy to Vercel (Recommended)

1. **Push your code to GitHub**

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import your repository
   - Add environment variables in Vercel dashboard

3. **Deploy**
   ```bash
   vercel --prod
   ```

### Environment Variables in Production

Make sure to set these in your Vercel dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License.

---

## 🆘 Support

If you encounter any issues:

1. Check the [TECH_STACK.md](./TECH_STACK.md) documentation
2. Review the Supabase setup steps
3. Ensure all environment variables are set correctly
4. Check that your Gemini API key is valid

---

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Backend by [Supabase](https://supabase.com)
- AI powered by [Google Gemini](https://ai.google.dev/)
- UI components from [Shadcn/ui](https://ui.shadcn.com)
- Icons by [Lucide](https://lucide.dev)

---

**Made with ❤️ for Mae Fah Luang University (MFU)**

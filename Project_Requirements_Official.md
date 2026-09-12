<<Requirements>>
AI Teaching Assistant – System Specification
Overview
Problem:
• University lecturers face heavy workloads (teaching, grading, administration, research).
• Students often lack timely support and personalized guidance outside of class hours.
• FAQs, lecture summaries, and assignment reminders consume valuable time for both sides.
 
Solution:
An AI Teaching Assistant that integrates with course platforms to:
• Provide 24/7 FAQ support for students.
• Generate automated lecture summaries and learning resources.
• Send personalized reminders for assignments, exams, and deadlines.
• Support role-based interaction: Teacher Mode (content management, insights) vs. Student Mode (learning support, Q&A).
•  
Technology Stack:
• LLM API (OpenAI, Anthropic, or similar)
• Prompt Engineering & Fine-tuning (course-specific adaptation)
• RBAC (Role-Based Access Control) for lecturer/student/admin separation
• PWA Web App / LMS Integration (Moodle/Canvas/University LMS)
• Database + API Gateway for content, logs, and access control
 
2. Key Features
2.1 Student-Facing Features
• Course FAQ Chatbot
o Trained on syllabus, lecture notes, and assignment details.
o Natural language Q&A: grading policies, exam formats, due dates, etc.
• Lecture Summarization
o Upload lecture slides/audio transcripts → AI generates concise summaries, key points, and flashcards.
o Multi-format outputs: text, bullet-points, quizzes.
• Reminders & Notifications
o Automated reminders for assignment deadlines, exams, or upcoming classes.
o Integration with email, Line OA, or mobile push notifications.
• Study Guidance
o Personalized practice questions.
o AI-driven explanations of difficult concepts.
 
2.2 Teacher-Facing Features
• Content Dashboard
o Upload/manage FAQs, course documents, lecture slides.
o Edit or approve AI-generated summaries before release.
• Insights & Analytics
o Monitor FAQ query trends (e.g., common misunderstandings).
o Student engagement metrics (who asks what, frequency, timing).
• Customization
o Adjust chatbot “tone” (formal, supportive, concise).
o Set course-specific rules (grading, policies).
 
2.3 Admin/IT Features
• RBAC: Lecturer vs Student vs Admin permissions.
• SSO Integration: University login (OIDC/SAML).
• Data Privacy/PDPA/GDPR compliance:
o Only store anonymized logs unless explicit consent is given.
o Allow opt-out for personal data usage.
• Audit Logs: Track who accessed what data, when.
 
3. Architecture
3.1 Components
• Frontend (PWA Web App): Responsive, role-based UI for students/teachers.
• Backend (API Gateway): REST/GraphQL APIs for chatbot, reminders, content management.
• Database: PostgreSQL/MySQL for course data, logs, user roles.
• AI Layer:
o LLM API (ChatGPT/GPT-4/Claude)
o Prompt engineering per course context
o Vector database (Milvus/Weaviate/Pinecone) for FAQ embedding search
• Integration: Connect with LMS, SSO, calendar services.
3.2 Data Flow
1. User query → Chatbot UI → API Gateway
2. API calls Vector DB search (for FAQ context) + LLM API
3. LLM generates response → returned to user
4. Logs stored in DB (anonymized if needed)
5. For reminders: Scheduler checks DB deadlines → sends notifications
 
4. Data Model (Draft)
users
• id, university_id, role (student/teacher/admin), name, email
 
courses
• id, name, semester, teacher_id
 
faqs
• id, course_id, question, answer, embedding_vector
 
lectures
• id, course_id, title, file_url, summary_text
 
assignments
• id, course_id, title, due_date, instructions
 
reminders
• id, user_id, assignment_id, send_time, status
 
chat_logs
• id, user_id, course_id, query, response, timestamp
 
5. AI/LLM Layer
• FAQ Search:
o Vector DB + semantic search retrieves top FAQs.
o Prompt template ensures accurate, concise answers.
• Lecture Summarization:
o Transcript/slides → AI summary, quizzes, flashcards.
• Reminders:
o Rule-based + AI personalization (e.g., suggest study blocks before exams).
• Prompt Example (Student FAQ):
You are an AI Teaching Assistant for the course {course_name}.
Answer student questions based only on the provided course syllabus, lecture notes, and FAQ database.
If you don’t know, say “Please ask your lecturer for clarification.”
 
6. Privacy & Security
• Consent & Transparency: Students informed that queries may be logged for improvement.
• Data Minimization: Store only course-related queries, no sensitive personal data.
• Access Control: RBAC for student/teacher/admin.
• Encryption: TLS in transit, AES-256 at rest.
 
7. Engagement & Benefits
• For Students: Quick support, reduced anxiety, personalized study help.
• For Teachers: Reduced repetitive workload, insights into student pain points.
• For University: Enhanced digital learning ecosystem, scalable assistant for all courses.
 
8. Roadmap (16 Weeks)
Week
Task
1–2
Requirements, architecture design, DB schema
3–4
Build PWA skeleton, SSO integration
5–6
FAQ ingestion + Vector DB setup
7–8
LLM API integration, chatbot MVP
9–10
Lecture summarization module
11–12
Reminder & notification system
13–14
Teacher dashboard + analytics
15
Pilot test (1–2 courses)
16
Evaluation, reporting, final adjustments
 
9. Evaluation Metrics
• Accuracy: % of correct answers from chatbot (target ≥ 85%)
• Student Engagement: MAU, Avg. questions per student/week
• Teacher Satisfaction: Survey ≥ 80% positive feedback
• Usability (SUS Score): ≥ 75
 
10. Definition of Done (MVP)
1. Role-based login (Student/Teacher).
2. FAQ Chatbot for at least 1 course.
3. Lecture summarization for uploaded slides.
4. Reminder system for assignments.
5. Admin/Teacher dashboard with basic analytics.
6. Privacy compliance (consent page, data retention policy).
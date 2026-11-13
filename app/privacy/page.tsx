import Link from "next/link"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

/**
 * Privacy notice (spec §2.3 / §6 / DoD #6).
 *
 * The terms page existed but there was no privacy page to link to from the
 * signup consent checkbox. The retention window here is read from the same
 * environment variable the cleanup job uses, so the published policy cannot
 * drift away from what the code actually does.
 */

const DEFAULT_RETENTION_DAYS = 30

function retentionDays() {
  const configured = Number(process.env.DATA_RETENTION_DAYS || DEFAULT_RETENTION_DAYS)
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_RETENTION_DAYS
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-lg font-semibold">{title}</h3>
      <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">{children}</div>
    </div>
  )
}

export default function PrivacyPage() {
  const days = retentionDays()

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-6 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <div className="w-full max-w-4xl">
        <div className="mb-6">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Login
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Privacy Notice</CardTitle>
            <CardDescription>
              MFU AI Teaching Assistant — how your course questions are handled.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Section title="1. What we collect">
              <p>
                Your university account details (name, email, role) and the questions you ask the
                assistant. For students, we also store which course each question relates to.
              </p>
              <p>
                We do not collect passwords, payment details, health information, or any special
                category of personal data.
              </p>
            </Section>

            <Section title="2. Why we process it">
              <p>
                Questions are processed by an AI model to generate an answer grounded in your
                course materials. Retrieval runs against material your lecturer uploaded for the
                course you are enrolled in.
              </p>
              <p>
                With your consent, questions are also logged so lecturers can see which topics
                students find unclear and improve the material. This is the analytics you can turn
                off.
              </p>
            </Section>

            <Section title="3. Where processing happens">
              <p>
                By default the assistant runs on local models (Ollama) on the university&apos;s own
                infrastructure, so questions do not leave the university network. If a cloud model
                is configured, the question and the retrieved course excerpts are sent to that
                provider solely to produce the answer.
              </p>
            </Section>

            <Section title="4. Your choices">
              <p>You control two things from Settings, and both take effect immediately:</p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  <strong>AI processing consent</strong> — turning this off stops your questions
                  being logged for analytics. You can still use the assistant.
                </li>
                <li>
                  <strong>Retention opt-out</strong> — asks for faster deletion of your stored
                  question history.
                </li>
              </ul>
            </Section>

            <Section title="5. How long we keep it">
              <p>
                Logged questions and audit records are kept for <strong>{days} days</strong> by
                default, after which they are deleted. If you opt out of retention, your records
                are included in the next cleanup run rather than waiting for the full period.
              </p>
              <p>
                Course material you uploaded as a lecturer is retained for as long as the course
                exists, because the assistant needs it to answer questions.
              </p>
            </Section>

            <Section title="6. Access control">
              <p>
                Your role is derived from your university email address and stored server-side; it
                cannot be set from the browser. Students can only retrieve material from courses
                they are enrolled in, and every course-scoped request is re-checked on the server.
                Teachers can read only the courses they own. Administrators can read all courses,
                and each administrative action is written to an audit log.
              </p>
            </Section>

            <Section title="7. Your rights">
              <p>
                You may request a copy of your data, ask for it to be deleted, or withdraw consent
                at any time. Contact your course lecturer in the first instance, or the university
                data protection office for formal requests.
              </p>
            </Section>

            <div className="flex gap-3 pt-2">
              <Button asChild>
                <Link href="/studentportal/settings">Manage my consent</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/terms">Terms of service</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

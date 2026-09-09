"use client"

import type React from "react"
import { useState } from "react"
import { EducveStyleLinks } from "@/components/educve/EducveStyleLinks"
import { InnerPageLayout } from "@/components/educve/InnerPageLayout"

const feedbackTypes = [
  { value: "bug", label: "Bug Report" },
  { value: "feature", label: "Feature Request" },
  { value: "improvement", label: "Improvement Suggestion" },
  { value: "general", label: "General Feedback" },
]

const noticeStyle: React.CSSProperties = {
  borderRadius: 10,
  padding: "14px 18px",
  fontSize: 16,
  fontWeight: 500,
  marginBottom: 20,
}

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    type: "",
    subject: "",
    message: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    await new Promise((resolve) => setTimeout(resolve, 2000))

    setIsSubmitting(false)
    setIsSubmitted(true)

    setTimeout(() => {
      setIsSubmitted(false)
      setFormData({
        name: "",
        email: "",
        type: "",
        subject: "",
        message: "",
      })
    }, 3000)
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  return (
    <>
      <EducveStyleLinks />
      <InnerPageLayout breadcrumbTitle="Contact" breadcrumbSubtitle="Contact">
        <section>
          <div className="td_height_120 td_height_lg_80" />
          <div className="container">
            <div className="row">
              <div className="col-xxl-10 offset-xxl-1">
                <div className="mfu_contact_support">
                  <div className="td_section_heading td_style_2 mfu_contact_support_heading td_mb_40">
                    <h2 className="td_contact_info_title td_fs_36 mb-0">
                      MFU AI Teaching Assistant
                    </h2>
                  </div>

                  <div className="row td_gap_y_30">
                    <div className="col-lg-6">
                      <article className="mfu_contact_support_panel mfu_contact_support_panel_student">
                        <h2 className="td_fs_24 td_semibold td_mb_20">Student Support</h2>
                        <p className="td_fs_18 td_heading_color td_medium td_mb_10">
                          Ask course questions, review lecture summaries,
                          generate quizzes and flashcards, and stay on track
                          with reminders.
                        </p>
                        <p className="td_fs_18 td_heading_color td_medium td_mb_10 td_opacity_7">
                          Public access routes: home, sign in, sign up, and contact.
                        </p>
                        <p className="td_fs_18 td_heading_color td_medium mb-0 td_opacity_7">
                          Use your MFU email to access student features.
                        </p>
                      </article>
                    </div>

                    <div className="col-lg-6">
                      <article className="mfu_contact_support_panel mfu_contact_support_panel_teacher">
                        <h2 className="td_fs_24 td_semibold td_mb_20">Teacher Support</h2>
                        <p className="td_fs_18 td_heading_color td_medium td_mb_10">
                          Upload course materials, manage FAQs, review AI-generated
                          outputs, and track analytics for each course.
                        </p>
                        <p className="td_fs_18 td_heading_color td_medium td_mb_10 td_opacity_7">
                          The platform is designed to reduce repetitive lecturer
                          workload and improve student support outside class hours.
                        </p>
                        <p className="td_fs_18 td_heading_color td_medium mb-0 td_opacity_7">
                          Send onboarding or product questions through the form below.
                        </p>
                      </article>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="td_height_120 td_height_lg_80" />

          <div className="container">
            <div className="row justify-content-center">
              <div className="col-xl-8 col-lg-10">
                <div className="td_form_card td_style_1 td_radius_10 td_gray_bg_5">
                  <div className="td_form_card_in">
                    <h2 className="td_fs_36 td_mb_20">SEND A MESSAGE</h2>
                    <hr />
                    <div className="td_height_30 td_height_lg_30" />

                    {isSubmitted ? (
                      <div
                        style={{
                          ...noticeStyle,
                          backgroundColor: "rgba(22, 163, 74, 0.12)",
                          color: "#166534",
                        }}
                      >
                        Thank you. Your feedback has been received.
                      </div>
                    ) : null}

                    <form onSubmit={handleSubmit}>
                      <div className="row td_gap_y_20">
                        <div className="col-md-6">
                          <input
                            type="text"
                            className="td_form_field td_medium td_white_bg"
                            placeholder="Name *"
                            required
                            value={formData.name}
                            onChange={(e) => handleInputChange("name", e.target.value)}
                          />
                        </div>
                        <div className="col-md-6">
                          <input
                            type="email"
                            className="td_form_field td_medium td_white_bg"
                            placeholder="MFU Email *"
                            required
                            value={formData.email}
                            onChange={(e) => handleInputChange("email", e.target.value)}
                          />
                        </div>
                        <div className="col-md-6">
                          <select
                            className="td_form_field td_medium td_white_bg"
                            required
                            value={formData.type}
                            onChange={(e) => handleInputChange("type", e.target.value)}
                          >
                            <option value="">Feedback Type *</option>
                            {feedbackTypes.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-6">
                          <input
                            type="text"
                            className="td_form_field td_medium td_white_bg"
                            placeholder="Subject *"
                            required
                            value={formData.subject}
                            onChange={(e) => handleInputChange("subject", e.target.value)}
                          />
                        </div>
                        <div className="col-12">
                          <textarea
                            className="td_form_field td_medium td_white_bg"
                            placeholder="Message *"
                            required
                            rows={6}
                            value={formData.message}
                            onChange={(e) => handleInputChange("message", e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="td_height_30 td_height_lg_30" />

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="td_btn td_style_1 td_radius_10 td_medium"
                      >
                        <span className="td_btn_in td_white_color td_accent_bg">
                          <span>{isSubmitting ? "Sending..." : "Send Message"}</span>
                        </span>
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="td_height_120 td_height_lg_80" />
        </section>
      </InnerPageLayout>
    </>
  )
}

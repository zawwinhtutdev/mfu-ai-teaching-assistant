import React from "react";
import { DocumentationLink } from "@/components/educve/DocumentationLink";

const heroBg = "/home_1/hero_bg_1.jpg";

export const HeroOne = () => (
  <section
    className="td_hero td_style_1 td_heading_bg td_center td_bg_filed"
    style={{ backgroundImage: `url(${heroBg})` }}
  >
    <div className="container">
      <div
        className="td_hero_text wow fadeInRight"
        data-wow-duration="0.9s"
        data-wow-delay="0.35s"
      >
        <p className="td_hero_subtitle_up td_fs_18 td_white_color td_spacing_1 td_semibold text-uppercase td_mb_10 td_opacity_9">
          AI Teaching Assistant
        </p>
        <h1 className="td_hero_title td_fs_64 td_white_color td_mb_12">
          <span>MFU AI</span> for 24/7 course support, summaries, and study guidance
        </h1>
        <p className="td_hero_subtitle td_fs_18 td_white_color td_opacity_7 td_mb_30">
          Help students get instant answers, lecture summaries, quizzes,
          flashcards, and reminders while teachers manage course content and
          insights in one platform.
        </p>
        <DocumentationLink className="td_btn td_style_1 td_radius_10 td_medium">
          <span className="td_btn_in td_white_color td_accent_bg">
            <span>Read Documentation</span>
            <svg
              width="19"
              height="20"
              viewBox="0 0 19 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M15.1575 4.34302L3.84375 15.6567"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M15.157 11.4142C15.157 11.4142 16.0887 5.2748 15.157 4.34311C14.2253 3.41142 8.08594 4.34314 8.08594 4.34314"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </DocumentationLink>
      </div>
    </div>
    <div className="td_lines" aria-hidden="true">
      <span></span>
      <span></span>
      <span></span>
      <span></span>
    </div>
  </section>
);

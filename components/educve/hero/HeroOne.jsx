import React from "react";

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

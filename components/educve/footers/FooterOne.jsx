"use client";

import React, { useMemo } from "react";
import { BrandMark } from "@/components/educve/BrandMark";
import { DocumentationLink } from "@/components/educve/DocumentationLink";
import { useEducveAuthState } from "@/lib/educve/hooks/useEducveAuthState";
import { primaryNavigation } from "@/lib/educve/siteNavigation";

export const FooterOne = ({ initialAuthState }) => {
  const { isAuthenticated, portalHref } = useEducveAuthState(initialAuthState);

  const navigationItems = useMemo(() => {
    if (!isAuthenticated) {
      return primaryNavigation;
    }

    return [
      ...primaryNavigation.slice(0, 3),
      { href: portalHref, label: "Portal" },
    ];
  }, [isAuthenticated, portalHref]);

  return (
    <footer className="td_footer td_style_1">
      <div className="container">
        <div className="td_footer_row">
          <div className="td_footer_col">
            <div className="td_footer_widget">
              <div className="td_footer_text_widget td_fs_18">
                <BrandMark tone="light" />
                <p>
                  24/7 AI support for students and simple course tools for
                  teachers.
                </p>
              </div>
              <ul className="td_footer_address_widget td_medium td_mp_0">
                <li>
                  <i className="fa-solid fa-envelope"></i>
                  <a href="/contact">Contact the MFU AI team</a>
                </li>
                <li>
                  <i
                    className={`fa-solid ${
                      isAuthenticated ? "fa-table-columns" : "fa-user-plus"
                    }`}
                  ></i>
                  <a href={isAuthenticated ? portalHref : "/signup"}>
                    {isAuthenticated
                      ? "Open your portal"
                      : "Create an account"}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="td_footer_col">
            <div className="td_footer_widget">
              <h2 className="td_footer_widget_title td_fs_32 td_white_color td_medium td_mb_30">
                Navigate
              </h2>
              <ul className="td_footer_widget_menu">
                {navigationItems.map((item) => (
                  <li key={item.href}>
                    {item.href === "/docs" ? (
                      <DocumentationLink>{item.label}</DocumentationLink>
                    ) : (
                      <a href={item.href}>{item.label}</a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="td_footer_col">
            <div className="td_footer_widget">
              <h2 className="td_footer_widget_title td_fs_32 td_white_color td_medium td_mb_30">
                Platform
              </h2>
              <ul className="td_footer_address_widget td_medium td_mp_0">
                <li>
                  <i className="fa-solid fa-robot"></i>
                  Course-aware FAQ support
                </li>
                <li>
                  <i className="fa-solid fa-file-lines"></i>
                  AI summaries, quizzes, and flashcards
                </li>
                <li>
                  <i className="fa-solid fa-chart-line"></i>
                  Reminders, dashboards, and insights
                </li>
              </ul>
            </div>
          </div>

          <div className="td_footer_col">
            <div className="td_footer_widget">
              <h2 className="td_footer_widget_title td_fs_32 td_white_color td_medium td_mb_30">
                Stay Updated
              </h2>
              <div className="td_newsletter td_style_1">
                <p className="td_mb_20 td_opacity_7">
                  Get MFU AI product updates.
                </p>
                <form action="#" className="td_newsletter_form">
                  <input
                    type="email"
                    className="td_newsletter_input"
                    placeholder="University email address"
                  />
                  <button
                    type="submit"
                    className="td_btn td_style_1 td_radius_30 td_medium"
                  >
                    <span className="td_btn_in td_white_color td_accent_bg">
                      <span>Get Updates</span>
                    </span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="td_footer_bottom td_fs_18">
        <div className="container">
          <div className="td_footer_bottom_in">
            <p className="td_copyright mb-0">
              Copyright © MFU AI Teaching Assistant | All Rights Reserved
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

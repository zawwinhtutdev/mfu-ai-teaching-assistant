"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/educve/BrandMark";
import { DocumentationLink } from "@/components/educve/DocumentationLink";
import { HeaderSidebar } from "@/components/educve/headers/HeaderSidebar";
import { useEducveAuthState } from "@/lib/educve/hooks/useEducveAuthState";
import { useStickyHeader } from "@/lib/educve/hooks/useStickyHeader";
import { primaryNavigation } from "@/lib/educve/siteNavigation";

const mainNavigation = primaryNavigation.slice(0, 2);

export const HeaderOne = ({ initialAuthState }) => {
  useStickyHeader();

  const router = useRouter();
  const [showSidebar, setShowSidebar] = useState(false);
  const [isSigningOut, startSignOutTransition] = useTransition();
  const { isAuthenticated, portalHref, signOut } = useEducveAuthState(initialAuthState);
  const toggleSidebar = () => setShowSidebar((value) => !value);

  const handleSignOut = () => {
    startSignOutTransition(async () => {
      await signOut();
      setShowSidebar(false);
      router.push("/");
      router.refresh();
    });
  };

  return (
    <>
      <header className="mfu_main_header td_site_header td_style_1 td_sticky_header td_medium td_heading_color">
        <div className="td_main_header">
          <div className="container-fluid">
            <div className="mfu_navbar td_main_header_in">
              <div className="mfu_nav_brand td_main_header_left">
                <a className="td_site_branding" href="/">
                  <BrandMark tone="dark" compact />
                </a>
              </div>

              <nav className="mfu_nav_primary" aria-label="Primary navigation">
                <ul>
                  {mainNavigation.map((item) => (
                    <li key={item.href}>
                      {item.href === "/docs" ? (
                        <DocumentationLink>{item.label}</DocumentationLink>
                      ) : (
                        <a href={item.href}>{item.label}</a>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="mfu_nav_actions td_main_header_right">
                {isAuthenticated ? (
                  <>
                    <a className="mfu_nav_action mfu_nav_action_secondary" href={portalHref}>
                      Open portal
                    </a>
                    <button
                      type="button"
                      className="mfu_nav_action mfu_nav_action_login"
                      onClick={handleSignOut}
                      disabled={isSigningOut}
                    >
                      {isSigningOut ? "Signing out..." : "Sign out"}
                    </button>
                  </>
                ) : (
                  <>
                    <a className="mfu_nav_action mfu_nav_action_login" href="/login">
                      Sign in
                    </a>
                    <a className="mfu_nav_action mfu_nav_action_secondary" href="/signup">
                      Sign up
                    </a>
                  </>
                )}

                <a className="mfu_nav_action mfu_nav_action_primary" href="/contact">
                  Contact us
                </a>

                <button
                  type="button"
                  className="td_hamburger_btn"
                  onClick={toggleSidebar}
                  aria-label="Open navigation menu"
                  aria-expanded={showSidebar}
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <HeaderSidebar
        isAuthenticated={isAuthenticated}
        isSigningOut={isSigningOut}
        portalHref={portalHref}
        showSidebar={showSidebar}
        toggleSidebar={toggleSidebar}
        onSignOut={handleSignOut}
      />
    </>
  );
};

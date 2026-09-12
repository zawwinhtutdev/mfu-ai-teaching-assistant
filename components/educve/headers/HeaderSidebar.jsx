import React from "react";
import { BrandMark } from "@/components/educve/BrandMark";
import { DocumentationLink } from "@/components/educve/DocumentationLink";

export const HeaderSidebar = ({
  showSidebar,
  toggleSidebar,
  isAuthenticated = false,
  isSigningOut = false,
  portalHref = "/chat",
  onSignOut,
}) => {
  return (
    <div className={`td_side_header ${showSidebar && "active"}`}>
      <button className="td_close" onClick={toggleSidebar} />

      <div className="td_side_header_overlay" onClick={toggleSidebar} />

      <div className="td_side_header_in">
        <div className="td_side_header_shape" />
        <a className="td_site_branding" href="/">
          <BrandMark tone="dark" compact />
        </a>

        <div className="td_side_header_box">
          <h2 className="td_side_header_heading">
            Need a smarter way to support students and courses?
          </h2>
        </div>
        <div className="td_side_header_box">
          <h3 className="td_side_header_title td_heading_color">Quick Links</h3>
          <ul className="td_side_header_contact_info td_mp_0">
            <li>
              <i className="fa-solid fa-book-open"></i>
              <span>
                <DocumentationLink>Read the MFU AI documentation</DocumentationLink>
              </span>
            </li>
            <li>
              <i className="fa-solid fa-envelope"></i>
              <span>
                <a href="/contact">Contact the MFU AI team</a>
              </span>
            </li>
            <li>
              {isAuthenticated ? (
                <>
                  <i className="fa-solid fa-table-columns"></i>
                  <span>
                    <a href={portalHref}>Go to your portal</a>
                  </span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-user-plus"></i>
                  <span>
                    <a href="/signup">Create a student or teacher account</a>
                  </span>
                </>
              )}
            </li>
            <li>
              {isAuthenticated ? (
                <>
                  <i className="fa-solid fa-right-from-bracket"></i>
                  <span>
                    <button
                      type="button"
                      onClick={onSignOut}
                      disabled={isSigningOut}
                      style={{
                        background: "transparent",
                        border: 0,
                        padding: 0,
                        color: "inherit",
                        font: "inherit",
                        cursor: isSigningOut ? "default" : "pointer",
                        textAlign: "left",
                      }}
                    >
                      {isSigningOut ? "Signing out..." : "Sign out"}
                    </button>
                  </span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-right-to-bracket"></i>
                  <span>
                    <a href="/login">Sign in to continue learning</a>
                  </span>
                </>
              )}
            </li>
          </ul>
        </div>
        <div className="td_side_header_box">
          <h3 className="td_side_header_title td_heading_color">Stay Updated</h3>
          <div className="td_newsletter td_style_1">
            <form className="td_newsletter_form">
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
  );
};

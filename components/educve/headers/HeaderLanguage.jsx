"use client";

import React from "react";

const WorldIcon = "/icons/world.svg";

export const HeaderLanguage = () => {
  return (
    <span
      className="td_header_dropdown_btn td_medium td_heading_color"
      aria-label="Language"
      style={{ cursor: "default" }}
    >
      <span>English</span>
      <img src={WorldIcon} alt="" className="td_header_dropdown_btn_icon" />
    </span>
  );
};

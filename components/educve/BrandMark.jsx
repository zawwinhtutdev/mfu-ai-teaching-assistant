import React from "react";
import { BrandIcon } from "@/components/brand-icon";

const toneStyles = {
  dark: {
    title: "#24262F",
    subtitle: "rgba(36, 38, 47, 0.64)",
  },
  light: {
    title: "#ffffff",
    subtitle: "rgba(255, 255, 255, 0.72)",
  },
};

export const BrandMark = ({ tone = "dark", compact = false }) => {
  const palette = toneStyles[tone] ?? toneStyles.dark;
  const iconSize = compact ? 42 : 48;

  return (
    <span
      className="td_site_branding"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: compact ? 12 : 14,
        whiteSpace: "nowrap",
      }}
    >
      <BrandIcon
        size={iconSize}
        tone={tone}
        style={{
          width: iconSize,
          height: iconSize,
          display: "block",
          flexShrink: 0,
        }}
      />
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.05 }}>
        <span
          style={{
            color: palette.title,
            fontSize: compact ? 22 : 28,
            fontWeight: 700,
          }}
        >
          MFU AI
        </span>
        <span
          style={{
            color: palette.subtitle,
            fontSize: compact ? 11 : 12,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          Teaching Assistant
        </span>
      </span>
    </span>
  );
};

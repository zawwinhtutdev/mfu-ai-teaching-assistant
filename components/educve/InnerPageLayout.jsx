"use client";

import React from "react";
import { Breadcrumb } from "@/components/educve/Breadcrumb";
import { FooterOne } from "@/components/educve/footers/FooterOne";
import { HeaderOne } from "@/components/educve/headers/HeaderOne";
import { ScrollToTop } from "@/components/educve/scroll_to_top/ScrollToTop";
import { useEducvePageScroll } from "@/lib/educve/hooks/useEducvePageScroll";

export const InnerPageLayout = ({ children, breadcrumbTitle, breadcrumbSubtitle }) => {
  useEducvePageScroll();

  return (
    <>
      <ScrollToTop />
      <HeaderOne />
      {breadcrumbTitle ? (
        <Breadcrumb title={breadcrumbTitle} subtitle={breadcrumbSubtitle ?? breadcrumbTitle} />
      ) : null}
      {children}
      <FooterOne />
    </>
  );
};

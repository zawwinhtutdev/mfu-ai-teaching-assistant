"use client";

import React from "react";

import { AboutOne } from "@/components/educve/about/AboutOne";
import { DepartmentOne } from "@/components/educve/departments/DepartmentOne";
import { FeatureOne } from "@/components/educve/features/FeatureOne";
import { FooterOne } from "@/components/educve/footers/FooterOne";
import { HeaderOne } from "@/components/educve/headers/HeaderOne";
import { HeroOne } from "@/components/educve/hero/HeroOne";
import { ScrollToTop } from "@/components/educve/scroll_to_top/ScrollToTop";
import { TestimonialOne } from "@/components/educve/testimonials/TestimonialOne";
import { VideoOne } from "@/components/educve/videos/VideoOne";
import { useEducvePageScroll } from "@/lib/educve/hooks/useEducvePageScroll";
import { useWow } from "@/lib/educve/hooks/useWow";

export const EducveHomepage = ({ initialAuthState }) => {
  useEducvePageScroll();
  useWow();

  return (
    <>
      <ScrollToTop />
      <HeaderOne initialAuthState={initialAuthState} />
      <HeroOne />
      <AboutOne />
      <FeatureOne />
      <DepartmentOne />
      <VideoOne initialAuthState={initialAuthState} />
      <TestimonialOne />
      <FooterOne initialAuthState={initialAuthState} />
    </>
  );
};

import React from "react";

const educveStylesheets = [
  "/educve/css/bootstrap.min.css",
  "/educve/css/fontawesome.min.css",
  "/educve/css/animate.css",
  "/educve/css/slick.css",
  "/educve/css/slick-theme.css",
  "/educve/css/popup.css",
  "/educve/css/style.css",
];

export const EducveStyleLinks = () => {
  return educveStylesheets.map((href) => (
    <link key={href} rel="stylesheet" href={href} precedence="educve-home" />
  ));
};

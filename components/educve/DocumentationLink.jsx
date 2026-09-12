import React from "react";

/**
 * Documentation uses the app's Tailwind design system, while Educve pages load
 * legacy global stylesheets. A document navigation guarantees those global
 * styles are removed before the documentation shell renders.
 */
export const DocumentationLink = ({ children, ...props }) => (
  <a {...props} href="/docs">
    {children}
  </a>
);

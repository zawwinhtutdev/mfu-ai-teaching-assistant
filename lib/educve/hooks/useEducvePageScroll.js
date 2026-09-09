"use client";

import { useEffect } from "react";

export const useEducvePageScroll = () => {
  useEffect(() => {
    const htmlStyle = document.documentElement.style;
    const bodyStyle = document.body.style;
    const previousStyles = {
      htmlOverflow: htmlStyle.overflow,
      htmlOverflowX: htmlStyle.overflowX,
      htmlOverflowY: htmlStyle.overflowY,
      bodyOverflow: bodyStyle.overflow,
      bodyOverflowX: bodyStyle.overflowX,
      bodyOverflowY: bodyStyle.overflowY,
      bodyOverscroll: bodyStyle.overscrollBehavior,
      bodyWebkitOverflow: bodyStyle.webkitOverflowScrolling,
      bodyTouchAction: bodyStyle.touchAction,
    };

    htmlStyle.overflow = "auto";
    htmlStyle.overflowX = "clip";
    htmlStyle.overflowY = "auto";
    bodyStyle.overflow = "auto";
    bodyStyle.overflowX = "clip";
    bodyStyle.overflowY = "auto";
    bodyStyle.overscrollBehavior = "auto";
    bodyStyle.webkitOverflowScrolling = "touch";
    bodyStyle.touchAction = "pan-y";

    return () => {
      htmlStyle.overflow = previousStyles.htmlOverflow;
      htmlStyle.overflowX = previousStyles.htmlOverflowX;
      htmlStyle.overflowY = previousStyles.htmlOverflowY;
      bodyStyle.overflow = previousStyles.bodyOverflow;
      bodyStyle.overflowX = previousStyles.bodyOverflowX;
      bodyStyle.overflowY = previousStyles.bodyOverflowY;
      bodyStyle.overscrollBehavior = previousStyles.bodyOverscroll;
      bodyStyle.webkitOverflowScrolling = previousStyles.bodyWebkitOverflow;
      bodyStyle.touchAction = previousStyles.bodyTouchAction;
    };
  }, []);
};

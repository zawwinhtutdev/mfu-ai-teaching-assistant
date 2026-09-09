import { usePathname } from "next/navigation";
import { useEffect } from "react";

export const useStickyHeader = () => {
  const pathname = usePathname();

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    if (typeof window !== "undefined") {
      import("jquery")
        .then(({ default: $ }) => {
          if (disposed) return;

          try {
            var $window = $(window);
            var lastScrollTop = 0;
            var $header = $(".td_sticky_header");
            var headerHeight = ($header.outerHeight() || 0) + 20;

            const handleScroll = () => {
              var windowTop = $window.scrollTop();

              if (windowTop >= headerHeight) {
                $header.addClass("td_gescout_sticky");
              } else {
                $header.removeClass("td_gescout_sticky");
                $header.removeClass("td_gescout_show");
              }

              if ($header.hasClass("td_gescout_sticky")) {
                if (windowTop < lastScrollTop) {
                  $header.addClass("td_gescout_show");
                } else {
                  $header.removeClass("td_gescout_show");
                }
              }

              lastScrollTop = windowTop;
            };

            $window.off("scroll.educveStickyHeader").on("scroll.educveStickyHeader", handleScroll);

            cleanup = () => {
              $window.off("scroll.educveStickyHeader", handleScroll);
            };
          } catch (error) {
            console.log(error);
          }
        })
        .catch((error) => {
          console.log(error);
        });
    }

    return () => {
      disposed = true;
      cleanup();
    };
  }, [pathname]);
};

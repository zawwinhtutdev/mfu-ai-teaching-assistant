import { usePathname } from "next/navigation";
import { useEffect } from "react";

export const useMobilemenu = () => {
  const pathname = usePathname();

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    if (typeof window !== "undefined") {
      import("jquery")
        .then(({ default: $ }) => {
          if (disposed) return;

          try {
            $(".td_nav").each(function () {
              if (!$(this).children(".td_menu_toggle").length) {
                $(this).append('<span class="td_menu_toggle"><span></span></span>');
              }
            });

            $(".menu-item-has-children").each(function () {
              if (!$(this).children(".td_munu_dropdown_toggle").length) {
                $(this).append('<span class="td_munu_dropdown_toggle"><span></span></span>');
              }
            });

            $(document)
              .off("click.educveMobileMenu", ".td_menu_toggle")
              .off("click.educveMobileMenu", ".td_munu_dropdown_toggle")
              .off("click.educveMobileMenu", ".td_header_dropdown_btn")
              .on("click.educveMobileMenu", ".td_menu_toggle", function () {
                $(this)
                  .toggleClass("td_toggle_active")
                  .siblings(".td_nav_list_wrap")
                  .toggleClass("td_active");
              })
              .on("click.educveMobileMenu", ".td_munu_dropdown_toggle", function () {
                $(this).toggleClass("active").siblings("ul").slideToggle();
                $(this).parent().toggleClass("active");
              })
              .on("click.educveMobileMenu", ".td_header_dropdown_btn", function () {
                $(this).toggleClass("active");
              });

            cleanup = () => {
              $(document)
                .off("click.educveMobileMenu", ".td_menu_toggle")
                .off("click.educveMobileMenu", ".td_munu_dropdown_toggle")
                .off("click.educveMobileMenu", ".td_header_dropdown_btn");
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

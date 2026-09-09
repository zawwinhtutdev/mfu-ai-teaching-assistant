import { EducveStyleLinks } from "@/components/educve/EducveStyleLinks"
import { InnerPageLayout } from "@/components/educve/InnerPageLayout"

export default function SignUpSuccessPage() {
  return (
    <>
      <EducveStyleLinks />
      <InnerPageLayout breadcrumbTitle="Sign Up" breadcrumbSubtitle="Account Created">
        <section>
          <div className="td_height_120 td_height_lg_80" />
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-lg-6">
                <div className="td_form_card td_style_1 td_radius_10 td_gray_bg_5">
                  <div className="td_form_card_in text-center">
                    <div
                      style={{
                        width: 80,
                        height: 80,
                        borderRadius: "50%",
                        backgroundColor: "rgba(22, 163, 74, 0.12)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto 24px",
                        fontSize: 36,
                      }}
                    >
                      ✉️
                    </div>
                    <h2 className="td_fs_36 td_mb_20">Check Your Email</h2>
                    <p className="td_fs_18 td_mb_30" style={{ color: "#666" }}>
                      We&apos;ve sent you a confirmation link. Please check your email and click
                      the link to activate your account. Once confirmed, you can log in and
                      start using the platform.
                    </p>
                    <a
                      href="/login"
                      className="td_btn td_style_1 td_radius_10 td_medium"
                    >
                      <span className="td_btn_in td_white_color td_accent_bg">
                        <span>Back to Login</span>
                      </span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="td_height_120 td_height_lg_80" />
        </section>
      </InnerPageLayout>
    </>
  )
}

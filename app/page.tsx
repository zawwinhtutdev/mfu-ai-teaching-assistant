import { EducveHomepage } from "@/components/educve/Homepage"
import { EducveStyleLinks } from "@/components/educve/EducveStyleLinks"
import { getInitialEducveAuthState } from "@/lib/educve/get-initial-auth-state"

export default async function HomePage() {
  const initialAuthState = await getInitialEducveAuthState()

  return (
    <>
      <EducveStyleLinks />
      <EducveHomepage initialAuthState={initialAuthState} />
    </>
  )
}

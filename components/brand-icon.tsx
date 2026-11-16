import Image from "next/image"
import type { CSSProperties } from "react"

type BrandIconProps = {
  className?: string
  priority?: boolean
  /** Rendered height in pixels. The crest keeps its own aspect ratio. */
  size?: number
  style?: CSSProperties
  /** Kept for call-site compatibility; the crest is full colour everywhere. */
  tone?: "dark" | "light"
}

/** The university crest, the one mark used across the whole product. */
const CREST_SRC = "/brand/mfu-crest.png"
/** Native width / height of the master crest, so every render keeps its shape. */
const CREST_ASPECT = 558 / 934

export function BrandIcon({ className, priority = false, size = 40, style }: BrandIconProps) {
  return (
    <Image
      src={CREST_SRC}
      alt=""
      aria-hidden="true"
      className={className}
      width={Math.round(size * CREST_ASPECT)}
      height={size}
      priority={priority}
      style={{ height: size, width: "auto", ...style }}
      unoptimized
    />
  )
}

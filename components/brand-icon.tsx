import Image from "next/image"
import type { CSSProperties } from "react"

type BrandIconProps = {
  className?: string
  priority?: boolean
  size?: number
  style?: CSSProperties
  tone?: "dark" | "light"
}

const iconSources = {
  dark: "/brand/mfu-ai-mark-dark.svg",
  light: "/brand/mfu-ai-mark-light.svg",
} as const

export function BrandIcon({ className, priority = false, size = 40, style, tone = "dark" }: BrandIconProps) {
  return (
    <Image
      src={iconSources[tone]}
      alt=""
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      priority={priority}
      style={style}
      unoptimized
    />
  )
}

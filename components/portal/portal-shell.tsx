"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { BrandIcon } from "@/components/brand-icon"
import "./portal.css"

export type PortalVariant = "teacher" | "student" | "admin"
/** Structural archetype — the three portals deliberately do not share one navigation model. */
export type PortalChrome = "sidebar" | "rail" | "topbar"

export type PortalNavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string; size?: number | string }>
  badge?: string | number
  exact?: boolean
  /** Nested rows (e.g. a collapsible section such as Spaces › Space List). */
  depth?: number
  /** Renders a disclosure chevron without changing behaviour. */
  chevron?: boolean
}

export type PortalNavGroup = {
  label?: string
  items: PortalNavItem[]
}

export type PortalRailItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string; size?: number | string }>
}

export interface PortalShellProps {
  variant: PortalVariant
  chrome: PortalChrome
  /** Wordmark suffix, e.g. "Teacher Portal" / "Student Portal" / "Admin Console" */
  productName: string
  title: string
  crumbs?: string[]
  nav: PortalNavGroup[]
  actions?: React.ReactNode
  railItems?: PortalRailItem[]
  extra?: React.ReactNode
  /** Rendered above the first nav group (e.g. a pinned course picker). */
  extraTop?: React.ReactNode
  contextChip?: React.ReactNode
  onNavigate?: (href: string) => boolean
  children: React.ReactNode
}

function isActive(pathname: string, item: PortalNavItem) {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(item.href + "/")
}

export function PortalShell(props: PortalShellProps) {
  const { variant, chrome, productName, title, crumbs, nav, actions, railItems, extra, extraTop, contextChip, onNavigate, children } = props
  const pathname = usePathname() || ""
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const items = nav.flatMap((g) => g.items)
  const rail = railItems?.length ? railItems : items.slice(0, 5)
  const brandTone = variant === "admin" ? "light" : "dark"

  // Close the mobile drawer on Escape and lock background scroll while it is open.
  React.useEffect(() => {
    if (!mobileOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", onKey)
    }
  }, [mobileOpen])

  const head = (compact?: boolean) => (
    <header className={cn("mfp-head", compact && "mfp-head--compact")}>
      <button
        type="button"
        className="mfp-icon-btn mfp-only-mobile"
        onClick={() => setMobileOpen((v) => !v)}
        aria-label="Toggle navigation"
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>
      <div className="min-w-0">
        <div className="mfp-head-title truncate">{title}</div>
        {crumbs?.length ? (
          <div className="mfp-head-crumb truncate">
            {crumbs.map((c, i) => (
              <React.Fragment key={c + i}>
                {i > 0 && <span>/</span>}
                <span className={i === crumbs.length - 1 ? "mfp-crumb-current" : undefined}>{c}</span>
              </React.Fragment>
            ))}
          </div>
        ) : null}
      </div>
      {contextChip ? <div className="mfp-chip">{contextChip}</div> : null}
      <div className="mfp-head-actions">{actions}</div>
    </header>
  )

  const navList = (withGroups: boolean) => (
    <>
      {extraTop}
      {nav.map((group, gi) => (
        <React.Fragment key={(group.label || "g") + gi}>
          {withGroups && group.label ? <div className="mfp-side-group">{group.label}</div> : null}
          {group.items.map((item) => {
            const Icon = item.icon
            const active = isActive(pathname, item)
            return (
              <Link
                key={item.href}
                href={item.href}
                className="mfp-nav-item"
                data-active={active}
                data-depth={item.depth ?? 0}
                aria-current={active ? "page" : undefined}
                onClick={(e) => {
                  setMobileOpen(false)
                  if (onNavigate?.(item.href)) e.preventDefault()
                }}
              >
                {item.depth ? <span className="mfp-nav-dot" aria-hidden /> : <Icon size={18} />}
                <span className="truncate">{item.label}</span>
                {item.badge !== undefined && <span className="mfp-nav-count">{item.badge}</span>}
                {item.chevron ? <span className="mfp-nav-chev" aria-hidden>›</span> : null}
              </Link>
            )
          })}
        </React.Fragment>
      ))}
      {extra}
    </>
  )

  const drawer = (
    <>
      <div className="mfp-scrim" data-open={mobileOpen} onClick={() => setMobileOpen(false)} aria-hidden />
      <aside className="mfp-drawer" data-open={mobileOpen} aria-label={productName} inert={!mobileOpen}>
        <div className="mfp-brandblock">
          <BrandIcon size={30} tone={brandTone as "light" | "dark"} />
          <div className="mfp-brandblock-text">
            <span className="mfp-brandblock-name">MFU AI</span>
            <span className="mfp-brandblock-product">{productName}</span>
          </div>
          <button type="button" className="mfp-icon-btn" onClick={() => setMobileOpen(false)} aria-label="Close navigation" style={{ marginLeft: "auto" }}>
            <X size={18} />
          </button>
        </div>
        <div className="mfp-side-scroll">{navList(true)}</div>
      </aside>
    </>
  )

  /* ── teacher: sidebar-first, no icon rail ───────────────────────────── */
  if (chrome === "sidebar") {
    return (
      <div className="mfp" data-variant={variant} data-chrome="sidebar">
        <aside className="mfp-side mfp-side--brand" data-open={mobileOpen} aria-label={productName}>
          <div className="mfp-brandblock">
            <BrandIcon size={32} tone={brandTone as "light" | "dark"} />
            <div className="mfp-brandblock-text">
              <span className="mfp-brandblock-name">MFU AI</span>
              <span className="mfp-brandblock-product">{productName}</span>
            </div>
          </div>
          <div className="mfp-side-scroll">{navList(true)}</div>
        </aside>
        <div className="mfp-main">
          {head()}
          <main className="mfp-content">{children}</main>
        </div>
      </div>
    )
  }

  /* ── student: icon rail, no second column ───────────────────────────── */
  if (chrome === "rail") {
    return (
      <div className="mfp" data-variant={variant} data-chrome="rail">
        <aside className="mfp-rail" aria-label={productName}>
          <Link href={items[0]?.href || "/"} className="mfp-brand" aria-label="MFU AI">
            <BrandIcon size={40} tone={brandTone as "light" | "dark"} />
          </Link>
          {rail.slice(0, 5).map((item) => {
            const Icon = item.icon
            const active = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link key={item.href} href={item.href} className="mfp-rail-btn" data-active={active} aria-current={active ? "page" : undefined}>
                <Icon size={20} />
                <span className="mfp-rail-label">{item.label}</span>
              </Link>
            )
          })}
          <div className="mfp-rail-spacer" />
          <span className="mfp-rail-label mfp-rail-caption">{variant}</span>
        </aside>

        <div className="mfp-main">
          {head()}
          {drawer}
          <main className="mfp-content">{children}</main>
        </div>
      </div>
    )
  }

  /* ── admin: full-width top bar + dense nav column, no rail ──────────── */
  return (
    <div className="mfp" data-variant={variant} data-chrome="topbar">
      <div className="mfp-topbar">
        <BrandIcon size={28} tone="light" />
        <div className="mfp-topbar-id">
          <span className="mfp-topbar-name">MFU AI</span>
          <span className="mfp-topbar-product">{productName}</span>
        </div>
        {contextChip ? <div className="mfp-chip">{contextChip}</div> : null}
        <div className="mfp-head-actions">{actions}</div>
      </div>
      <div className="mfp-body">
        <nav className="mfp-side mfp-side--dense" data-open={mobileOpen} aria-label="Sections">
          <div className="mfp-side-scroll">{navList(true)}</div>
        </nav>
        <main className="mfp-content mfp-content--dense">{children}</main>
      </div>
    </div>
  )
}

/** Page heading used inside the content area. */
export function PortalPageHead({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="mfp-page-head">
      <div className="min-w-0">
        <h1 className="mfp-page-title">{title}</h1>
        {subtitle ? <p className="mfp-page-sub">{subtitle}</p> : null}
      </div>
      {right ? <div className="ml-auto flex shrink-0 items-center gap-2">{right}</div> : null}
    </div>
  )
}

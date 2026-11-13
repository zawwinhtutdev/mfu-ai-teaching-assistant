"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
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
  /** Renders a disclosure chevron. When `children` is present it toggles them. */
  chevron?: boolean
  /**
   * Rows revealed under this item. The disclosure stays open on the group the
   * current path belongs to, so a deep link such as ?role=teacher still shows
   * which section you are in.
   */
  children?: PortalNavItem[]
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

/**
 * Is this nav item the current location?
 *
 * An href may carry query params (`/users?role=teacher`). The comparison has to
 * consider them: a param-carrying href only matches when every one of its params
 * matches, and a param-free href on a route that supports params must *not*
 * match — otherwise a parent like "Members" lights up alongside every role child
 * it contains.
 */
function isActive(pathname: string, search: URLSearchParams, item: PortalNavItem) {
  const [rawPath, rawQuery] = item.href.split("?")
  const pathMatches = item.exact
    ? pathname === rawPath
    : pathname === rawPath || pathname.startsWith(rawPath + "/")
  if (!pathMatches) return false
  if (!rawQuery) return true

  for (const [key, value] of new URLSearchParams(rawQuery).entries()) {
    if (search.get(key) !== value) return false
  }
  return true
}

export function PortalShell(props: PortalShellProps) {
  const { variant, chrome, productName, title, crumbs, nav, actions, railItems, extra, extraTop, contextChip, onNavigate, children } = props
  const pathname = usePathname() || ""
  const searchParams = useSearchParams()
  const search = React.useMemo(() => new URLSearchParams(searchParams?.toString() ?? ""), [searchParams])
  const [mobileOpen, setMobileOpen] = React.useState(false)

  /**
   * Open disclosures, keyed by item href.
   *
   * Sections that contain the active path start open; anything the user has
   * explicitly toggled keeps their choice. Storing only explicit toggles (not a
   * copy of the derived state) is what lets a route change re-open the right
   * section without fighting the user's last click.
   */
  const [toggled, setToggled] = React.useState<Record<string, boolean>>({})
  const isExpanded = (item: PortalNavItem) => {
    const explicit = toggled[item.href]
    if (explicit !== undefined) return explicit
    const matchesSelf = isActive(pathname, search, item)
    const matchesChild = (item.children ?? []).some((child) => isActive(pathname, search, child))
    return matchesSelf || matchesChild
  }

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

  /**
   * One nav row. Separated from the list so a parent and its children render
   * through the same code path — the only difference is indentation and that a
   * parent with children toggles instead of navigating.
   */
  const navRow = (item: PortalNavItem, keyPrefix: string) => {
    const Icon = item.icon
    const childActive = (item.children ?? []).some((child) => isActive(pathname, search, child))
    // A parent that contains the current page is "within", never "active": its
    // own href (/users) is a path prefix of every child (/users?role=...), so
    // the plain match would light it up alongside the leaf.
    const active = isActive(pathname, search, item) && !childActive
    const expandable = Boolean(item.children?.length)
    const expanded = expandable ? isExpanded(item) : false

    const className = "mfp-nav-item"
    const common = {
      className,
      "data-active": active,
      "data-within": !active && expandable && childActive ? "true" : undefined,
      "data-depth": item.depth ?? 0,
      title: item.label,
    } as const

    const inner = (
      <>
        {item.depth ? <span className="mfp-nav-dot" aria-hidden /> : <Icon size={18} />}
        <span className="truncate">{item.label}</span>
        {item.badge !== undefined && <span className="mfp-nav-count">{item.badge}</span>}
        {expandable ? (
          <span className="mfp-nav-chev" data-expanded={expanded} aria-hidden>
            ›
          </span>
        ) : item.chevron ? (
          <span className="mfp-nav-chev" aria-hidden>
            ›
          </span>
        ) : null}
      </>
    )

    if (expandable) {
      // A disclosure, not a link: the parent's own href is either duplicated by
      // a child or is not a real destination.
      return (
        <div key={`${keyPrefix}-${item.href}`}>
          <button
            type="button"
            {...common}
            aria-expanded={expanded}
            aria-controls={`nav-sub-${keyPrefix}-${item.href}`}
            onClick={() => {
              setToggled((prev) => ({ ...prev, [item.href]: !expanded }))
              onNavigate?.(item.href)
            }}
          >
            {inner}
          </button>
          {expanded ? (
            <div id={`nav-sub-${keyPrefix}-${item.href}`}>
              {(item.children ?? []).map((child) => navRow(child, `${keyPrefix}-${item.href}`))}
            </div>
          ) : null}
        </div>
      )
    }

    return (
      <Link
        key={`${keyPrefix}-${item.href}`}
        href={item.href}
        {...common}
        aria-current={active ? "page" : undefined}
        onClick={(e) => {
          setMobileOpen(false)
          if (onNavigate?.(item.href)) e.preventDefault()
        }}
      >
        {inner}
      </Link>
    )
  }

  /**
   * Nav rows only. The `extra` slot is rendered separately, outside the scroll
   * area: putting it inside meant `margin-top: auto` had no free space to
   * consume, so a pinned footer just sat wherever the nav content ended.
   */
  const navList = (withGroups: boolean) => (
    <>
      {extraTop}
      {nav.map((group, gi) => (
        <React.Fragment key={(group.label || "g") + gi}>
          {withGroups && group.label ? <div className="mfp-side-group">{group.label}</div> : null}
          {group.items.map((item) => navRow(item, `g${gi}`))}
        </React.Fragment>
      ))}
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
        {extra ? <div className="mfp-side-footer">{extra}</div> : null}
      </aside>
    </>
  )

  /* ── teacher: sidebar-first, no icon rail ───────────────────────────── */
  if (chrome === "sidebar") {
    return (
      <div className="mfp" data-variant={variant} data-chrome="sidebar">
        {/* The sidebar becomes an overlay below 1024px. Without a scrim there is
            nothing to click outside it and no close affordance inside, so it
            could only be dismissed with the hamburger — which reads as "stuck". */}
        <div className="mfp-scrim" data-open={mobileOpen} onClick={() => setMobileOpen(false)} aria-hidden />
        <aside className="mfp-side mfp-side--brand" data-open={mobileOpen} aria-label={productName}>
          <div className="mfp-brandblock">
            <BrandIcon size={32} tone={brandTone as "light" | "dark"} />
            <div className="mfp-brandblock-text">
              <span className="mfp-brandblock-name">MFU AI</span>
              <span className="mfp-brandblock-product">{productName}</span>
            </div>
            <button
              type="button"
              className="mfp-icon-btn mfp-side-close"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
              style={{ marginLeft: "auto" }}
            >
              <X size={18} />
            </button>
          </div>
          <div className="mfp-side-scroll">{navList(true)}</div>
          {extra ? <div className="mfp-side-footer">{extra}</div> : null}
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
        {/* The dense nav column is off-canvas below 1024px, so the topbar needs
            its own toggle. Without this the sidebar translated itself out of
            view and no control existed to bring it back. */}
        <button
          type="button"
          className="mfp-icon-btn mfp-topbar-menu mfp-only-mobile"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <BrandIcon size={28} tone="light" />
        <div className="mfp-topbar-id">
          <span className="mfp-topbar-name">MFU AI</span>
          <span className="mfp-topbar-product">{productName}</span>
        </div>
        {contextChip ? <div className="mfp-chip">{contextChip}</div> : null}
        <div className="mfp-head-actions">{actions}</div>
      </div>
      <div className="mfp-body">
        <div className="mfp-scrim" data-open={mobileOpen} onClick={() => setMobileOpen(false)} aria-hidden />
        <nav className="mfp-side mfp-side--dense" data-open={mobileOpen} aria-label="Sections">
          <div className="mfp-side-scroll">{navList(true)}</div>
          {extra ? <div className="mfp-side-footer">{extra}</div> : null}
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

# Portal design system — inspired by CLASSUM

Applies to **Teacher Portal**, **Student Portal** and **Admin Console**. The AI Chat page keeps
its own `mf-chat.css`; the portals use a sibling system so all three read as one product.

## Why this direction

CLASSUM's workspace was captured end-to-end (see `rea-classum/` in the workspace): 72px rail,
56px header, ~248px section sidebar, 12px cards, 100px pill actions, one neutral text colour,
and colour reserved for the mark rather than for surfaces. That structure survives role
switches, which is exactly what three portals need.

## Tokens (`components/portal/portal.css`, scoped to `.mfp`)

| token | light | dark |
|---|---|---|
| canvas | `#ffffff` | `#17181d` |
| rail | `#f0f2f8` | `#1e1f25` |
| sidebar | `#ffffff` | `#1c1d22` |
| hover | `#f6f7fb` | `#24262d` |
| selected | `#f0f2f8` | `#272a31` |
| line | `#eff1f6` | `#2a2c33` |
| text | `#232334` | `#f2f3f7` |
| muted / tertiary | `#666b80` / `#8d92a6` | `#9aa0b2` / `#7d8396` |
| pill | `#232334` on white text | inverted |

Radii: 12px cards and nav rows, 10px inputs, 100px pills. Header 56px, rail 72px, sidebar 248px,
content padding 24/28. Type: Pretendard (already used by the chat page) with the app's Geist
fallback; 17/600 header title, 22/700 page title, 14/500 nav, 13 body, 12 meta.

The CSS is **unlayered on purpose** so it wins over the Tailwind utilities the legacy components
still carry — no page had to be rewritten to pick up the shell.

## Structure

```
components/portal/portal-shell.tsx   PortalShell (rail + header + sidebar + content) and PortalPageHead
components/portal/portal.css         tokens, shell, and re-skinning of shadcn Card/Table/Tabs/Badge
components/admin/admin-shell.tsx     admin nav + sign-out, wraps every /admin page except /admin/login
app/admin/layout.tsx                 mounts AdminShell
app/admin/dashboard/layout.tsx       was a second (maroon) sidebar — now an empty wrapper
```

Teacher and student layouts keep their page config, course lists and header actions; they just
render the shell instead of the old red header + left drawer.

## Classum element → MFU element

| CLASSUM | MFU portal |
|---|---|
| 72px rail with labelled icons, active = white card | `.mfp-rail` / `.mfp-rail-btn` |
| 56px header: title + breadcrumb + utilities | `.mfp-head`, crumbs = "Portal / Section" |
| 248px sidebar with grouped nav, selected row = `#f0f2f8` | `.mfp-side`, `.mfp-nav-item` |
| "My spaces" list under the nav | "My courses" list (real course links) |
| Space card: squircle mark, title, meta, "…" | Course card: initial mark, title, code, "…" |
| "+ Space" dark pill floating bottom-right | "New course" dark pill (teacher) |
| Table with `#f8f9fc` header band | member/audit/user tables in admin |
| Notification drawer on the bell | unchanged (chat page pattern) |

## Verify locally

Portal routes need a session. The repo ships demo accounts (`lib/demo-auth.ts`); set
`mfu_demo_role` + `mfu_demo_email` cookies (or log in normally) and open:

- `/teacherportal/mycourses`
- `/studentportal/mycourses`
- `/admin/dashboard`

Screenshots from the last pass are in `ai-teaching-assistant/shots/` (`teacher3.png`,
`student3.png`, `admin5.png`, `s-studytools3.png`).

## Still to do

- Remaining content pages keep their own inner headings, so the section title appears twice
  (header + H1). Drop the in-content H1 where it duplicates `.mfp-head-title`.
- A few legacy cards still carry soft neumorphic shadows (`shadow-[4px_4px_8px…]`); they are
  harmless but inconsistent — replace with `.mfp-card` as each page is touched.
- Mobile: the sidebar collapses to a drawer at ≤1024px and the rail hides at ≤768px; fine-tune
  once the tablet breakpoints are agreed.

## Three navigation archetypes (they do not share a sidebar)

`PortalShell` takes `chrome` and renders a different structure per portal — not one shell recoloured:

| | Teacher — `chrome="sidebar"` | Student — `chrome="rail"` | Admin — `chrome="topbar"` |
|---|---|---|---|
| navigation | 280px sidebar that **owns the brand** ("MFU AI / TEACHER PORTAL"), grouped sections, course list under "My courses" | 72px icon rail only (no second column, no section tabs) | **dark 52px top bar** with brand, product, environment chip; 232px dense nav column |
| header | in the content area, 60px, 2px red rule, breadcrumb + "2 courses" | 56px, breadcrumb + "3 enrolled", no sidebar | none — the top bar is the header |
| accent | MFU red `#a81d24` | blue `#2563eb` | ink `#17181d` |
| density | comfortable (14px nav, 40px rows) | comfortable | compact (13px nav, 34px rows, 12.5px tables) |
| corners | 14px | 16px | 8px |
| primary action | "New course" pill, bottom-right | "Open course" / "Add reminder" | Refresh / filters in content |

Feature sets differ because the routes and page components differ: teacher pages author courses and read
analytics; student pages consume them (AI study tools, reminders, social); admin pages govern
(users, audit logs, privacy, policies). The shell supplies chrome only.

Removed along the way: two student pages (settings, reminders) still rendered their own maroon header
inside the shell; admin's stat chips went black on the dark rail (now use `--p-chip`); admin's page
title was printed twice (top bar + page head) — the page head is gone in `topbar` mode.

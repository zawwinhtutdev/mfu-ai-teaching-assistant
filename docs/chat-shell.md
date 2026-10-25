# Chat page — Socra-style shell (2026-11-13)

The `/chat` route now renders the shell cloned from socra.ai/en/chat (see
`../socra-clone/site` for that study), carrying MFU identity and all existing behaviour.

## Files touched

| File | Change |
| --- | --- |
| `app/chat/mf-chat.css` | **new.** All shell styling, scoped under `.mfchat` with light + `.dark` token sets. Plain, unlayered CSS so it wins over Tailwind utilities without rewriting components. |
| `app/chat/layout.tsx` | rewritten: `.mfchat` shell, mobile top bar (menu / wordmark / new chat), Pretendard link, imports `mf-chat.css`. |
| `components/chat/chat-sidebar.tsx` | rewritten markup: inset card, wordmark, icon rail collapse (persisted in `localStorage: mf-chat-rail`), nav (New chat / Student / Teacher Portal / AI Agents / Documents RAG / MFU Daily), `Recent` list, Settings + profile footer. Logic (conversations fetch, Supabase + demo-auth profile, logout) unchanged. |
| `components/chat/chat-interface.tsx` | rewritten JSX: hero + suggestion chips, bubble/assistant message layout, new composer (attach / mic / model pill / send), RAG banner, tip row, terms line. All data logic (useChat, conversation create, uploads, feedback, demo sync) preserved. |

Nothing else in the app changed — other routes still use the old design system.

## Design tokens (ported from the Socra capture)

Dark: bg `#1d1e21`, raised `#27282b`, inset `#141518`, border `#46474a`,
text `#f3f6f9` / soft `#dadee2` / muted `#a0a3a7`, send `#f2f4f8` on `#141518`.
Light: bg `#f2f4f8`, raised `#fff`, inset `#eaedf2`, border `#d9dce2`,
text `#0e0e17` / muted `#53555c`, send `#0e0f12` on `#fff`.
Radii: control 8, card 16, composer 24. Sidebar 260px, rail 60px, text column 768px.
Breakpoint: one at 1024px (sidebar becomes a drawer, chips become a horizontal scroller).
Accent stays MFU red `#a81d24`; the clone's blue/orange is kept only as a variable, unused.

## Reverting

The old markup lives in git history for these four files only:

```bash
git checkout -- app/chat/layout.tsx components/chat/chat-sidebar.tsx components/chat/chat-interface.tsx
rm app/chat/mf-chat.css
npm run build && npm run start
```

## Build note

`next build` fails on stray `.next/dev/types/* 2.ts` duplicates (iCloud-style filename
copies) with `Duplicate identifier 'LayoutProps'`. Delete them before building:

```bash
find .next -name "* 2.ts" -delete
```

## Settings dialog (2026-11-13, second pass)

`components/settings-modal.tsx` was rebuilt in the cloned dialog style:

- 660 × 630 dialog, radius 16, header row (`Settings` + close), left text rail (160px) with the
  active row highlighted, right pane with an `Account` / `General` / `Security` /
  `Terms and policies` section label and 56px icon rows split by dividers.
- Rows: Full name / Email (inline inputs), Role (value + chevron), Email + LINE notification
  toggles, Language (`English ›` → en / th / zh), **Dark mode** switch bound to `next-themes`,
  two-factor switch, change password, and the About tab (terms / privacy / contact).
- Footer reproduces the clone's company block + `MFU AI` wordmark.
- Rail order: Profile · Notifications · Appearance · Security · About.
- The modal now lives in `app/chat/layout.tsx` (not inside the sidebar) so it survives the
  mobile drawer closing; the shell's drawer is z-60, portaled dialogs are raised to z-90/91
  only on pages that use `.mfchat`.


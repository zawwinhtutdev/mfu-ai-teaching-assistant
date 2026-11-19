# Documentation

Project-level documentation for **MFU AI Teaching Assistant**.

The in-app end-user documentation lives in [`content/docs`](../content/docs) and
is served at [`/docs`](https://aiassistant-mfu.vercel.app/docs). The files here
cover deploying, configuring, testing and understanding the project.

| Document | What it covers |
| --- | --- |
| [DEPLOY.md](DEPLOY.md) | Vercel + Supabase deployment, environment, Google SSO, verification |
| [TEST_ACCOUNTS.md](TEST_ACCOUNTS.md) | Seeded accounts, roles, enrollments, password resets |
| [design-portals.md](design-portals.md) | Portal information architecture and UX decisions |
| [chat-shell.md](chat-shell.md) | Chat shell layout, streaming and conversation model |
| [VPS_SETUP.md](VPS_SETUP.md) | Self-hosted Docker/Caddy deployment notes |
| [assets/](assets) | Screenshots, banner and social preview; upload `assets/social-preview.png` under GitHub **Settings → Social preview** |

Historical design notes and prototypes live in [archive/](archive) and are kept
for context, not as current documentation.

## Contributing to docs

- Project docs: edit the Markdown files in this folder.
- End-user docs: edit [`content/docs`](../content/docs); the app renders them at `/docs`.
- Screenshots: add PNG/WebP files under [`assets`](assets) and reference them with a relative path.

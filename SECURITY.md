# Security Policy

## Supported versions

This project is actively maintained on the `main` branch. Security fixes land on
`main`; there are no long-lived release branches yet.

| Version | Supported |
| --- | --- |
| `main` (latest) | ✅ |
| Older deployments | ❌ |

## Reporting a vulnerability

**Please do not open a public issue for a security vulnerability.**

Use GitHub's private vulnerability reporting:

> [Report a vulnerability](https://github.com/zawwinhtutdev/mfu-ai-teaching-assistant/security/advisories/new)

Please include:

- A description of the issue and its impact
- Steps to reproduce (including the affected role and route)
- Any relevant configuration or environment details
- A suggested fix, if you have one

You can expect an acknowledgement within **72 hours** and a status update within
**7 days**. Please give the maintainers reasonable time to fix and deploy before
disclosing the issue publicly.

## In scope

- Authentication and session handling (Supabase Auth, PKCE callback, Google OIDC)
- Authorization bypasses — cross-course access, role escalation, RLS gaps
- Prompt injection that escapes course scope or fabricated citations
- Secrets or personal data accidentally committed to the repository
- Dependency vulnerabilities that are reachable through the application

## Out of scope

- The seeded demo accounts and demo credentials published in the README — they
  exist to make the demo usable and contain no personal data.
- Denial-of-service from unrealistic resource usage
- Vulnerabilities in third-party services (report those upstream)

## Safe harbour

Good-faith research that respects this policy is welcome. Do not access, modify
or exfiltrate data that does not belong to you, and do not disrupt the live
demo deployment while testing.

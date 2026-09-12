# Security Policy

## Automated Scanning

This repo runs several automated checks against every push and pull request:

- **[CodeQL](https://github.com/marcintk/ha-planetary-solar-system-card/security/code-scanning)** —
  static analysis of the TypeScript/JavaScript source.
- **[OSSF Scorecard](https://securityscorecards.dev/viewer/?uri=github.com/marcintk/ha-planetary-solar-system-card)**
  — scores the repo's supply-chain hygiene (branch protection, action pinning, CI hardening).
- **[Dependabot](https://github.com/marcintk/ha-planetary-solar-system-card/security/dependabot)** —
  weekly update PRs for vulnerable npm and GitHub Actions dependencies.
- **[Socket](https://socket.dev)** — scans `package.json`/lockfile changes on every PR for malware,
  typosquats, and other supply-chain risks in new or changed dependencies, and its Firewall (`sfw`)
  gates `npm ci` in CI so a malicious package can't install even between Dependabot's weekly runs.
  Repo policy is checked in at
  [`socket.yml`](https://github.com/marcintk/ha-planetary-solar-system-card/blob/main/socket.yml).

## Supported Versions

Only the latest released version of this card is supported with security fixes. Older versions
should be upgraded via HACS.

## Reporting a Vulnerability

Please report security vulnerabilities privately using
[GitHub Security Advisories](https://github.com/marcintk/ha-planetary-solar-system-card/security/advisories/new)
rather than opening a public issue.

If you're unable to use GitHub Security Advisories, open a regular issue asking for a private
contact channel and avoid describing the vulnerability publicly.

You should expect an initial response within a week. This is a hobby project maintained in spare
time, so please be patient.

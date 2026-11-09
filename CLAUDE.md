# Source control

GitLab is the primary remote (`origin`). GitHub is a secondary mirror (`github` remote), restored 2026-11-09 after a brief outage.

- Pull, branch and review against `origin` (GitLab) first.
- `git push` on `main` pushes to both GitLab and GitHub (dual push URLs on `origin`). If GitHub diverges, GitLab wins.
- Never commit GitHub-only changes. Don't force-push `main` without asking.
- Tooling, CI and docs should treat GitLab as the source of truth.

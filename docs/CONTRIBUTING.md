# Contributing to Player Vault

Thanks for taking the time to contribute!  
This document covers everything you need to get a development environment running, understand the codebase, and submit a quality pull request.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [Running Tests](#running-tests)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Style Guide](#style-guide)

---

## Code of Conduct

Be respectful and constructive. Harassment, hate speech, or personal attacks will not be tolerated.

---

## Getting Started

**Prerequisites**

| Tool | Minimum version |
|------|----------------|
| Node.js | 20.x |
| npm | 9.x |
| Git | any recent version |

**Clone and install**

```bash
git clone https://github.com/tescolopio/Obsidian_PlayerVault.git
cd Obsidian_PlayerVault
npm ci
```

**Symlink into your test vault** (optional but recommended)

```bash
# macOS / Linux
ln -s "$(pwd)" "/path/to/your/vault/.obsidian/plugins/player-vault"

# Windows (run as Administrator)
mklink /D "C:\path\to\vault\.obsidian\plugins\player-vault" "%CD%"
```

Then enable **Player Vault** in Obsidian → Settings → Community plugins.

---

## Development Workflow

**Watch mode** — rebuilds `main.js` on every save:

```bash
npm run dev
```

Reload the plugin in Obsidian without restarting:  
Open the command palette → **Reload app without saving** (or install the [Hot Reload](https://github.com/pjeby/hot-reload) community plugin).

**Production build** (type-check + minified bundle):

```bash
npm run build
```

---

## Project Structure

See [ARCHITECTURE.md](ARCHITECTURE.md) for a full breakdown.  
The short version:

| File | Responsibility |
|------|---------------|
| `src/main.ts` | Plugin entry point, export pipeline |
| `src/exporter.ts` | Markdown → HTML, link resolution, file I/O |
| `src/sanitizer.ts` | GM-content stripping via regex |
| `src/settings.ts` | Settings interface + settings tab UI |
| `src/onboarding.ts` | First-run wizard modal |

---

## Running Tests

```bash
npm test                  # run all tests
npm test -- --watch       # watch mode
npm test -- --coverage    # with coverage report
```

Tests live in `tests/`. Each source file has a corresponding `*.test.ts`.  
The `tests/__mocks__/obsidian.ts` stub replaces the Obsidian API in the Node test environment — extend it if your code needs additional Obsidian APIs.

**Every pull request must keep the test suite green.** If you add new behaviour, add tests for it.

---

## Submitting a Pull Request

1. **Fork** the repository and create your branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```

2. **Make your changes.** Keep commits focused — one logical change per commit.

3. **Add or update tests** as appropriate.

4. **Run the full suite before pushing:**
   ```bash
   npm run build && npm test
   ```

5. **Push and open a PR** against `main`. Fill in the PR template:
   - What does this change and why?
   - Does it introduce any breaking changes?
   - Which issues does it close (use `Closes #123`)?

6. A maintainer will review your PR. Address feedback and push additional commits — do not force-push a branch once a review is in progress.

### PR Checklist

- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] `npm test` passes (all tests green, no new warnings)
- [ ] New functions / behaviours have corresponding tests
- [ ] No new `// @ts-ignore` suppressions without explanation
- [ ] `manifest.json` and `versions.json` updated if this is a version bump

---

## Reporting Bugs

Open a [GitHub issue](https://github.com/tescolopio/Obsidian_PlayerVault/issues/new?template=bug_report.md) and include:

- Obsidian version and platform (Windows / macOS / Linux)
- Player Vault version
- Steps to reproduce
- Expected vs. actual behaviour
- Relevant error messages from the developer console (`Ctrl/Cmd + Shift + I`)

**Security issues** — do **not** open a public issue. See [SECURITY.md](SECURITY.md).

---

## Suggesting Features

Open a [GitHub issue](https://github.com/tescolopio/Obsidian_PlayerVault/issues/new?template=feature_request.md) with:

- The problem you are trying to solve
- Your proposed solution
- Any alternatives you considered

Check the [roadmap](ROADMAP.md) first — your idea may already be planned.

---

## Style Guide

- **TypeScript** — strict mode, no `any` without a comment explaining why
- **Naming** — `camelCase` for variables/functions, `PascalCase` for classes/types
- **Formatting** — 2-space indentation, single quotes, trailing commas (ES5 style)
- **Comments** — prefer self-documenting code; JSDoc on public functions
- **Security** — never emit unsanitised user or note content as raw HTML; use `escapeHtml()` and the placeholder-slot pattern (see [ARCHITECTURE.md](ARCHITECTURE.md))

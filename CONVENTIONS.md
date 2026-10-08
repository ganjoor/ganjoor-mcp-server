# Conventions

House rules for building and maintaining **Ganjoor MCP Server**. Numbered so reviews and commit
messages can cite a rule as §N. Sections are contiguous from §1: the hygiene lint reddens the
build on a gap or a duplicate.

## 1. What this project is (and is not)

Ganjoor MCP Server exposes the read-only Ganjoor Persian poetry API to AI agents via the MCP
protocol. It is a thin, read-only layer over `api.ganjoor.net` — not a substitute for the API
itself, and not a writeable backend.

## 2. Repository layout

| Path | What lives there |
|---|---|
| `src/` | TypeScript source: server, client, types, tools |
| `dist/` | Compiled output (generated, not committed in source) |
| `tests/` | Smoke and shape validation tests |
| `acceptance/` | The repo-standard lint suite |
| `.github/` | CI workflows and generated identity assets |
| `docs/` | Documentation tree |

## 3. Writing voice

Dense, specific, honest. Tables for matrices, prose for reasoning. No marketing language: the
hygiene lint reddens the build on superlatives ("seamless", "world-class", "cutting-edge", …)
and on "simply" (if it were simple, the sentence would not need the word). No unexplained
acronyms on first use. American spelling.

## 4. Versioning and releases

[Semantic versioning](https://semver.org/). Every user-facing change lands a CHANGELOG entry
under `[Unreleased]` in the same PR. Cutting a release renames `[Unreleased]` to the dated
version, bumps the version manifest in the same commit, and opens a fresh `[Unreleased]`. The
lint holds the newest CHANGELOG version and the manifest in lockstep once a first release
exists. Commits follow [Conventional Commits](https://www.conventionalcommits.org/)
(`feat:` / `fix:` / `docs:` / `refactor:` / `test:` / `chore:`).

## 5. Project-meta docs standard (README / CHANGELOG / CONVENTIONS)

The top-level markdown is the repo's front matter, held to a fixed standard by the committed
`acceptance/test-repo-standard.mjs`: the build fails the moment it drifts. Grounded in the
published specs, not invented here:

- **CHANGELOG → [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/).** Under every
  version, the ONLY `###` subsections allowed are the six canonical change categories
  (**Added · Changed · Deprecated · Removed · Fixed · Security**), grouped one heading per
  category per version. `[Unreleased]` stays at the top; concrete versions are
  reverse-chronological, valid semver, newest matching the version manifest. A pulled release
  keeps its section, tagged `[YANKED]` after the date.
- **README → [standard-readme](https://github.com/RichardLitt/standard-readme).** Exactly one
  H1; a short description immediately after it (never a blockquote); **Install**, **Usage**,
  and **Contributing** sections; the **License** section LAST. Two house additions on top of
  the spec: the short description is a **bold tagline**, and a **Caveats**/limitations section
  is required (a standard that ships its limits).
- **CONVENTIONS.** This file's numbered `## N.` sections are contiguous from §1, with no gaps
  and no duplicates.
- **Counts are machine-verified, not trusted.** Any count claim declared in
  `.repo-standard.json` (e.g. "N standing tests") must equal the real repo fact wherever it
  appears, and cross-doc numbers must agree, so a forgotten count reddens the build instead of
  shipping a lie.
- **Voice (§3) extends here.** No marketing superlatives and no "simply" in any meta doc.
- **Stable meta files.** SECURITY, CONTRIBUTING, and CODE_OF_CONDUCT (the
  [Contributor Covenant](https://www.contributor-covenant.org/)) exist and open with an H1.
- **LICENSE is lint-governed too.** A license file exists at the repo root; when its text is a
  recognizable standard license, each JSON manifest the lint reads (the plugin manifest and
  package.json) that declares a license field, and the README's License section, must name the
  same id. What cannot be compared (an unrecognized text, or no manifest license field) is a
  loud named skip, never a silent pass.
- **A secrets file can never become trackable.** The ignore rules cover the whole `.env` family
  before any such file exists, because ignoring a path does nothing about one git already
  tracks, and no negation re-exposes anything but an example file. Declared build output stays
  out of the tree for the same reason: a diff full of generated artifacts is noise hiding
  signal. This is hygiene, not secret scanning; nothing reads file contents.
- **No shadowed meta files.** A governed doc exists in exactly one of `.github/`, the repo
  root, or `docs/`. For README and the community health files GitHub serves only the
  highest-precedence copy, and for every governed doc a second copy is drift the content
  checks cannot see.
- **No unfinished scaffolds.** No `TODO(scaffold)` marker and no unfilled double-braced
  template token survives in a governed doc: the lint reddens on either, so a half-written or
  hand-copied scaffold cannot pass CI while looking done.
- **Generated identity assets.** The README banners and pills are generated from
  `.github/assets/manifest.json`. Edit the manifest and re-run
  `node .github/assets/generate.mjs` to update them; never hand-edit an SVG.

The lint is installed and updated by
[`repo-standard-toolkit`](https://github.com/runverdict/repo-standard-toolkit); this repo owns
the enforcement (the committed lint + CI), the plugin only regenerates it. Repo-specific scope
(which counts are checked, which docs are in play) lives in `.repo-standard.json`.

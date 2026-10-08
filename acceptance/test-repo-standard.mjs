#!/usr/bin/env node
/*
 * test-repo-standard.mjs: the standing guard on this repo's front matter.
 *
 * Installed by the repo-standard-toolkit scaffolder, owned by THIS repo from then on: it runs
 * with Node built-ins alone (no npm install, no network, no AI tool), so the standard stays
 * enforced for every contributor on every push. The frequently-updated top-level markdown
 * (README, CHANGELOG, CONVENTIONS, and friends) is the repo's front matter; left un-linted it
 * drifts (a stale count, an ad-hoc CHANGELOG subsection, marketing creep). This test turns the
 * standard into an ENFORCED schema: the build fails the moment a meta doc drifts.
 *
 * The standards it encodes are published, not invented here:
 *   - CHANGELOG → Keep a Changelog 1.1.0 (keepachangelog.com): the SIX canonical change
 *     categories, grouped, one heading per category per version; [Unreleased] on top; concrete
 *     versions valid semver, newest first, in lockstep with the version manifest once released.
 *   - README → standard-readme (github.com/RichardLitt/standard-readme): one H1, a short
 *     description under 120 chars on its own line (banner/badges may sit between, per the
 *     spec's order), Install + Usage (waivable only by readme.docsOnly, the spec's own
 *     documentation-repository exception), Contributing, the spec's section order, a Table of
 *     Contents once past 100 lines, and License LAST. The tagline being BOLD is this
 *     standard's house addition on top of the spec, not a spec rule.
 *   - CONVENTIONS → contiguous numbered `## N.` sections (no gaps / dups).
 *   - Optional manifest doc → its Totals line MUST equal the table's own row counts.
 *   - Shared → machine-checked COUNTS match the real repo and agree across docs; a
 *     marketing-voice ban; no TODO(scaffold) markers left behind.
 *
 * The CANON above is hardcoded. `.repo-standard.json` (missing file = full defaults) tunes
 * SCOPE (which docs, which counts, extra banned words, extra required README sections) and
 * can disable a whole check only with a stated reason, printed loudly on every run. Unknown
 * config keys are hard errors: nothing here is ever silently ignored. Checks:
 *
 *   RS-config        the config parses, is version 1, and carries no unknown/malformed keys
 *                    (config errors are their own failure CLASS: they exit 2 before any doc
 *                    check runs, so fix the config; doc drift exits 1, so fix the docs).
 *   RS-changelog     Keep a Changelog shape + the six canonical categories, grouped.
 *   RS-lockstep      newest dated CHANGELOG version === the version manifest (dormant pre-release).
 *   RS-readme        standard-readme structure; extra required sections from config.
 *   RS-conventions   numbered `## N.` sections contiguous 1..N (and >= minSections).
 *   RS-manifest      the declared manifest doc's Totals line reconciles with its own rows.
 *   RS-voice         the marketing-voice ban across the meta-doc set (+ extras).
 *   RS-prose         the enterprise writing profile, when a repo declares one: no em dash in
 *                    any form, anywhere the configured reach goes, and no filler or AI-writing
 *                    tells in markdown prose. Opt-in per repo, canon once on (the word lists
 *                    live here; config chooses reach and exemptions). Every file this toolkit
 *                    installs satisfies it, so adopting it never costs an exemption for a file
 *                    the repo did not author.
 *   RS-counts        every declared count claim equals the derived repo fact and agrees across docs.
 *   RS-reflexivity   the CONVENTIONS doc documents the enforced vocabulary (lint ⟺ spec).
 *   RS-stable-docs   the stable meta files exist and open with an H1.
 *   RS-todos         no TODO(scaffold) marker survives in a governed doc.
 *   RS-license       a root license file exists, is non-empty, and (when its text is a
 *                    recognizable standard license) its id agrees with the license field of
 *                    each JSON manifest present (.claude-plugin/plugin.json, package.json)
 *                    and with the README's License section (unrecognized text is a loud named
 *                    skip, never a silent pass).
 *   RS-placeholders  no unfilled {{PLACEHOLDER}} token survives in a governed doc (a
 *                    hand-copied template bypasses fill-template's refusal; this catches it).
 *   RS-shadow        no governed doc exists in more than one GitHub-served location
 *                    (.github/ > root > docs/: GitHub silently serves the highest-precedence
 *                    copy, so a duplicate is served drift the other checks cannot see). README
 *                    is the exception, checked in two locations rather than three, because
 *                    docs/README.md is a directory index rather than a second front page.
 *   RS-assets        the generated README identity, when a repo declares one: every asset
 *                    re-renders byte-identical from its manifest, the front page CARRIES the
 *                    exact generated block (containment, not position) and every declared folder
 *                    README opens with the exact banner H1, every pill value still matches the
 *                    file it was read from unless it declared "source": false with a reason, and
 *                    the palette clears a contrast floor.
 *   RS-index         a directory index, when a repo declares one (any extension, and any number
 *                    of directories, so this is not only a docs check): every file under it is
 *                    catalogued and every catalogued link resolves. Ownership is PER FILE, so a
 *                    declared child bounds its parent over what the child claims rather than over
 *                    its whole directory, one file is never catalogued by two indexes, and a kept
 *                    file no declaration speaks for is named in a skip instead of passing as
 *                    coverage. The (universe) leg checks the SET itself: a path git keeps that
 *                    this file cannot see (a sparse or skip-worktree entry, a name that is not
 *                    valid UTF-8) fails rather than leaving the set in silence, because every
 *                    coverage result is a statement about that set. Statuses and dates are both OFF until declared, each printing a
 *                    named skip while it is off, and a date can be one line for the index or a
 *                    cell per row. Shape and coverage only, never age: the date is a fact the
 *                    repo records, not one this lint compares to today.
 *   RS-about         the GitHub About text a repo recorded still matches the repo's own facts.
 *                    OFFLINE by construction: this reads no network, so it proves the recorded
 *                    values have not gone stale against the README, never that GitHub is
 *                    currently serving them.
 *   RS-ignore        a secrets file can never become trackable (the .env family is ignored and
 *                    no negation re-exposes it), and every declared generated path stays out of
 *                    the tree. Hygiene, not secret scanning: no file CONTENTS are ever read.
 *
 * Freshness is never age-gated: this checks STRUCTURE + CONSISTENCY + machine-verifiable facts,
 * not "is the prose old". Dependency-free: `node acceptance/test-repo-standard.mjs`.
 *
 * One boundary worth stating out loud, because it is the difference between a gate and a
 * theatre: RS-assets imports this repo's own .github/assets/generate.mjs to re-render the
 * artwork. That proves the committed SVGs still follow from the committed manifest, which is
 * the drift anyone actually ships. It cannot prove the generator itself was not forked to
 * render whatever is already there. No committed file can prove that about a sibling it
 * imports; byte-identity of the generator against the published payload is what
 * harness/sense-state.mjs reports on a re-run, exactly as it does for this lint.
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync, statSync, lstatSync, realpathSync, readlinkSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join, dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const CONFIG_PATH = join(ROOT, '.repo-standard.json')

/*
 * WHERE THIS FILE ACTUALLY IS, decided before it decides anything about a repo.
 *
 * Node resolves a script's symlinks before running it, so `import.meta.url` names the file on disk
 * and ROOT is THAT file's repository. Commit this gate as a symlink to a clean copy in another
 * checkout and `node acceptance/test-repo-standard.mjs` audits the other checkout: it printed 29
 * passed on a repo whose own index was missing a row, and every count it printed was about a tree
 * nobody had asked about. `process.argv[1]` is the one place the substitution is visible, because
 * it keeps the path as it was INVOKED.
 *
 * Two legs, and the second is not the first in another spelling. The gate must be a REGULAR FILE
 * at the path it was run from (a symlink is content this repo does not commit at the path it
 * governs), and the repository that path sits in must be the repository ROOT names (a symlinked
 * PARENT DIRECTORY is the same substitution one level up, and lstat on the leaf cannot see it).
 * A checkout reached through a symlinked path is not this: both sides are resolved, so how a repo
 * is ADDRESSED still never changes what is true about it.
 *
 * This is a refusal rather than a failed check on purpose. Every verdict below is a statement
 * about ROOT, and there is nothing honest to say about ROOT while this is unresolved.
 */
const stop = (msg) => { console.error(`repo-standard: ${msg}`); process.exit(2) }
if (process.argv[1]) {
  const invoked = process.argv[1]
  let st = null
  try { st = lstatSync(invoked) } catch { /* named below: an invocation path that is not on disk */ }
  if (st === null) {
    stop(`the path this gate was invoked as (${invoked}) is not on disk, so there is no way to confirm that the file now running is the one committed at it`)
  }
  if (!st.isFile()) {
    stop(`the path this gate was invoked as (${invoked}) is ${st.isSymbolicLink() ? 'a SYMLINK' : 'not a regular file'}. Node resolves a script's symlinks before running it, so this file would audit the tree it points INTO while reporting on the tree it was called from, and a repo whose own index is missing a row goes green by pointing at a clean copy. Commit the gate as a regular file at ${'acceptance/test-repo-standard.mjs'}`)
  }
  let invokedRoot = null
  try { invokedRoot = realpathSync(join(dirname(invoked), '..')) } catch { /* named below */ }
  let rootHere = ROOT
  try { rootHere = realpathSync(ROOT) } catch { /* the plain path is the best there is */ }
  if (invokedRoot !== rootHere) {
    stop(`this gate was invoked from ${invoked}, whose repository resolves to ${invokedRoot ?? '(unresolvable)'}, and the file that is actually running lives in ${rootHere}. Something in the invocation path is a symlink pointing at another checkout, so every verdict below would be about a repository nobody asked about`)
  }
}

// The payload version this lint shipped with, printed on every run so a repo can always answer
// "which lint version governs me?". harness/sense-state.mjs parses this line from BOTH the
// committed copy and the plugin payload to DIRECT a re-run: upgrade (payload newer), downgrade
// (payload older: a stale plugin must never silently replace a newer committed lint), or
// local-edit (same version, different bytes). An acceptance test locks this constant to the
// plugin manifest version; keep the line's exact shape, because the parser matches it literally.
const REPO_STANDARD_LINT_VERSION = '0.8.0'

// ───────────────────────────────────────────────────────────────── the hardcoded canon
const CHANGELOG_CATEGORIES = ['Added', 'Changed', 'Deprecated', 'Removed', 'Fixed', 'Security']
// standard-readme: Install and Usage are "Required by default, optional for documentation
// repositories" (repos without functional code, see readme.docsOnly), Contributing and License
// are always required. The bold tagline is a HOUSE addition, not the spec's (the spec requires
// only a short description on its own line, not starting with "> ").
const README_CANON = ['Install', 'Usage', 'Contributing']
const README_CANON_DOCS_ONLY = ['Contributing']
// the spec's section order; a README's spec-known sections must appear in this relative order.
const README_ORDER = ['Security', 'Background', 'Install', 'Usage', 'API', 'Maintainers', 'Thanks', 'Contributing', 'License']
const BANNED_VOICE = ['simply', 'seamless', 'effortless', 'blazing', 'world-class', 'cutting-edge', 'revolutionary', 'game-chang', 'turnkey', 'best-in-class']
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const CHECK_IDS = ['changelog', 'lockstep', 'readme', 'conventions', 'manifest', 'voice', 'prose', 'counts', 'reflexivity', 'stable-docs', 'todos', 'license', 'placeholders', 'shadow', 'assets', 'ignore', 'index', 'about']

// ── the enterprise writing profile (RS-prose) ────────────────────────────────────────────
// The second layer of the writing standard. RS-voice bans marketing superlatives with no opting
// out; this profile is what a repo opts into when it wants prose that reads as written by a
// person who was paying attention. Both lists are CANON: a repo chooses whether the profile is
// on and how far it reaches, never which rules it contains.
//   "No opting out" is about the RULES, not the reach, and the two are easy to conflate. RS-voice
// sweeps the meta-doc set plus `voice.alsoScan`, which by default leaves the stable docs
// (SECURITY, CONTRIBUTING, CODE_OF_CONDUCT) unswept, so the opt-in profile at `docs` reach
// actually reads FURTHER than the always-on ban. That is deliberate rather than an oversight: the
// stable docs are the ones most often adopted verbatim from somebody else's standard.
//
// Dashes. The em dash is banned in every form, including the HTML escapes that render as one,
// and so is an en dash doing an em dash's job (spaced, as punctuation between clauses). The
// fix is always to rewrite: a colon, a comma, parentheses, or a full stop. An en dash inside a
// numeric range is untouched, because that is what an en dash is for. A double hyphen is NOT
// flagged: every command-line flag in every docs page would trip it, and a detector that cries
// wolf gets disabled, which is worse than not having it.
//
// Every pattern is written with escapes rather than the characters themselves, and the escape
// alternation is split so that no rule's own source text matches it. A detector that fails its
// own file would force the first repo to reach `scan: "all"` into writing an exemption for the
// lint that shipped it, which is not a standard, it is an apology.
const PROSE_DASHES = [
  { label: 'em dash', re: /\u2014/, fix: 'rewrite with a colon, a comma, parentheses, or a full stop' },
  { label: 'em dash escape', re: /&(?:mdash;|#8212;|#[xX]2014;)/, fix: 'the escape renders as an em dash; rewrite the sentence' },
  { label: 'spaced en dash', re: /\s\u2013|\u2013\s/, fix: 'an en dash with a space around it is an em dash wearing a hat; rewrite, or close it up if it is a range' },
]
// Filler and the AI-writing tells, in MARKDOWN PROSE ONLY. The dash rules reach as far as
// prose.scan says; these do not, and the asymmetry is deliberate. In source, `leverageRatio`
// and `utilizeCache` are identifiers rather than register, the file that DECLARES this list
// necessarily contains every word in it, and a rule that fires on both is one people learn to
// switch off. Register is a property of prose, so it is checked where prose lives.
//
// The list is small and deterministic on purpose: every term here is one a careful writer can
// always cut or replace, so a hit is never a judgment call. Terms that would need
// part-of-speech judgment to adjudicate ("leverage" the noun is fine, the verb is not) are
// banned outright and exempted per repo through prose.allow, which prints on every run.
const PROSE_FILLER = ['delve', 'utilize', 'leverage', 'in order to', 'worth noting', 'it should be noted',
  'needless to say', 'as you can see', 'furthermore', 'moreover', 'a wide range of', 'a variety of', 'state-of-the-art']
const PROSE_PROFILES = { enterprise: { dashes: PROSE_DASHES, filler: PROSE_FILLER } }
const PROSE_SCANS = ['docs', 'markdown', 'all']

// ── the identity assets (RS-assets) ──────────────────────────────────────────────────────
// The palette roles the generator renders, and the pairs whose contrast decides whether the
// artwork is readable. A derived palette comes from someone else's design tokens, so the floor
// is enforced rather than assumed: WCAG 2.2 AA for normal text is 4.5:1.
const ASSET_ROLES = ['groundDeep', 'groundMid', 'ground', 'waveNear', 'waveFar', 'text', 'textMuted', 'rim',
  'accent', 'accentAlt', 'accentSoft', 'pillAccentBg', 'pillAccentFg', 'pillAltBg', 'pillAltFg']
const CONTRAST_PAIRS = [['text', 'ground'], ['text', 'groundMid'], ['text', 'groundDeep'],
  ['textMuted', 'ground'], ['textMuted', 'groundMid'], ['accentAlt', 'ground'], ['accentAlt', 'groundMid'],
  ['pillAccentFg', 'pillAccentBg'], ['pillAltFg', 'pillAltBg']]
const CONTRAST_FLOOR = 4.5

// ── the ignore ruleset (RS-ignore) ───────────────────────────────────────────────────────
// The probe set: the .env names that hold real credentials in real repos. `.env` on its own is
// the common half-fix, which is why every variant is probed separately. The example names are
// the only ones a negation may re-expose, because they carry placeholders by convention.
const SECRET_PROBES = ['.env', '.env.local', '.env.production', '.env.development', '.env.test', '.env.staging']
const SECRET_EXAMPLES = ['.env.example', '.env.sample', '.env.template', '.env.defaults']

// ─────────────────────────────────────────────────────────────────────────── runner
let pass = 0, fail = 0, skip = 0
const check = (name, fn) => { try { fn(); pass++; console.log(`  ✓ ${name}`) } catch (e) { fail++; console.log(`  ✗ ${name}\n    ${e.message}`) } }
const skipCheck = (name, why) => { skip++; console.log(`  \u2013 ${name} SKIP (${why})`) }

// a UTF-8 BOM is legal, invisible on GitHub, and the default from several Windows editors, so it
// must never be the reason a compliant doc fails a `^#`-anchored check.
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').replace(/^﻿/, '')
const exists = (rel) => existsSync(join(ROOT, rel))
// markdown with fenced code blocks removed: a `### x` or banned word inside a fence is example
// text, never a heading or a voice violation. CommonMark §4.5: a fence is three-or-more
// backticks OR tildes (the tilde form is how you show a block containing backticks).
const FENCE_LINE = /^\s*(?:```|~~~)/
const stripFences = (text) => text.replace(/^[ \t]*(```|~~~)[\s\S]*?^[ \t]*\1[^\n]*$/gm, '').replace(/^[ \t]*(```|~~~)[\s\S]*$/m, '')
const h2s = (text) => [...text.matchAll(/^## +(.+?)\s*$/gm)].map((m) => m[1])

// minimal glob: literal directory path + one basename with `*` wildcards (e.g.
// `acceptance/test-*.mjs`). No `**`, no directory wildcards; declare deeper counts with
// { file, lineRegex } instead. Deliberately small enough to audit at a glance.
const globCount = (pattern) => {
  const slash = pattern.lastIndexOf('/')
  const dir = slash === -1 ? '.' : pattern.slice(0, slash)
  const base = pattern.slice(slash + 1)
  if (dir.includes('*')) throw new Error(`count glob "${pattern}": only the basename may carry '*'`)
  const re = new RegExp(`^${base.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`)
  const abs = join(ROOT, dir)
  if (!existsSync(abs) || !statSync(abs).isDirectory()) return 0
  return readdirSync(abs).filter((f) => re.test(f) && statSync(join(abs, f)).isFile()).length
}

// ─────────────────────────────────────────────────────────── config: parse + validate
// Keys beginning with "//" are operator comments; "$schema" is an editor hint. Both ignored.
const isComment = (k) => k.startsWith('//') || k === '$schema'
const configErrors = []
const bad = (msg) => configErrors.push(msg)

// VALID JSON IS NOT A CONFIG. `null`, `[]` and `7` all parse, and every one of them reached
// `Object.keys(rawConfig)` below: a file reading `null` took the whole run down with a TypeError
// and no diagnosis at all, which every caller reads as a broken lint rather than a broken config.
// A config error is a failure CLASS this file already has, so it is reported as one.
const rawConfig = exists('.repo-standard.json') ? (() => {
  let parsed
  try { parsed = JSON.parse(read('.repo-standard.json')) } catch (e) { bad(`.repo-standard.json is not valid JSON: ${e.message}`); return {} }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    bad(`.repo-standard.json must be a JSON OBJECT (got ${Array.isArray(parsed) ? 'an array' : JSON.stringify(parsed)}): the config is a set of named keys, and nothing else can carry one`)
    return {}
  }
  return parsed
})() : {}

const KNOWN_TOP = ['version', 'docs', 'manifest', 'versionManifest', 'readme', 'conventions', 'voice', 'prose', 'counts', 'stableDocs', 'checks', 'scaffold', 'assets', 'ignore', 'github']
for (const k of Object.keys(rawConfig)) if (!isComment(k) && !KNOWN_TOP.includes(k)) bad(`unknown top-level key "${k}" (known: ${KNOWN_TOP.join(', ')})`)
if (exists('.repo-standard.json') && !configErrors.some((m) => m.includes('not valid JSON')) && rawConfig.version !== 1) {
  bad(`"version" must be the number 1 (got ${JSON.stringify(rawConfig.version)}): a present config declares its format version`)
}

const sub = (obj, key, known) => {
  const v = obj?.[key]
  if (v === undefined || v === null) return {}
  if (typeof v !== 'object' || Array.isArray(v)) { bad(`"${key}" must be an object`); return {} }
  for (const k of Object.keys(v)) if (!isComment(k) && !known.includes(k)) bad(`unknown key "${key}.${k}" (known: ${known.join(', ')})`)
  return v
}
const strArray = (v, where) => {
  if (v === undefined) return []
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) { bad(`"${where}" must be an array of strings`); return [] }
  return v
}
// ONE PATH CONTRACT, for every path a config hands an engine. An index declared at
// "../outside/README.md" resolved to a sibling directory, was opened and read, and reported a
// PASS: the gate went green by describing a tree it does not govern, and neither engine said a
// word. Absolute paths and backslashes are the same hole in a different spelling, and an empty
// component ("a//b") is a path a shell and a Set disagree about. `assets.dir` already carried
// this guard alone; every other path key was missing it.
//   A leading "./" is ACCEPTED rather than refused. It is a spelling, not an escape, and refusing
// it would fail configs that are already correct for the sake of tidiness. Accepting a spelling
// and then letting it mean something different from the spelling beside it is the worse failure,
// which is what `canonOf` below exists to stop: see the note on the ONE CANONICAL FORM.
//   A CONTROL CHARACTER is refused outright. No filename anyone typed carries a NUL, a newline or
// an escape, every one of them means something to a shell or a terminal, and a path carrying one
// travels through `git`, `execFileSync` and a printed diagnostic before anybody sees it.
const CONTROL_CHAR = /[\u0000-\u001f\u007f]/
const escapesRepo = (p) => p.startsWith('/') || /^[A-Za-z]:/.test(p) || p.includes('\\')
  || CONTROL_CHAR.test(p)
  || p.split('/').some((seg) => seg === '..' || seg === '')
// The SECOND leg, and the one the spelling rule above cannot reach. `escapesRepo` checks how a
// path is WRITTEN; this checks the object that actually gets opened. An in-repo docs/README.md
// that is a symlink to a file in a sibling checkout satisfies every spelling rule, is read, and
// decides a verdict: the gate went green by describing a tree it does not govern, and changing
// the sibling's prose changed this repo's result. A directory in the chain can be the link just
// as easily as the leaf, so the whole resolved path is what gets compared.
const ROOT_REAL = (() => { try { return realpathSync(ROOT) } catch { return ROOT } })()
// Where a path REALLY lands. A dangling symlink throws out of realpath and still points
// somewhere, and where it points is the entire question, so the link is read by hand in that
// case rather than treated as absent.
const realOf = (abs) => {
  try { return realpathSync(abs) } catch { /* missing, or a link with no target */ }
  try {
    const st = lstatSync(abs)
    if (st.isSymbolicLink()) return resolve(dirname(abs), readlinkSync(abs))
  } catch { /* not on disk at all */ }
  return null
}
// A path with nothing on disk anywhere in its chain cannot leak content, so it is absent rather
// than escaped and the spelling rule is the whole check for it.
const escapesOnDisk = (p) => {
  const abs = join(ROOT, p)
  const real = realOf(abs) ?? realOf(dirname(abs))
  if (real === null) return false
  return real !== ROOT_REAL && !real.startsWith(ROOT_REAL + sep)
}
/*
 * ONE contract, and every configured path goes through it. Applied to a key at a time so the
 * message can name the key at fault, because "a path escapes" with no key is a bug report the
 * operator has to go find.
 *
 * IT RETURNS THE CANONICAL PATH, and that is the half the contract was missing.
 *
 * Validating a spelling and then leaving every call site holding the RAW one meant an ACCEPTED
 * spelling could still change what a rule means. "./docs" under docs.declined was canonicalised
 * by the planner and kept raw here, so one engine excused the directory and the other did not.
 * "./lib/two.mjs" under an index's "ignore" was an exclusion there and no exclusion here. And
 * "docs.changelog": "./CHANGELOG.md" stopped matching the CHANGELOG.md git lists, so released
 * history was offered up for mechanical rewriting. Each of those is a config written perfectly
 * legibly, accepted by both engines, and meaning two different things in them.
 *
 * So: judge the bytes the operator wrote, then hand back ONE representation and use nothing else.
 * A refusal returns null, which every call site reads as "this key contributed no path".
 *   MEMOISED on the pair, so the registry sweep below can re-validate a key an individual call
 * site already checked without printing the same refusal twice.
 */
const pathVerdicts = new Map()
const repoPath = (raw, where) => {
  const memo = `${where}\u0000${raw}`
  if (pathVerdicts.has(memo)) return pathVerdicts.get(memo)
  pathVerdicts.set(memo, null) // set first: bad() below must not re-enter and report twice
  const canon = repoPathCheck(raw, where)
  pathVerdicts.set(memo, canon)
  return canon
}
const repoPathCheck = (raw, where) => {
  // A TRAILING slash is a spelling, the same way a leading "./" is: `"generated": ["dist/"]` is
  // how everyone writes a directory, and it denotes exactly what `dist` denotes. It comes off
  // BEFORE the empty-component rule sees it, or every directory written the ordinary way would be
  // refused for an empty last segment. A lone "/" keeps its slash and is still refused as the
  // filesystem root; an INTERIOR empty component ("a//b") is untouched and still refused, because
  // a shell and a Set disagree about what that names.
  const spelled = raw.length > 1 ? (raw.replace(/\/+$/, '') || raw) : raw
  if (escapesRepo(spelled)) {
    bad(`"${where}" must be a repo-relative path that stays inside this repo (got ${JSON.stringify(raw)}): no leading "/", no "..", no backslashes, no empty path components, no control characters. A path that leaves the repo is checked against files this gate does not govern, and it passes by describing them`)
    return null
  }
  // The canonical form, produced only AFTER the spelling has been judged. A normaliser that runs
  // first repairs the very spelling this contract exists to refuse, which is how a decline
  // directory written with a backslash became a valid one in the engine that tidied it up.
  const canon = spelled === '.' ? spelled : spelled.replace(/^\.\//, '')
  if (escapesOnDisk(canon)) {
    bad(`"${where}" is spelled as a repo-relative path (${JSON.stringify(raw)}) and resolves OUTSIDE this repo: something in it is a symlink pointing away. The spelling rule cannot see this, and the file that gets opened is what decides the verdict, so a green build here would be describing a tree this repo does not govern`)
    return null
  }
  return canon
}

const docsCfg = sub(rawConfig, 'docs', ['readme', 'changelog', 'conventions', 'extra', 'index', 'indexes', 'declined', 'ownership'])
const readmeCfg = sub(rawConfig, 'readme', ['requireSections', 'docsOnly'])
const conventionsCfg = sub(rawConfig, 'conventions', ['minSections'])
const voiceCfg = sub(rawConfig, 'voice', ['extraBanned', 'properNouns', 'alsoScan'])
const checksCfg = sub(rawConfig, 'checks', CHECK_IDS)

const DOC = {
  readme: docsCfg.readme ?? 'README.md',
  changelog: docsCfg.changelog ?? 'CHANGELOG.md',
  conventions: docsCfg.conventions ?? 'CONVENTIONS.md',
}
// a non-string path is a CONFIG error (exit 2), not a crash at the first fs call: the ?? default
// only guards absent, never wrong-typed.
for (const k of ['changelog', 'conventions']) {
  if (typeof DOC[k] !== 'string') bad(`"docs.${k}" must be a string path, got ${JSON.stringify(docsCfg[k])}`)
}
// Every governed-doc path, through the one contract, and REPLACED BY WHAT IT RETURNS. These were
// the keys with no guard at all: a `docs.extra` entry naming "../sibling/prose.md" was swept by
// the voice, TODO and placeholder checks, so editing prose in an unrelated checkout changed this
// repo's verdict. Taking the canonical value back is the second half: `docs.changelog` written
// "./CHANGELOG.md" is the same file git lists as "CHANGELOG.md", and while the two spellings sat
// side by side, every rule that compares a config path to a tracked path silently stopped
// matching. The migration offer's released-history guard was one of them.
for (const k of ['readme', 'changelog', 'conventions']) {
  if (typeof DOC[k] === 'string') DOC[k] = repoPath(DOC[k], `docs.${k}`) ?? DOC[k]
}
// anti-decoy: the README the lint checks must be one GitHub actually renders as the front page:
// pointing the check at a stub nobody sees would hollow the standard while staying green.
// Asked of the CANONICAL spelling, so "./README.md" is the front page it obviously is.
if (!['README.md', 'docs/README.md', '.github/README.md'].includes(DOC.readme)) {
  bad(`"docs.readme" must be one of README.md, docs/README.md, .github/README.md (the paths GitHub renders), got "${DOC.readme}"`)
}
const extraDocs = strArray(docsCfg.extra, 'docs.extra').map((p, i) => repoPath(p, `docs.extra[${i}]`)).filter((p) => p !== null)

// manifest: false (the default, meaning no manifest doc) or { file, statuses }
let manifestCfg = rawConfig.manifest ?? false
if (manifestCfg !== false) {
  if (typeof manifestCfg !== 'object' || Array.isArray(manifestCfg)) { bad('"manifest" must be false or an object { file, statuses }'); manifestCfg = false }
  else {
    for (const k of Object.keys(manifestCfg)) if (!isComment(k) && !['file', 'statuses'].includes(k)) bad(`unknown key "manifest.${k}"`)
    if (typeof manifestCfg.file !== 'string') { bad('"manifest.file" must be a string path'); manifestCfg = false }
    else if (repoPath(manifestCfg.file, 'manifest.file') === null) manifestCfg = false
    else if (!Array.isArray(manifestCfg.statuses) || manifestCfg.statuses.length === 0 || manifestCfg.statuses.some((s) => typeof s !== 'string')) { bad('"manifest.statuses" must be a non-empty array of strings'); manifestCfg = false }
    // The canonical spelling replaces the written one, so `manifest.file` compares equal to the
    // path git lists and to the path an index declaration names.
    else manifestCfg = { ...manifestCfg, file: repoPath(manifestCfg.file, 'manifest.file') }
  }
}

// versionManifest: undefined (auto-detect) | false (loud skip) | path to a JSON manifest with
// .version | { file, match } where match's first capture extracts the version.
let versionManifest = rawConfig.versionManifest
if (versionManifest !== undefined && versionManifest !== false && typeof versionManifest !== 'string' && !(typeof versionManifest === 'object' && !Array.isArray(versionManifest) && typeof versionManifest?.file === 'string' && typeof versionManifest?.match === 'string')) {
  bad('"versionManifest" must be false, a path string, or { file, match }')
  versionManifest = false
}
if (typeof versionManifest === 'object' && versionManifest !== null) {
  try { new RegExp(versionManifest.match, 'm') } catch (e) { bad(`"versionManifest.match" does not compile: ${e.message}`) }
  versionManifest = { ...versionManifest, file: repoPath(versionManifest.file, 'versionManifest.file') ?? versionManifest.file }
} else if (typeof versionManifest === 'string') {
  versionManifest = repoPath(versionManifest, 'versionManifest') ?? versionManifest
}

const requireSections = strArray(readmeCfg.requireSections, 'readme.requireSections')
for (const req of requireSections) {
  try { new RegExp(req, 'i') } catch (e) { bad(`"readme.requireSections" entry "${req}" does not compile: ${e.message}`) }
}
// the spec's OWN exception, not a weakening: a documentation repository ("repositories without
// any functional code") may omit Install/Usage. Everything else still applies.
const docsOnly = readmeCfg.docsOnly ?? false
if (typeof docsOnly !== 'boolean') bad('"readme.docsOnly" must be a boolean (true only for a repo with no functional code: standard-readme\'s documentation-repository exception)')
const minSections = conventionsCfg.minSections ?? 1
if (!Number.isInteger(minSections) || minSections < 1) bad('"conventions.minSections" must be an integer >= 1')
const extraBanned = strArray(voiceCfg.extraBanned, 'voice.extraBanned')
const properNouns = strArray(voiceCfg.properNouns, 'voice.properNouns')
const alsoScan = strArray(voiceCfg.alsoScan, 'voice.alsoScan').map((p, i) => repoPath(p, `voice.alsoScan[${i}]`)).filter((p) => p !== null)
const stableDocs = (rawConfig.stableDocs !== undefined ? strArray(rawConfig.stableDocs, 'stableDocs') : ['SECURITY.md', 'CONTRIBUTING.md', 'CODE_OF_CONDUCT.md'])
  .map((p, i) => repoPath(p, `stableDocs[${i}]`)).filter((p) => p !== null)

// prose: false (default, a loud named skip) or { profile, scan, extraBanned, allow, exempt }.
// The profile is opt-in because prose style is a house choice in a way that "your CHANGELOG
// must parse" is not, and because switching it on mid-life reddens a repo's whole back
// catalogue at once. Once on, its word lists are canon: `allow` can lift a single filler term
// with a printed reason, and nothing can lift the dash rules short of disabling the check.
let proseCfg = rawConfig.prose ?? false
if (proseCfg !== false) {
  if (typeof proseCfg !== 'object' || Array.isArray(proseCfg) || proseCfg === null) {
    bad('"prose" must be false or an object { profile, scan, extraBanned, allow, exempt }')
    proseCfg = false
  } else {
    for (const k of Object.keys(proseCfg)) if (!isComment(k) && !['profile', 'scan', 'extraBanned', 'allow', 'exempt'].includes(k)) bad(`unknown key "prose.${k}" (known: profile, scan, extraBanned, allow, exempt)`)
    if (!Object.keys(PROSE_PROFILES).includes(proseCfg.profile)) {
      bad(`"prose.profile" must be one of ${Object.keys(PROSE_PROFILES).join(', ')} (got ${JSON.stringify(proseCfg.profile)})`)
      proseCfg = false
    }
  }
}
// docs (default) = the governed meta-doc set, the prose a stranger actually reads. markdown =
// every .md in the tree. all = every text file, comments and strings included, which is the
// maximalist choice a repo makes about its own source, never a default imposed on one.
const proseScan = (proseCfg && proseCfg.scan !== undefined) ? proseCfg.scan : 'docs'
if (proseCfg && !PROSE_SCANS.includes(proseScan)) bad(`"prose.scan" must be one of ${PROSE_SCANS.join(', ')} (got ${JSON.stringify(proseCfg.scan)})`)
const proseExtra = proseCfg ? strArray(proseCfg.extraBanned, 'prose.extraBanned').map((w) => w.toLowerCase()) : []
const proseAllow = []
if (proseCfg && proseCfg.allow !== undefined) {
  if (!Array.isArray(proseCfg.allow)) bad('"prose.allow" must be an array of { term, why }')
  else for (const [i, a] of proseCfg.allow.entries()) {
    if (typeof a !== 'object' || a === null || Array.isArray(a) || typeof a?.term !== 'string' || !a.term.trim() || typeof a?.why !== 'string' || !a.why.trim()) {
      bad(`"prose.allow[${i}]" must be { "term": "<one of the profile's filler terms>", "why": "<reason, printed on every run>" }`)
    } else if (!PROSE_FILLER.includes(a.term.toLowerCase())) {
      bad(`"prose.allow[${i}].term" ("${a.term}") is not one of the profile's filler terms, so there is nothing to lift. The dash rules can never be allowed away; disable the whole check with a stated reason if that is really the intent`)
    } else proseAllow.push({ term: a.term.toLowerCase(), why: a.why.trim() })
  }
}
const proseExempt = []
if (proseCfg && proseCfg.exempt !== undefined) {
  if (!Array.isArray(proseCfg.exempt)) bad('"prose.exempt" must be an array of { path, why }')
  else for (const [i, e] of proseCfg.exempt.entries()) {
    if (typeof e !== 'object' || e === null || Array.isArray(e) || typeof e?.path !== 'string' || !e.path.trim() || typeof e?.why !== 'string' || !e.why.trim()) {
      bad(`"prose.exempt[${i}]" must be { "path": "<file or directory>", "why": "<reason, printed on every run>" }`)
    } else {
      const canon = repoPath(e.path.trim(), `prose.exempt[${i}].path`)
      if (canon !== null) proseExempt.push({ path: canon, why: e.why.trim() })
    }
  }
}

// docs.index: false (default, a loud named skip) or { file, statuses, requireDate, ignore }.
// The catalog a documentation tree keeps of itself. What it enforces is coverage and shape:
// every doc listed, every listed doc real, every entry carrying a status from the repo's own
// vocabulary and a well-formed date. It never reads the clock. The date is a fact the repo
// RECORDS (a human verified this doc against the code on that day), not one this lint compares
// to today, because a lint whose verdict changes overnight is the calendar-dependent failure
// this toolkit refuses everywhere else. The git-history alternative is worse: a repo handed
// over as a single squashed baseline gives every file the same commit, which is exactly when a
// freshness signal matters most.
//   `statuses` and `requireDate` are both OFF until declared, and each prints a named skip while
// it is off. An index that records no dates is a common and honest shape, so requiring them by
// default would have handed every adopting repo a red check whose only quick fix is to invent
// the dates: the one outcome this check exists to prevent.
//   `docs.index` declares ONE index; `docs.indexes` declares a list, so a repo can hold the same
// standard over `docs/`, `acceptance/`, and anywhere else a directory should explain itself. Both
// spellings normalise to the same list. An index catalogues the directory it lives in, which is
// why `file` must contain a path separator.
//   `extensions` is what makes this more than a docs check: a directory of engines indexes its
// `.mjs` files, not its markdown. It defaults to `[".md"]`, which is the docs case.
//
// STATUS VOCABULARY IS CANON, not scope. The words are the same in every governed repo, because
// a standard whose vocabulary each repo invents is a structure they share and a language they do
// not. A repo with an established vocabulary of its own keeps it on the page by declaring
// `aliases`, which map its words onto the canon: the reader sees REFERENCE, the lint reads
// `reference`, and two repos remain comparable without either being rewritten.
const INDEX_STATUSES = ['active', 'superseded', 'reference', 'design', 'delivered']
const INDEX_RECONCILED = /Reconciled against the code:\s*\**\s*(\d{4}-\d{2}-\d{2})/i
// A date that matches the SHAPE and names no day. `2026-99-99` passed every check here, which
// makes the freshness signal a string that looks like one. Round-tripping through Date is what
// catches February 30th as well as month 99, and it is the whole test: a value that does not
// survive the trip is not a date.
const isRealDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}
//   `retain` is the recorded answer to the one question the planner asks that had nowhere to be
// written down: an index sitting somewhere GitHub does not render when a reader browses the
// directory, with README.md free beside it, is offered a move. "Leave it where it is" was a real
// answer with no durable representation, so the offer came back on every run forever and a
// finished decision was indistinguishable from an ignored one. It carries its reason like every
// other recorded no here.
const INDEX_KEYS = ['file', 'extensions', 'scope', 'statuses', 'aliases', 'ordered', 'requireDate', 'reconciled', 'ignore', 'retain', 'grammar']
// Which TABLE GRAMMAR a page is read under. Spelled out where it is used, further down; declared
// here because the config loop validates it long before the parser needs it.
const INDEX_GRAMMARS = [1, 2]
// What an index OWNS. `recursive` is the default because it is what every already-adopted config
// means, and a default that reddened every existing adopter on upgrade would be a migration
// wearing a bug fix's clothes. `direct` is the model the atlas journey declares on every new
// index: one README per directory, owning the files directly in it, with a declared child index
// forming the boundary. Either way a declared child is a BOUNDARY rather than an overlap.
const INDEX_SCOPES = ['direct', 'recursive']
// How much of the repo the index rules are allowed to stay SILENT about, and the difference
// between the two answers is the difference between a check and a description.
//   `declared` (the default, and what every config written before this key meant) checks the
// files a declaration actually reaches. A directory indexed for .mjs that gains a Dockerfile
// stays green, and the Dockerfile is named in a skip: the operator's extension list is their
// answer, and reddening it would be this standard imposing a scope nobody gave it.
//   `strict` is the contract the atlas pillar is FOR. Every kept file under a declared root is
// owned by exactly one index, excluded by an `ignore` entry, or sitting under a recorded
// decline, and every directory holding kept files that no declaration reaches is a failure
// rather than a silence. Only under this mode is "a file added tomorrow reddens the build" a
// sentence this toolkit can keep. It is opt-in because turning it on is a migration: a repo
// adopts it once its atlas is complete, never as a surprise on upgrade.
const OWNERSHIP_MODES = ['declared', 'strict']
let ownership = 'declared'
if (docsCfg.ownership !== undefined) {
  if (!OWNERSHIP_MODES.includes(docsCfg.ownership)) bad(`"docs.ownership" must be one of ${OWNERSHIP_MODES.join(', ')} (default "declared"): "strict" requires every kept file under a declared index to be owned, ignored, or declined, and fails the build on the ones that are not`)
  else ownership = docsCfg.ownership
}
if (docsCfg.index !== undefined && docsCfg.indexes !== undefined) bad('declare "docs.index" (one) or "docs.indexes" (a list), not both')
const rawIndexes = docsCfg.indexes !== undefined
  ? (Array.isArray(docsCfg.indexes) ? docsCfg.indexes : (bad('"docs.indexes" must be an array of index declarations'), []))
  : (docsCfg.index === undefined || docsCfg.index === false ? [] : [docsCfg.index])
const indexes = []
for (const [i, raw] of rawIndexes.entries()) {
  const at = docsCfg.indexes !== undefined ? `docs.indexes[${i}]` : 'docs.index'
  if (typeof raw !== 'object' || Array.isArray(raw) || raw === null) { bad(`"${at}" must be an object { ${INDEX_KEYS.join(', ')} }`); continue }
  for (const k of Object.keys(raw)) if (!isComment(k) && !INDEX_KEYS.includes(k)) bad(`unknown key "${at}.${k}" (known: ${INDEX_KEYS.join(', ')})`)
  if (typeof raw.file !== 'string' || !raw.file.trim()) { bad(`"${at}.file" must be a string path to the index document`); continue }
  if (!raw.file.includes('/')) { bad(`"${at}.file" must live inside the directory it catalogues (got "${raw.file}")`); continue }
  // THE RAW BYTES, never a trimmed copy. `.trim()` ran BEFORE the contract, so a declaration
  // written "\ndocs/README.md" had its control character removed here and was accepted, while the
  // registry sweep below judged the same key untrimmed and exited 2: one config, two verdicts, in
  // one file. A normaliser that runs first repairs the very spelling the contract exists to refuse,
  // which is the rule the contract's own comment states and this call site was breaking.
  const ixFile = repoPath(raw.file, `${at}.file`)
  if (ixFile === null) continue
  // The canonical spelling from here on. Written "./docs/README.md" this used to be a path that
  // matched no tracked file, no governed doc and no sibling declaration, while reading on the page
  // as exactly the same index the planner had already canonicalised.
  if (!ixFile.includes('/')) { bad(`"${at}.file" must live inside the directory it catalogues (got "${raw.file}")`); continue }
  const exts = raw.extensions === undefined ? ['.md'] : strArray(raw.extensions, `${at}.extensions`)
  if (raw.extensions !== undefined && (exts.length === 0 || exts.some((e) => e !== '*' && !e.startsWith('.')))) bad(`"${at}.extensions" must be a non-empty array of file extensions, each starting with a dot (e.g. [".mjs"]), or ["*"] for every kept file the directory holds. An extension list can never reach a Dockerfile, a Makefile, or an extensionless executable, so "*" is the only selector that promises complete coverage`)
  const aliases = {}
  if (raw.aliases !== undefined) {
    if (typeof raw.aliases !== 'object' || Array.isArray(raw.aliases) || raw.aliases === null) bad(`"${at}.aliases" must be an object mapping this repo's status words onto the canon (${INDEX_STATUSES.join(', ')})`)
    else for (const [word, canon] of Object.entries(raw.aliases)) {
      if (isComment(word)) continue
      if (!INDEX_STATUSES.includes(String(canon))) bad(`"${at}.aliases" maps "${word}" to "${canon}", which is not one of the canon statuses (${INDEX_STATUSES.join(', ')})`)
      else aliases[word.trim()] = String(canon)
    }
  }
  let statuses = null
  if (raw.statuses !== undefined && raw.statuses !== false) {
    const declared = raw.statuses === true ? INDEX_STATUSES : strArray(raw.statuses, `${at}.statuses`)
    if (raw.statuses !== true && (!Array.isArray(raw.statuses) || declared.length === 0)) bad(`"${at}.statuses" must be true (the whole canon) or a non-empty array drawn from it`)
    // Case is presentation, not vocabulary: a page that writes REFERENCE is using the canon word
    // `reference` in the register its table already uses. A genuinely different WORD is what
    // needs an alias. Cell matching further down stays case-sensitive against the declared
    // spelling, so one index cannot drift between `Active` and `ACTIVE`.
    const canonOf = (s) => (INDEX_STATUSES.includes(s.toLowerCase()) ? s.toLowerCase() : null)
    const foreign = declared.filter((s) => !canonOf(s) && !Object.prototype.hasOwnProperty.call(aliases, s))
    if (foreign.length) bad(`"${at}.statuses" lists ${foreign.map((f) => JSON.stringify(f)).join(', ')}, which the canon does not contain. The canon is ${INDEX_STATUSES.join(', ')}, in any case you like. A genuinely different word keeps its place on the page by mapping onto one: "aliases": { ${foreign.map((f) => `${JSON.stringify(f)}: "reference"`).join(', ')} }`)
    else statuses = declared
  }
  if (raw.requireDate !== undefined && typeof raw.requireDate !== 'boolean') bad(`"${at}.requireDate" must be a boolean (it is false until you declare it true, because an index that records no dates is an honest shape)`)
  if (raw.reconciled !== undefined && typeof raw.reconciled !== 'boolean') bad(`"${at}.reconciled" must be a boolean`)
  if (raw.ordered !== undefined && typeof raw.ordered !== 'boolean') bad(`"${at}.ordered" must be a boolean`)
  if (raw.scope !== undefined && !INDEX_SCOPES.includes(raw.scope)) bad(`"${at}.scope" must be one of ${INDEX_SCOPES.join(', ')} (default "recursive"): "direct" means this index owns the files directly in ${raw.file.trim().slice(0, raw.file.trim().lastIndexOf('/'))}/ and a nested directory keeps its own`)
  if (raw.retain !== undefined && (typeof raw.retain !== 'string' || !raw.retain.trim())) bad(`"${at}.retain" must be the reason this index stays where it is rather than moving to the README a reader lands on. A recorded decision with no reason cannot be told apart from an oversight later, which is the whole reason it is recorded`)
  if (raw.grammar !== undefined && !INDEX_GRAMMARS.includes(raw.grammar)) bad(`"${at}.grammar" must be one of ${INDEX_GRAMMARS.join(', ')} (default 1). Version 2 reads the table's HEADER: a catalog row is a body row of a table whose header names a file column, the status is read from the status column, and the date from the column that says when the file was last checked. Version 1 accepts any pipe line and lets any cell answer for anything`)
  indexes.push({
    at,
    grammar: raw.grammar === 2 ? 2 : 1,
    file: ixFile,
    dir: ixFile.slice(0, ixFile.lastIndexOf('/')),
    extensions: exts,
    scope: raw.scope === 'direct' ? 'direct' : 'recursive',
    statuses,
    aliases,
    ordered: raw.ordered === true,
    requireDate: raw.requireDate === true,
    reconciled: raw.reconciled === true,
    // Through the contract, and REPLACED by what it returns. An `ignore` entry written
    // "./lib/vendor" was stripped to "lib/vendor" by the planner and kept raw here, so the same
    // config excused a subtree in one engine and demanded rows for it in the other.
    ignore: strArray(raw.ignore, `${at}.ignore`).map((p, j) => repoPath(p, `${at}.ignore[${j}]`)).filter((p) => p !== null),
    retain: typeof raw.retain === 'string' && raw.retain.trim() ? raw.retain.trim() : null,
  })
}
// Two catalogs of ONE directory means neither is authoritative about the files in it, and the
// coverage rule would demand every file appear in both. A NESTED index is not this: a declared
// child is a boundary its ancestor stops at, which is the whole point of declaring it.
const indexByDir = new Map()
for (const ix of indexes) {
  const prior = indexByDir.get(ix.dir)
  if (prior) bad(`"${ix.at}" and "${prior.at}" both declare an index for ${ix.dir}/ (${ix.file} and ${prior.file}). Two catalogs of one directory means neither is authoritative; keep one, and give a nested directory its own declaration instead`)
  else indexByDir.set(ix.dir, ix)
}
// Directories the operator turned down, recorded so a later run does not ask again. Shaped like
// prose.exempt for the same reason: a rejection carries its reason on the page rather than in
// somebody's memory. This exists at DIRECTORY granularity because the alternative on offer was a
// single repo-wide "never ask about indexes again", which suppresses the candidates that matter
// along with the leaf nobody wants catalogued.
const declinedIndexes = []
if (docsCfg.declined !== undefined) {
  if (!Array.isArray(docsCfg.declined)) bad('"docs.declined" must be an array of { dir, why } objects naming the directories that were offered an index and turned it down')
  else for (const [i, d] of docsCfg.declined.entries()) {
    if (typeof d !== 'object' || d === null || Array.isArray(d)) { bad(`"docs.declined[${i}]" must be an object { dir, why }`); continue }
    for (const k of Object.keys(d)) if (!isComment(k) && !['dir', 'why'].includes(k)) bad(`unknown key "docs.declined[${i}].${k}" (known: dir, why)`)
    if (typeof d.dir !== 'string' || !d.dir.trim()) { bad(`"docs.declined[${i}].dir" must be the directory that was offered an index`); continue }
    // Through the contract, and used as the contract returns it. Written "./lib" the raw spelling
    // was compared against tracked paths that never carry a "./", so a recorded decline excused
    // the directory in the planner and excused nothing here: under strict ownership that is the
    // difference between a green build and a red one, on a config nobody would call wrong.
    // The raw bytes, for the reason "${at}.file" takes them raw: trimming first accepted a decline
    // spelled "\nghost" that the registry sweep below refuses.
    const declinedDir = repoPath(d.dir, `docs.declined[${i}].dir`)
    if (declinedDir === null) continue
    // A decline answers for a DIRECTORY. Handed a file path it quietly excused exactly one file
    // from every ownership rule below, which is an `ignore` entry wearing a decline's clothes and
    // reads on the page as though a whole directory had been decided about.
    // lstat, never stat. A SYMLINK to a directory answers `isDirectory()` through stat, so a
    // decline naming one was accepted as a directory decline and silently excused the symlink
    // itself, which is a kept file that owes a row: an `ignore` entry wearing a decline's clothes,
    // which is the exact substitution the rest of this check exists to refuse.
    if (exists(declinedDir)) {
      const st = lstatSync(join(ROOT, declinedDir))
      if (st.isSymbolicLink()) { bad(`"docs.declined[${i}].dir" is ${JSON.stringify(declinedDir)}, which is a symlink rather than a directory. git keeps a symlink as one FILE, so declining it excuses that file from every ownership rule while reading as a decision about a whole tree; list it under an index's "ignore" if that is what you meant`); continue }
      if (!st.isDirectory()) { bad(`"docs.declined[${i}].dir" is ${JSON.stringify(declinedDir)}, which is a file rather than a directory. A decline records a directory that was offered an index and turned it down; to excuse one file from an index's coverage, list it under that index's "ignore"`); continue }
    }
    if (typeof d.why !== 'string' || !d.why.trim()) bad(`"docs.declined[${i}].why" must say why ${d.dir} keeps no index. A recorded no with no reason is indistinguishable from an oversight, and the next person to read this config is the one who has to tell them apart`)
    declinedIndexes.push({ dir: declinedDir, why: typeof d.why === 'string' ? d.why : null })
  }
  for (const d of declinedIndexes) {
    if (indexByDir.has(d.dir)) bad(`"docs.declined" lists ${d.dir}, which also declares an index. A directory cannot both keep a catalog and have refused one`)
  }
}
// A status cell is matched by the word it BEGINS with, not by the whole cell. A code span
// (`REFERENCE`) is the ordinary markdown idiom, and a qualifier (`ACTIVE` (paused), `DELIVERED`
// v0.7.0) is a repo saying something true about its own document. Both are the declared status
// plus decoration, so surrounding code-span and emphasis marks come off and the match anchors at
// the start. Anchored rather than a containment test on purpose: a Purpose cell that happens to
// use the word "DELIVERED" in a sentence must never stand in for a status nobody set.
const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const undecorate = (c) => c.replace(/^[`*_\s]+/, '').replace(/[`*_\s]+$/, '')
// Match on the words the PAGE carries: the canon words plus whatever this index aliases onto them.
const statusWordsFor = (ix) => (ix.statuses === null ? [] : [...ix.statuses, ...Object.keys(ix.aliases)])
const statusResFor = (ix) => statusWordsFor(ix).map((s) => new RegExp(`^${reEscape(s.trim())}([^A-Za-z0-9-]|$)`))

// assets: false (default) or { dir, coverage }. The manifest and the generator are fixed
// filenames inside that directory, because a generator that does not sit beside the manifest
// it renders is a puzzle for the next maintainer, not a configuration win.
let assetsCfg = rawConfig.assets ?? false
if (assetsCfg !== false) {
  if (typeof assetsCfg !== 'object' || Array.isArray(assetsCfg) || assetsCfg === null) {
    bad('"assets" must be false or an object { dir, coverage }')
    assetsCfg = false
  } else {
    for (const k of Object.keys(assetsCfg)) if (!isComment(k) && !['dir', 'coverage'].includes(k)) bad(`unknown key "assets.${k}" (known: dir, coverage)`)
    if (assetsCfg.dir !== undefined && (typeof assetsCfg.dir !== 'string' || !assetsCfg.dir.trim())) bad('"assets.dir" must be a directory path relative to the repo root')
    // Was the one key that carried a containment guard, and it carried its OWN: a hand-rolled
    // pair of rules that missed backslashes, drive letters, empty components and every symlink.
    // Now it goes through the same contract as every other path, so there is one rule to keep
    // true rather than two that drift.
    else if (typeof assetsCfg.dir === 'string') assetsCfg = { ...assetsCfg, dir: repoPath(assetsCfg.dir, 'assets.dir') ?? assetsCfg.dir.replace(/\/+$/, '') }
    if (assetsCfg.coverage !== undefined) {
      const c = assetsCfg.coverage
      if (typeof c !== 'object' || Array.isArray(c) || c === null) bad('"assets.coverage" must be an object { roots, ignore }')
      else {
        for (const k of Object.keys(c)) if (!isComment(k) && !['roots', 'ignore'].includes(k)) bad(`unknown key "assets.coverage.${k}" (known: roots, ignore)`)
        strArray(c.roots, 'assets.coverage.roots')
        strArray(c.ignore, 'assets.coverage.ignore')
      }
    }
  }
}
const assetsDir = (assetsCfg && typeof assetsCfg.dir === 'string' ? assetsCfg.dir : '.github/assets').replace(/\/+$/, '')
const assetsManifestPath = `${assetsDir}/manifest.json`
const assetsGeneratorPath = `${assetsDir}/generate.mjs`
// "." is the natural way to say "every top-level directory", so it becomes the empty prefix
// rather than a "./src" that matches nothing a manifest would declare. Everything else goes
// through the ONE contract and is used exactly as it comes back, so a root and an exclusion mean
// the same thing here, in the planner, and in the manifest they are compared against.
// Raw bytes into the contract, the same as every other path key: a coverage exclusion written with
// a leading control character was trimmed into validity here and refused by the registry sweep.
const normRoot = (r, where) => (r.trim() === '.' || r.trim() === '' ? '' : repoPath(r, where))
const coverageRoots = assetsCfg && assetsCfg.coverage ? strArray(assetsCfg.coverage.roots, 'assets.coverage.roots').map((r, i) => normRoot(r, `assets.coverage.roots[${i}]`)).filter((r) => r !== null) : []
const coverageIgnore = assetsCfg && assetsCfg.coverage ? strArray(assetsCfg.coverage.ignore, 'assets.coverage.ignore').map((r, i) => normRoot(r, `assets.coverage.ignore[${i}]`)).filter((r) => r !== null) : []

// github: what a repo recorded about its own GitHub About panel, so the panel cannot rot in
// silence. The panel itself lives on someone else's server, and this lint has no network by
// design, so what is checked is that the RECORDED description still matches the repo's own
// front-page tagline. Edit the tagline and the recorded About goes stale, loudly, with a
// re-sync as the fix. That is the honest half of the property; the other half, whether GitHub
// is serving it right now, belongs to the skill that can actually ask.
const githubCfg = sub(rawConfig, 'github', ['about'])
let aboutCfg = githubCfg.about ?? false
if (aboutCfg !== false) {
  if (typeof aboutCfg !== 'object' || Array.isArray(aboutCfg) || aboutCfg === null) {
    bad('"github.about" must be false or an object { description, homepage, topics }')
    aboutCfg = false
  } else {
    for (const k of Object.keys(aboutCfg)) if (!isComment(k) && !['description', 'homepage', 'topics'].includes(k)) bad(`unknown key "github.about.${k}" (known: description, homepage, topics)`)
    if (typeof aboutCfg.description !== 'string' || !aboutCfg.description.trim()) { bad('"github.about.description" must be the one-line description this repo synced'); aboutCfg = false }
    else if (aboutCfg.description.length > 350) bad(`"github.about.description" is ${aboutCfg.description.length} characters; GitHub truncates the About panel at 350`)
    // homepage is optional, and null reads as absent: a repo that publishes no homepage of its
    // own is the ordinary case, and the engine that derives this block emits null for it. Only
    // RS-about's description leg is ever re-checked; homepage and topics are recorded provenance.
    if (aboutCfg && aboutCfg.homepage != null && (typeof aboutCfg.homepage !== 'string' || !aboutCfg.homepage.trim())) bad('"github.about.homepage" must be a non-empty URL string, or omitted if this repo publishes no homepage of its own')
    if (aboutCfg) {
      const topics = strArray(aboutCfg.topics, 'github.about.topics')
      if (topics.length > 20) bad(`"github.about.topics" lists ${topics.length}; GitHub accepts at most 20`)
      for (const topic of topics) {
        if (!/^[a-z0-9][a-z0-9-]{0,49}$/.test(topic)) bad(`"github.about.topics" entry "${topic}" is not a valid GitHub topic (lower-case, digits and hyphens, 50 characters at most, and it cannot start with a hyphen)`)
      }
    }
  }
}

// ignore: the trust ruleset's scope. The .env leg is canon and needs no configuration; what a
// repo declares here is which of its own generated paths must stay out of the tree, and which
// example filenames a negation is allowed to re-expose.
const ignoreCfg = sub(rawConfig, 'ignore', ['file', 'generated', 'allowExamples'])
let ignoreFile = ignoreCfg.file ?? '.gitignore'
if (typeof ignoreFile !== 'string' || !ignoreFile.trim()) bad(`"ignore.file" must be a string path (got ${JSON.stringify(ignoreCfg.file)})`)
else ignoreFile = repoPath(ignoreFile, 'ignore.file') ?? ignoreFile
// Canonical for MATCHING, raw for the MESSAGE. `"dist/"` and `"dist"` are the same directory and
// used to be two different prefixes to the tracked-file leg; but a diagnostic that renames the
// operator's own config value makes them go looking for a line they never wrote.
const ignoreGenerated = strArray(ignoreCfg.generated, 'ignore.generated')
  .map((g, i) => ({ raw: g, path: repoPath(g, `ignore.generated[${i}]`) }))
  .filter((g) => g.path !== null)
const ignoreAllowExamples = strArray(ignoreCfg.allowExamples, 'ignore.allowExamples')
for (const name of ignoreAllowExamples) {
  if (!/^\.env(\.[^/]+)?$/.test(name)) bad(`"ignore.allowExamples" entry "${name}" is not a .env-family filename: this list widens the set of example files a negation may re-expose, and nothing else`)
}

// counts: object keyed by stable id →
//   { pattern, docs?, glob? | file+lineRegex?, under?, minMentions? }
// `under` restricts the scan to the region below the first heading whose text matches it (to the
// next heading of the same or higher level), so a historical number in an old CHANGELOG release
// block stays historical instead of failing forever once the live count moves on.
const countsCfg = rawConfig.counts ?? {}
const counts = []
if (typeof countsCfg !== 'object' || Array.isArray(countsCfg)) bad('"counts" must be an object keyed by count id')
else {
  for (const [id, spec] of Object.entries(countsCfg)) {
    if (isComment(id)) continue
    if (typeof spec !== 'object' || Array.isArray(spec)) { bad(`"counts.${id}" must be an object`); continue }
    for (const k of Object.keys(spec)) if (!isComment(k) && !['pattern', 'docs', 'glob', 'file', 'lineRegex', 'under', 'minMentions'].includes(k)) bad(`unknown key "counts.${id}.${k}"`)
    if (typeof spec.pattern !== 'string') { bad(`"counts.${id}.pattern" is required (a regex with one capture group for the number)`); continue }
    let re
    try { re = new RegExp(spec.pattern, 'g') } catch (e) { bad(`"counts.${id}.pattern" does not compile: ${e.message}`); continue }
    // the alternation trick: /pattern|/ matches '' with every group present-but-undefined,
    // so the match-array length counts the capture groups without parsing the regex.
    if (new RegExp(spec.pattern + '|').exec('').length - 1 < 1) { bad(`"counts.${id}.pattern" needs a capture group for the number (group 1 is compared)`); continue }
    const hasGlob = spec.glob !== undefined, hasFile = spec.file !== undefined || spec.lineRegex !== undefined
    if (hasGlob && hasFile) { bad(`"counts.${id}" declares both glob and file/lineRegex; pick one source`); continue }
    if ((spec.file === undefined) !== (spec.lineRegex === undefined)) { bad(`"counts.${id}" needs both file and lineRegex, or neither`); continue }
    // validate every sibling HERE, so a malformed one is a config error (exit 2) rather than an
    // exception surfacing later as a doc-drift failure (exit 1) and blaming the wrong file.
    // A glob's DIRECTORY part is a traversed path; the basename is a pattern, never a path. The
    // canonical directory is spliced back onto the pattern, so `./acceptance/test-*.mjs` globs the
    // same directory `acceptance/test-*.mjs` does.
    let globSpec = spec.glob
    if (spec.glob !== undefined && typeof spec.glob !== 'string') { bad(`"counts.${id}.glob" must be a string pattern`); continue }
    else if (typeof spec.glob === 'string') {
      const cut = spec.glob.lastIndexOf('/')
      const dirCanon = repoPath(cut === -1 ? '.' : (spec.glob.slice(0, cut) || '/'), `counts.${id}.glob`)
      if (dirCanon === null) continue
      globSpec = dirCanon === '.' || dirCanon === '' ? spec.glob.slice(cut + 1) : `${dirCanon}/${spec.glob.slice(cut + 1)}`
    }
    if (spec.file !== undefined && typeof spec.file !== 'string') { bad(`"counts.${id}.file" must be a string path`); continue }
    const fileCanon = typeof spec.file === 'string' ? repoPath(spec.file, `counts.${id}.file`) : undefined
    if (typeof spec.file === 'string' && fileCanon === null) continue
    if (spec.lineRegex !== undefined) {
      if (typeof spec.lineRegex !== 'string') { bad(`"counts.${id}.lineRegex" must be a regex string`); continue }
      try { new RegExp(spec.lineRegex, 'gm') } catch (e) { bad(`"counts.${id}.lineRegex" does not compile: ${e.message}`); continue }
    }
    if (spec.minMentions !== undefined && (!Number.isInteger(spec.minMentions) || spec.minMentions < 1)) bad(`"counts.${id}.minMentions" must be an integer >= 1`)
    let underRe = null
    if (spec.under !== undefined) {
      if (typeof spec.under !== 'string') { bad(`"counts.${id}.under" must be a regex string over heading text`); continue }
      try { underRe = new RegExp(spec.under) } catch (e) { bad(`"counts.${id}.under" does not compile: ${e.message}`); continue }
    }
    counts.push({
      id,
      pattern: re,
      docs: spec.docs !== undefined ? strArray(spec.docs, `counts.${id}.docs`).map((p, i) => repoPath(p, `counts.${id}.docs[${i}]`)).filter((p) => p !== null) : null,
      glob: globSpec,
      file: fileCanon,
      lineRegex: spec.lineRegex,
      under: underRe,
      minMentions: spec.minMentions,
    })
  }
}

// scaffold: provenance the scaffold skill records: which plugin version produced this repo's
// governance and the operator's confirmed answers, so a re-run pre-fills instead of re-asking
// and "which standard version governs this repo?" is answerable from the repo alone. The lint
// validates only the SHAPE; it never acts on the content, so enforcement stays version-blind.
const scaffoldCfg = sub(rawConfig, 'scaffold', ['pluginVersion', 'answers'])
if (scaffoldCfg.pluginVersion !== undefined && !(typeof scaffoldCfg.pluginVersion === 'string' && SEMVER.test(scaffoldCfg.pluginVersion))) {
  bad(`"scaffold.pluginVersion" must be a semver string, got ${JSON.stringify(scaffoldCfg.pluginVersion)}`)
}
if (scaffoldCfg.answers !== undefined) {
  if (typeof scaffoldCfg.answers !== 'object' || Array.isArray(scaffoldCfg.answers) || scaffoldCfg.answers === null) bad('"scaffold.answers" must be an object of PLACEHOLDER → value strings')
  else for (const [k, v] of Object.entries(scaffoldCfg.answers)) {
    if (isComment(k)) continue
    if (!/^[A-Z0-9_]+$/.test(k)) bad(`"scaffold.answers.${k}": keys are template placeholder names ([A-Z0-9_]+)`)
    else if (typeof v !== 'string') bad(`"scaffold.answers.${k}" must be a string`)
  }
}

/*
 * THE PATH REGISTRY: every path this config can hand a check, enumerated in one place.
 *
 * The containment contract was arrived at one key at a time, and that is why it kept leaking:
 * each new key was a new place to remember a rule, and `versionManifest`, `ignore.file`,
 * `ignore.generated`, `assets.coverage.roots`, `prose.exempt[].path` and `counts.*.docs` were
 * each read, walked or globbed OUTSIDE the repo while the gate reported green about a tree it
 * does not govern. Adding a seventh isolated call would have left the eighth.
 *
 * So the table is the rule. Every entry names the key (for the message) and yields the path AS
 * WRITTEN, before any trim, `posix()` or trailing-slash strip: a normaliser that runs first can
 * repair a spelling this contract exists to refuse, which is exactly how one engine accepted
 * `docs.declined[].dir: "ghost\dir"` and the other refused it. Spelling first, then containment.
 *
 * A key whose own call site already validated it is listed here anyway. The check is memoised, so
 * the duplicate costs one Map lookup and buys the property that matters: this list, not the call
 * sites, is what "every configured path" means, and a standing test walks it.
 */
const CONFIG_PATH_KEYS = () => {
  const out = []
  const one = (where, v) => { if (typeof v === 'string') out.push({ where, raw: v }) }
  const many = (where, v) => { if (Array.isArray(v)) v.forEach((x, i) => one(`${where}[${i}]`, x)) }
  one('docs.readme', docsCfg.readme)
  one('docs.changelog', docsCfg.changelog)
  one('docs.conventions', docsCfg.conventions)
  many('docs.extra', docsCfg.extra)
  if (Array.isArray(docsCfg.declined)) docsCfg.declined.forEach((d, i) => one(`docs.declined[${i}].dir`, d?.dir))
  for (const [i, ix] of rawIndexes.entries()) {
    const at = docsCfg.indexes !== undefined ? `docs.indexes[${i}]` : 'docs.index'
    if (typeof ix !== 'object' || ix === null || Array.isArray(ix)) continue
    one(`${at}.file`, ix.file)
    many(`${at}.ignore`, ix.ignore)
  }
  // Read from rawConfig, never from the parsed value: the parsed one now carries the CANONICAL
  // path, and a registry that swept canonical paths would be checking a spelling the operator
  // never wrote. Spelling first is the whole property this table exists to hold.
  if (rawConfig.manifest && typeof rawConfig.manifest === 'object' && !Array.isArray(rawConfig.manifest)) one('manifest.file', rawConfig.manifest.file)
  one('versionManifest', typeof rawConfig.versionManifest === 'string' ? rawConfig.versionManifest : undefined)
  if (rawConfig.versionManifest && typeof rawConfig.versionManifest === 'object' && !Array.isArray(rawConfig.versionManifest)) one('versionManifest.file', rawConfig.versionManifest.file)
  many('voice.alsoScan', voiceCfg.alsoScan)
  many('stableDocs', rawConfig.stableDocs)
  if (proseCfg && Array.isArray(proseCfg.exempt)) proseCfg.exempt.forEach((e, i) => one(`prose.exempt[${i}].path`, e?.path))
  if (rawConfig.assets && typeof rawConfig.assets === 'object' && !Array.isArray(rawConfig.assets)) {
    one('assets.dir', rawConfig.assets.dir)
    if (rawConfig.assets.coverage && typeof rawConfig.assets.coverage === 'object' && !Array.isArray(rawConfig.assets.coverage)) {
      many('assets.coverage.roots', rawConfig.assets.coverage.roots)
      many('assets.coverage.ignore', rawConfig.assets.coverage.ignore)
    }
  }
  one('ignore.file', ignoreCfg.file)
  many('ignore.generated', ignoreCfg.generated)
  if (typeof countsCfg === 'object' && !Array.isArray(countsCfg)) {
    for (const [id, spec] of Object.entries(countsCfg)) {
      if (isComment(id) || typeof spec !== 'object' || spec === null || Array.isArray(spec)) continue
      one(`counts.${id}.file`, spec.file)
      many(`counts.${id}.docs`, spec.docs)
      // A glob's DIRECTORY part is the traversed path; the basename is a pattern, never a path.
      if (typeof spec.glob === 'string') one(`counts.${id}.glob`, spec.glob.slice(0, spec.glob.lastIndexOf('/') + 1).replace(/\/$/, '') || '.')
    }
  }
  return out
}
for (const { where, raw } of CONFIG_PATH_KEYS()) {
  // "." and "" are the repo root written two ways, and both are inside it by definition.
  if (raw === '.' || raw === '') continue
  // The trailing-slash and leading-"./" spellings are handled inside the contract now, so the
  // sweep hands over the bytes the operator wrote and nothing tidies them on the way.
  repoPath(raw, where)
}

// checks.<id>: only { enabled: false, why: "<non-empty>" } is meaningful; anything else is an error.
const disabled = {}
for (const [id, v] of Object.entries(checksCfg)) {
  if (isComment(id)) continue
  if (typeof v !== 'object' || Array.isArray(v) || v.enabled !== false || typeof v.why !== 'string' || !v.why.trim()) {
    bad(`"checks.${id}" must be { "enabled": false, "why": "<non-empty reason>" } is required: a check is on by default and cannot be silently weakened`)
    continue
  }
  disabled[id] = v.why.trim()
}

// the meta-doc set: the frequently-updated docs the voice ban and count scans sweep.
const metaDocs = [DOC.readme, DOC.changelog, DOC.conventions, ...(manifestCfg ? [manifestCfg.file] : []), ...extraDocs]
// The pages a prose sweep reaches by name. RS-index requires every declared index to be one of
// them, because an index nobody sweeps is the one page in its directory that can rot invisibly.
const governedDocs = new Set(metaDocs)
// A CONFIG error, and it used to be asserted inside the RS-index check, which made it exit 1
// here and exit 2 in the planner: the one exit-class divergence the exhaustive differential
// table found once the two engines agreed on everything else. It belongs in this class on the
// merits, not only for parity: the fix is an edit to .repo-standard.json, and exit 2 against
// exit 1 is precisely how this lint tells the operator which file to open.
for (const ix of indexes) {
  if (!governedDocs.has(ix.file)) {
    bad(`"${ix.at}.file" is ${ix.file}, which no prose sweep governs. Add it to "docs.extra" so the voice, TODO, and placeholder checks reach it: an index nobody sweeps is the one page in the directory that can rot in a way no check here would see`)
  }
}

console.log(`repo-standard standing test v${REPO_STANDARD_LINT_VERSION} (config: ${exists('.repo-standard.json') ? '.repo-standard.json' : 'defaults, no .repo-standard.json'})`)
for (const [id, why] of Object.entries(disabled)) if (CHECK_IDS.includes(id)) console.log(`  ! ${id} is DISABLED in config: ${why}`)
for (const noun of properNouns) console.log(`  ! voice exemption active (properNouns): "${noun}"`)
// Every exception this standard grants is printed on every run. Visibility is the whole price
// of being allowed one, and an exemption nobody sees is just a rule quietly deleted.
if (proseCfg) console.log(`  · prose profile "${proseCfg.profile}" active, scanning ${proseScan}`)
for (const a of proseAllow) console.log(`  ! prose allowance active: "${a.term}" is permitted here (${a.why})`)
for (const e of proseExempt) console.log(`  ! prose exemption active: ${e.path} (${e.why})`)
for (const n of ignoreAllowExamples) console.log(`  ! ignore allowance active: ${n} may be re-exposed by a negation`)

// config errors are their own failure class: report every one, then exit 2 WITHOUT running the
// doc checks, because a doc verdict computed under a broken config would be noise, and exit 2 vs 1
// tells the operator which file to fix (.repo-standard.json vs the docs).
if (configErrors.length) {
  console.log(`  ✗ RS-config the config parses, is version 1, and carries no unknown or malformed keys`)
  for (const e of configErrors) console.log(`      - ${e}`)
  console.log(`\nconfig errors: ${configErrors.length}. Fix .repo-standard.json (exit 2; doc checks not run)`)
  process.exit(2)
}
check('RS-config the config parses, is version 1, and carries no unknown or malformed keys', () => {})

const gate = (id, name, fn) => {
  if (disabled[id]) return skipCheck(`RS-${id}`, `disabled in config: ${disabled[id]}`)
  check(name, fn)
}

// ─────────────────────────────────────────────────────────────────────── RS-changelog
const clRaw = exists(DOC.changelog) ? read(DOC.changelog) : null
const clHeadings = clRaw ? [...stripFences(clRaw).matchAll(/^##\s+\[([^\]]+)\]/gm)].map((m) => m[1]) : []
const clVersions = clHeadings.filter((h) => h.toLowerCase() !== 'unreleased')

gate('changelog', `RS-changelog ${DOC.changelog} follows Keep a Changelog: [Unreleased] + the six categories, grouped`, () => {
  assert.ok(clRaw !== null, `${DOC.changelog} must exist`)
  const cl = stripFences(clRaw)
  assert.match(cl, /^#\s+Changelog/m, `${DOC.changelog} must open with a top-level "# Changelog" title`)
  assert.match(cl, /keepachangelog\.com/i, `${DOC.changelog} must name the Keep a Changelog format it follows`)
  assert.ok(clHeadings.some((h) => h.toLowerCase() === 'unreleased'), `${DOC.changelog} must carry an [Unreleased] section`)
  assert.equal(clHeadings[0]?.toLowerCase(), 'unreleased', `${DOC.changelog}: [Unreleased] must be the FIRST version heading (Keep a Changelog: "Keep an Unreleased section at the top"), but found [${clHeadings[0]}] first`)
  // every H2 is a `## [token]` heading (Keep a Changelog has no other H2 vocabulary), and
  // every DATED version displays its ISO release date (spec: "Release dates must be displayed")
  for (const m of cl.matchAll(/^## +(.+?)\s*$/gm)) {
    assert.match(m[1], /^\[[^\]]+\]/, `${DOC.changelog} H2 "## ${m[1]}" is not a version heading; Keep a Changelog allows only "## [Unreleased]" / "## [x.y.z] - YYYY-MM-DD"`)
    if (!/^\[unreleased\]/i.test(m[1])) {
      // the optional trailing [YANKED] tag is the spec's own vocabulary for a pulled release,
      // "## [0.0.5] - 2014-12-13 [YANKED]", and ONLY that tag: any other suffix is drift.
      assert.match(m[1], /^\[[^\]]+\]\s+[-\u2013\u2014]\s+\d{4}-\d{2}-\d{2}(?:\s+\[YANKED\])?$/, `${DOC.changelog} version heading "## ${m[1]}" must display its ISO release date: "## [x.y.z] - YYYY-MM-DD" (Keep a Changelog; a pulled release appends " [YANKED]", nothing else)`)
    }
  }
  for (const v of clVersions) assert.match(v, SEMVER, `version heading "[${v}]" is not valid semver`)
  assert.equal(new Set(clVersions).size, clVersions.length, `${DOC.changelog} repeats a version heading; one section per version (Keep a Changelog)`)
  // descending order, per semver §11: compare the numeric triple, then a prerelease is OLDER
  // than its release, then compare prerelease identifiers left to right (numeric numerically,
  // alphanumeric by ASCII, numeric < alphanumeric, and a longer identifier list wins a tie):
  // an rc.1 / rc.9 / beta.1 chain is exactly where changelog ordering drifts.
  const cmpPre = (a, b) => {
    const ia = a.split('.'), ib = b.split('.')
    for (let i = 0; i < Math.max(ia.length, ib.length); i++) {
      if (ia[i] === undefined) return -1
      if (ib[i] === undefined) return 1
      const na = /^\d+$/.test(ia[i]), nb = /^\d+$/.test(ib[i])
      if (na && nb) { const d = Number(ia[i]) - Number(ib[i]); if (d) return d < 0 ? -1 : 1; continue }
      if (na !== nb) return na ? -1 : 1
      if (ia[i] !== ib[i]) return ia[i] < ib[i] ? -1 : 1
    }
    return 0
  }
  const cmp = (a, b) => {
    const pa = a.split('-')[0].split('.').map(Number), pb = b.split('-')[0].split('.').map(Number)
    for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i]
    const preA = a.includes('-'), preB = b.includes('-')
    if (preA !== preB) return preA ? -1 : 1
    if (!preA) return 0
    return cmpPre(a.slice(a.indexOf('-') + 1), b.slice(b.indexOf('-') + 1))
  }
  for (let i = 1; i < clVersions.length; i++) assert.ok(cmp(clVersions[i - 1], clVersions[i]) >= 0, `versions must descend (newest first): [${clVersions[i - 1]}] appears before [${clVersions[i]}]`)
  // the six canonical categories, grouped, one heading per category per version block,
  // and NOTHING deeper: Keep a Changelog's vocabulary is ## versions + ### categories, so an
  // ad-hoc `#### Breaking Changes` is the same drift one level down.
  for (const block of cl.split(/^## /m).slice(1)) {
    const heading = block.split('\n', 1)[0].trim()
    const seen = new Set()
    for (const m of block.matchAll(/^(#{3,6}) +(.+?)\s*$/gm)) {
      assert.equal(m[1], '###', `section "${heading}" has a "${m[1]} ${m[2]}" heading; Keep a Changelog allows only ### category subsections under a version`)
      const c = m[2].trim()
      assert.ok(CHANGELOG_CATEGORIES.includes(c), `section "${heading}" has a non-canonical subsection "### ${c}"; use only ${CHANGELOG_CATEGORIES.join(' / ')} (Keep a Changelog)`)
      assert.ok(!seen.has(c), `section "${heading}" repeats "### ${c}"; group all ${c} entries under one heading`)
      seen.add(c)
    }
  }
  // anti-decoy: config may relocate the changelog, but a root CHANGELOG.md must then not exist:
  // a pristine configured copy must not shadow the file contributors actually open.
  if (DOC.changelog !== 'CHANGELOG.md') {
    assert.ok(!exists('CHANGELOG.md'), `docs.changelog points at ${DOC.changelog} but a root CHANGELOG.md also exists; one changelog only, and the root copy would shadow the governed one`)
  }
})

// ──────────────────────────────────────────────────────────────────────── RS-lockstep
const lockstepPath = versionManifest === false ? null
  : typeof versionManifest === 'string' ? versionManifest
  : typeof versionManifest === 'object' && versionManifest !== null ? versionManifest.file
  : ['.claude-plugin/plugin.json', 'package.json'].find((p) => exists(p)) ?? null

if (lockstepPath === null) {
  skipCheck('RS-lockstep', versionManifest === false
    ? 'disabled: "versionManifest" is false in config'
    : 'no version manifest found (auto-detect looks for .claude-plugin/plugin.json, package.json); set "versionManifest" to a path, or false to silence')
} else gate('lockstep', `RS-lockstep newest dated CHANGELOG version === ${lockstepPath} (dormant pre-release)`, () => {
  assert.ok(exists(lockstepPath), `versionManifest "${lockstepPath}" does not exist`)
  let manifestVersion
  if (typeof versionManifest === 'object' && versionManifest !== null) {
    const m = read(lockstepPath).match(new RegExp(versionManifest.match, 'm'))
    assert.ok(m && m[1], `versionManifest.match "${versionManifest.match}" captured no version from ${lockstepPath}`)
    manifestVersion = m[1]
  } else {
    manifestVersion = JSON.parse(read(lockstepPath)).version
  }
  assert.match(String(manifestVersion), SEMVER, `${lockstepPath} version "${manifestVersion}" is not valid semver`)
  if (clVersions.length === 0) return // pre-first-release: the lockstep engages at the first dated version
  assert.equal(clVersions[0], manifestVersion, `newest CHANGELOG version [${clVersions[0]}] must equal ${lockstepPath} version ${manifestVersion}; bump both in lockstep when cutting a release`)
})

// ────────────────────────────────────────────────────────────────────────── RS-readme
gate('readme', `RS-readme ${DOC.readme} structure: one H1, bold tagline, Install + Usage + Contributing in spec order, a Contents past 100 lines, License LAST`, () => {
  assert.ok(exists(DOC.readme), `${DOC.readme} must exist`)
  // HTML comments come out alongside fences: a maintainer note renders as nothing, so it can
  // hold neither a hidden heading nor the short description.
  const rm = stripFences(read(DOC.readme)).replace(/<!--[\s\S]*?-->/g, '')
  // setext headings would let content render as a heading this ATX-based lint cannot see, so
  // require ATX so what the lint checks is what GitHub renders. ('='-underline is unambiguous;
  // the '-' form is left alone: it collides with tables and frontmatter.)
  const lines = rm.split('\n')
  lines.forEach((l, i) => {
    if (/^=+\s*$/.test(l) && i > 0 && lines[i - 1].trim()) throw new Error(`${DOC.readme}:${i + 1} uses a setext ('=' underline) heading: use ATX (#) headings, because the lint and the standard read ATX only`)
  })
  const h1sFound = [...rm.matchAll(/^# +.+$/gm)]
  assert.equal(h1sFound.length, 1, `${DOC.readme} must have exactly one H1 (found ${h1sFound.length})`)
  // standard-readme's order is Title → Banner (optional) → Badges (optional) → Short
  // Description, so image/badge lines between the H1 and the description are CANONICAL; skip
  // them rather than mistaking one for the description.
  // the banner/badge run between the Title and the Short Description: badge links, images, and
  // the HTML wrappers the centered-banner idiom uses (`<p align="center">` … `</p>`).
  const isBadgeOrBanner = (l) => /^\[!\[.*\]\(.*\)\]\(.*\)$/.test(l) || /^!\[.*\]\(.*\)$/.test(l)
    || /^(\[!\[|!\[).*(\)|\])\s*(\[!\[|!\[).*$/.test(l) || /^<\/?[a-z][^>]*>$/i.test(l) || /^<img\s/.test(l)
  const afterH1 = rm.slice(h1sFound[0].index + h1sFound[0][0].length).split('\n').map((l) => l.trim())
    .filter((l) => l && !isBadgeOrBanner(l))[0] || ''
  // The spec requires a short description on its own line that does not start with "> ".
  // The BOLD is this standard's own house addition on top of the spec (a tagline should read
  // as one), documented as such rather than attributed to standard-readme.
  assert.ok(!afterH1.startsWith('>'), `${DOC.readme}: the short description under the H1 must not be a blockquote (standard-readme). Found: "${afterH1.slice(0, 60)}"`)
  assert.ok(afterH1.startsWith('**'), `${DOC.readme} needs a bold tagline (the short description) right after the H1: a house addition on top of standard-readme (found: "${afterH1.slice(0, 60)}")`)
  // standard-readme: "Must be less than 120 characters." Measured on the description itself,
  // not the `**` bold markers this standard adds around it.
  const descLen = afterH1.replace(/^\*\*|\*\*$/g, '').length
  assert.ok(descLen < 120, `${DOC.readme}: the short description must be less than 120 characters (standard-readme). Found ${descLen}`)
  const sections = h2s(rm)
  assert.ok(sections.length > 0, `${DOC.readme} must have H2 sections`)
  const canon = docsOnly ? README_CANON_DOCS_ONLY : README_CANON
  for (const req of canon) assert.ok(sections.some((s) => new RegExp(`^${req}`, 'i').test(s)), `${DOC.readme} must have a ${req} section (standard-readme)${req === 'Usage' || req === 'Install' ? ' (or set readme.docsOnly if this repo has no functional code)' : ''}`)
  // the spec: "Sections must appear in order given below." The spec-known sections a README
  // does carry must be in the spec's relative order (unknown/extra sections are free).
  const known = sections.map((s) => README_ORDER.findIndex((k) => new RegExp(`^${k}`, 'i').test(s))).filter((i) => i !== -1)
  for (let i = 1; i < known.length; i++) {
    assert.ok(known[i] >= known[i - 1], `${DOC.readme}: "${README_ORDER[known[i]]}" appears after "${README_ORDER[known[i - 1]]}" : standard-readme fixes the section order (${README_ORDER.join(' → ')})`)
  }
  // the spec: a Table of Contents is required once a README passes 100 lines.
  if (read(DOC.readme).split('\n').length >= 100) {
    assert.ok(sections.some((s) => /table of contents|^contents$/i.test(s)), `${DOC.readme} is ${read(DOC.readme).split('\n').length} lines, and standard-readme requires a Table of Contents on any README of 100+ lines`)
  }
  for (const req of requireSections) {
    let re
    try { re = new RegExp(req, 'i') } catch (e) { throw new Error(`readme.requireSections entry "${req}" does not compile: ${e.message}`) }
    assert.ok(sections.some((s) => re.test(s)), `${DOC.readme} is missing a required section matching /${req}/i (readme.requireSections)`)
  }
  assert.match(sections[sections.length - 1], /license/i, `${DOC.readme}: the License section must be LAST (standard-readme). Found "${sections[sections.length - 1]}"`)
  // the License section must SAY something: a bare heading is not a license statement.
  const licenseBody = rm.slice(rm.lastIndexOf(`## ${sections[sections.length - 1]}`)).split('\n').slice(1).join('\n')
  assert.ok(licenseBody.trim().length > 0, `${DOC.readme}: the License section is empty; state the license (e.g. "Apache-2.0 © <holder>. See LICENSE.")`)
})

// ─────────────────────────────────────────────────────────────────── RS-conventions
gate('conventions', `RS-conventions ${DOC.conventions} numbered \`## N.\` sections are contiguous 1..N`, () => {
  assert.ok(exists(DOC.conventions), `${DOC.conventions} must exist`)
  if (DOC.conventions !== 'CONVENTIONS.md') {
    assert.ok(!exists('CONVENTIONS.md'), `docs.conventions points at ${DOC.conventions} but a root CONVENTIONS.md also exists; one conventions doc only, and the root copy would shadow the governed one`)
  }
  const nums = [...stripFences(read(DOC.conventions)).matchAll(/^## +(\d+)\. /gm)].map((m) => Number(m[1]))
  assert.ok(nums.length >= minSections, `${DOC.conventions} must carry at least ${minSections} numbered \`## N.\` section${minSections === 1 ? '' : 's'} (found ${nums.length})`)
  nums.forEach((n, i) => assert.equal(n, i + 1, `${DOC.conventions} numbering breaks at §${n} (expected §${i + 1}); sections must be contiguous, with no gaps or duplicates`))
})

// ─────────────────────────────────────────────────────────────────────── RS-manifest
if (!manifestCfg) {
  if (!disabled.manifest) skipCheck('RS-manifest', 'no manifest doc declared in config')
  else skipCheck('RS-manifest', `disabled in config: ${disabled.manifest}`)
} else gate('manifest', `RS-manifest ${manifestCfg.file} Totals line reconciles with the table's own row counts`, () => {
  assert.ok(exists(manifestCfg.file), `${manifestCfg.file} must exist (declared as "manifest.file")`)
  const cm = read(manifestCfg.file)
  const statuses = manifestCfg.statuses
  // the Totals line, "**A S1 · B S2 · … · T total.**", is built from the declared status vocabulary
  const totalsRe = new RegExp(`Totals:\\s*\\*\\*${statuses.map((s) => `(\\d[\\d,]*) ${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).join(' · ')} · (\\d[\\d,]*) total\\.\\*\\*`)
  const m = cm.match(totalsRe)
  assert.ok(m, `${manifestCfg.file} must carry a \`Totals: **${statuses.map((s) => `A ${s}`).join(' · ')} · T total.**\` line matching its declared statuses`)
  const nums = m.slice(1).map((n) => Number(n.replace(/,/g, '')))
  const total = nums.pop()
  // only TABLE rows count: a line must start with '|' to be a row, because prose that happens to
  // contain "| NEW |" mid-sentence is not inventory. Cells are compared parsed-and-trimmed, so
  // a column-aligned table (`| NEW       |`, what every markdown formatter emits, and what
  // GitHub renders identically) counts the same as a compact one.
  const rowLines = cm.split('\n').filter((l) => l.trimStart().startsWith('|'))
  const cellsOf = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
  let sum = 0
  statuses.forEach((s, i) => {
    const rows = rowLines.filter((l) => cellsOf(l).includes(s)).length
    assert.equal(nums[i], rows, `Totals says ${nums[i]} ${s} but the table has ${rows} \`${s}\` rows`)
    sum += rows
  })
  assert.equal(total, sum, `Totals total ${total} != the row sum ${sum}`)
})

// ────────────────────────────────────────────────────────────────────────── RS-voice
gate('voice', 'RS-voice the marketing-voice ban holds across the meta-doc set', () => {
  const banned = [...BANNED_VOICE, ...extraBanned.map((w) => w.toLowerCase())]
  for (const doc of [...metaDocs, ...alsoScan]) {
    if (!exists(doc)) continue // presence is each structural check's job; voice scans what exists
    let inFence = false
    read(doc).split('\n').forEach((line, i) => {
      if (FENCE_LINE.test(line)) { inFence = !inFence; return }
      if (inFence) return
      // strip quoted / backticked spans: a doc may NAME a banned word ("no \"simply\"")
      // without USING it; a real marketing use is unquoted prose. Single quotes strip only
      // when both delimiters sit outside words, so the apostrophes in "it's ... you'd" can
      // never swallow the prose between them.
      let bare = line
        .replace(/"[^"]*"|`[^`]*`/g, '')
        .replace(/(?<![A-Za-z0-9])'[^']*'(?![A-Za-z0-9])/g, '')
      // properNouns: an exact, case-sensitive product/proper name (a tool literally called
      // "Seamless") is a mention, not marketing voice; each active exemption prints in the
      // run header so it can never hide.
      for (const noun of properNouns) bare = bare.split(noun).join('')
      for (const word of banned) {
        // hyphenated terms match their spaced/hyphenated variants alike: "world-class",
        // "world class", and "world  class" are the same marketing voice.
        const safe = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/-/g, '[\\s-]+')
        assert.ok(!new RegExp(`\\b${safe}`, 'i').test(bare), `${doc}:${i + 1} uses banned marketing voice "${word}": ${line.trim().slice(0, 70)}`)
      }
    })
  }
})

// ────────────────────────────────────────────────────────────────────────── RS-prose
// A bounded walk of the tree, used by the wider prose scans. The structural exclusions are not
// configurable because none of them is a judgment call: .git is not content, node_modules is
// not this repo's writing, a binary file has no prose to check, and the generated asset
// directory is machine output that RS-assets already governs byte for byte. Everything else a
// repo wants excluded goes through prose.exempt, which prints its reason on every run.
const WALK_SKIP_DIRS = new Set(['.git', 'node_modules'])
const walkFiles = (rel = '') => {
  const abs = rel ? join(ROOT, rel) : ROOT
  let entries
  try { entries = readdirSync(abs, { withFileTypes: true }) } catch { return [] }
  return entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)).flatMap((e) => {
    const child = rel ? `${rel}/${e.name}` : e.name
    if (e.isDirectory()) return WALK_SKIP_DIRS.has(e.name) ? [] : walkFiles(child)
    return e.isFile() ? [child] : []
  })
}
// What owes an INDEX ROW is what the repo actually keeps, which is not the same as what happens
// to be sitting on the disk. A build directory, a virtualenv, a vendored tree: none of them are
// files anyone should have to describe, and demanding rows for them is how an honest adopter
// concludes the check is unusable and switches it off. Git already knows the difference.
//   `git rev-parse --show-toplevel` walks UP to find a repo, so a tree nested inside an
// unrelated checkout would otherwise inherit that repo's file list. Only trust git when the
// worktree it finds IS this one.
//   When git cannot answer, NOTHING is excluded and the filesystem walk stands. That direction is
// deliberate: the fallback demands more rows, never fewer, so a missing git can make RS-index
// noisier but it can never let a gap through. The coverage failure names which universe it used,
// so a check that is green on a checkout and red on a source export explains itself rather than
// looking arbitrary.
//   The listing is NUL-DELIMITED and read as BYTES. Without -z git C-quotes any path outside
// plain ASCII, so docs/café.md comes back as "docs/caf\303\251.md" with the quotes as literal
// characters, and a newline in a filename is indistinguishable from a record separator. Reading
// the result as a utf8 STRING was the second half of the same defect: a byte sequence that is not
// valid UTF-8 decodes to U+FFFD, which names no file on disk, so the path failed its lstat and
// left the universe entirely. A check that quietly narrows its own input is worse than one that
// fails, so nothing is dropped here without a reason that survives to the output.
//
// FAIL CLOSED, and the two things a listing hands back that are not files to read:
//   a GITLINK, one index entry standing in for another repository's whole content. Read from the
//     index (mode 160000) rather than guessed from what is on disk, because an uninitialised
//     submodule and a tracked file somebody deleted look identical to lstat.
//   an UNTRACKED path that vanished between two git calls, which nothing claims exists.
//
// A STAGED DELETION needs no rule at all, and believing it did is what put the third one here.
// `git rm` removes the path from the index, so it is already absent from `--cached` and never
// reaches this loop: a repo mid-`git rm` is quiet because the path is gone, not because anything
// excused it. What `git ls-files --deleted` actually reports is "tracked, and not in the
// worktree", which is the ORDINARY UNSTAGED DELETION as well: a plain `rm` of a tracked file
// leaves it in the index and off the disk. Subtracting that set therefore excused exactly the
// case this check exists for. An uncatalogued tracked file failed the build; `rm` on it, with no
// commit, no stage, no anything, turned the build green. The measured pair was 1/1 to 0/0 in both
// engines, from a `rm` a contributor makes without thinking about it.
//
// So the subtraction is gone. Every cached, non-gitlink path that lstat cannot find is NAMED and
// FAILS, whether it is missing because somebody deleted it without staging the removal or because
// a sparse or skip-worktree checkout is hiding it. Both are the same fact about the set this
// check measures: git tracks a file, and this file cannot see it.
//   This is an operational compatibility change, and a deliberate one. A tree with an unstaged
// deletion in it now fails RS-index (universe) where it used to pass, and the fix is the one the
// message names: stage the removal, or restore the file.
const universeErrors = []
// The submodule directories, kept rather than merely skipped, because ONE policy has to hold
// across the pillars. A gitlink is another repository's whole content: RS-index excludes it from
// the coverage universe (nobody should have to write a row for a tree they do not own), and
// RS-assets coverage used to walk straight into it and demand a banner entry and a folder README
// from it. One pillar said the directory is not ours and the other said it owes us a page, on the
// same directory, in the same run. It is not ours: neither pillar governs a submodule.
const gitlinkDirs = new Set()
const gitRun = (args) => execFileSync('git', args, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] })
// Records split on the NUL byte itself, never on a decoded string, so a name survives the split
// exactly as git wrote it. latin1 is the byte-preserving round trip used for COMPARING two
// listings; utf8 is only used where a real filename is needed.
const nulRecords = (buf) => {
  const out = []
  let start = 0
  for (let i = 0; i < buf.length; i++) if (buf[i] === 0) { if (i > start) out.push(buf.subarray(start, i)); start = i + 1 }
  if (start < buf.length) out.push(buf.subarray(start))
  return out
}
const decodeName = (rec) => {
  const s = rec.toString('utf8')
  return Buffer.from(s, 'utf8').equals(rec) ? s : null
}
const gitKept = (() => {
  try {
    // Compared through realpath on BOTH sides. `rev-parse --show-toplevel` hands back the resolved
    // worktree, so a checkout reached through a symlinked path compared unequal to its own repo
    // and this check silently fell back to the filesystem walk: the gate then demanded rows for
    // every build directory git would have excluded, on the same tree, purely because of how it
    // was addressed. ROOT_REAL is the same resolution the path contract already runs on.
    const top = gitRun(['rev-parse', '--show-toplevel']).toString('utf8').trim()
    if ((realOf(top) ?? resolve(top)) !== ROOT_REAL) return null
    const listed = nulRecords(gitRun(['ls-files', '-z', '--cached', '--others', '--exclude-standard']))
    // One call answers both "what is in the index" and "which of those are gitlinks". The record
    // is `<mode> <object> <stage>\t<path>`, and the tab is found by BYTE so a path git never
    // decoded cleanly still splits in the right place.
    const cached = new Set(), gitlinks = new Set()
    for (const rec of nulRecords(gitRun(['ls-files', '-z', '--stage']))) {
      const tab = rec.indexOf(0x09)
      if (tab < 0) continue
      const path = rec.subarray(tab + 1).toString('latin1')
      cached.add(path)
      if (rec.subarray(0, 7).toString('latin1') === '160000 ') {
        gitlinks.add(path)
        const name = decodeName(rec.subarray(tab + 1))
        if (name !== null) gitlinkDirs.add(name)
      }
    }
    const kept = []
    for (const rec of listed) {
      const raw = rec.toString('latin1')
      if (gitlinks.has(raw)) continue
      const name = decodeName(rec)
      if (name === null) {
        universeErrors.push({ path: rec.toString('utf8'), why: 'git tracks this path and its name is not valid UTF-8. No markdown link can name it, so no row can catalogue it and no coverage rule can be held over it. Rename the file' })
        continue
      }
      let st = null
      try { st = lstatSync(join(ROOT, name)) } catch { /* absent: judged immediately below */ }
      // WHAT THE PATH IS NOW, against what git says it is. The whole listing used to be filtered
      // by one question, "does lstat call this a directory", and a yes was silently dropped: a
      // TRACKED, uncatalogued blob replaced by a DIRECTORY at the same path went from a red build
      // to a green one, because the file the index still carries stopped being a file on disk.
      //   An UNTRACKED directory in the listing is the ordinary case that rule was written for:
      // `ls-files --others` reports a nested repository as `dir/`, and nothing in the index claims
      // it is a blob. That one is still skipped, and it is the ONLY one that is.
      if (st !== null && st.isDirectory()) {
        if (!cached.has(raw)) continue
        universeErrors.push({ path: name, why: 'git has this path in the index as a FILE (it is not a submodule), and a directory is sitting at it on disk. The blob git tracks cannot be read, catalogued, or held to any coverage rule while a directory occupies its name: stage what actually happened here, or restore the file' })
        continue
      }
      if (st === null) {
        if (!cached.has(raw)) continue
        universeErrors.push({ path: name, why: 'git tracks this path, it is not a submodule, and it is not on disk. Either it was deleted without the removal being staged (git rm records it, and then the path leaves the index and this check with it), or a sparse or skip-worktree checkout is hiding it. Until one of those is true it is still tracked and still owes a row, and dropping it here is how a file goes from a red build to a green one by being deleted' })
        continue
      }
      kept.push(name)
    }
    return new Set(kept)
  } catch { return null }
})()
const INDEX_UNIVERSE = gitKept
  ? 'git: tracked files plus pending ones git does not ignore'
  : 'the filesystem, because git could not list this tree, so nothing is excluded and every file on disk owes a row'
// The index universe counts SYMLINKS, which the prose walk above deliberately does not. git
// tracks a symlink as a file and a reader browsing the directory sees one, so it owes a row; a
// walk built on Dirent.isFile() yields neither a file nor a directory for one and dropped it out
// of coverage with nothing said. It is never FOLLOWED here: reading through a link would describe
// its target twice, and a link to a directory would walk forever.
const walkKept = (rel = '') => {
  const abs = rel ? join(ROOT, rel) : ROOT
  let entries
  try { entries = readdirSync(abs, { withFileTypes: true }) } catch { return [] }
  return entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)).flatMap((e) => {
    const child = rel ? `${rel}/${e.name}` : e.name
    if (e.isDirectory()) return WALK_SKIP_DIRS.has(e.name) ? [] : walkKept(child)
    return e.isFile() || e.isSymbolicLink() ? [child] : []
  })
}
const keptFiles = gitKept ? [...gitKept].sort() : walkKept()
const indexUniverse = (rel) => keptFiles.filter((f) => f === rel || f.startsWith(`${rel}/`))

// A NUL byte in the first 8 KiB is the same heuristic git itself uses to call a file binary.
const looksBinary = (rel) => {
  try { return readFileSync(join(ROOT, rel)).subarray(0, 8192).includes(0) } catch { return true }
}
const underPath = (file, prefix) => file === prefix || file.startsWith(`${prefix}/`)
const proseExemptedBy = (file) => proseExempt.find((e) => underPath(file, e.path)) ?? null
const dirOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '')

// ONE OWNER PER FILE, and the owner is a DECLARATION rather than a directory.
//   A declared child index used to bound its ancestor at the whole child directory. That threw
// away the only thing which says what the child is authoritative about, which is the child's own
// declaration: a parent speaking for .json and a child speaking for .md left every .json under
// the child owned by nobody, catalogued by nobody, and green in both tables and the gate. The
// boundary is real, but it is a boundary over the files the child CLAIMS, not over its floor
// plan.
//   So the owner of a file is the DEEPEST declaration that actually claims it. Two declarations
// for one directory are refused in config above, so a tie is unreachable.
const declaredIndexFiles = new Set(indexes.map((ix) => ix.file))
const claims = (ix, f) => (ix.scope === 'direct' ? dirOf(f) === ix.dir : underPath(f, ix.dir))
  // An index is a declaration, not content. Its own directory does not catalogue it, and neither
  // does an ancestor: a nested index is a directory's front page, and requiring the parent to
  // carry a row for it would mean declaring a child index reddens the parent that contains it.
  && !declaredIndexFiles.has(f)
  // `*` is the only selector that can promise a directory is completely covered. An extension
  // list can never reach Dockerfile, Makefile, or an extensionless executable, and a repo that
  // wanted every file described had no way to say so.
  && (ix.extensions.includes('*') || ix.extensions.some((e) => f.endsWith(e)))
  && !ix.ignore.some((i) => underPath(f, i))
const ownerOf = (f) => {
  let best = null
  for (const ix of indexes) if (claims(ix, f) && (!best || ix.dir.length > best.dir.length)) best = ix
  return best
}

// licensee's filename family, most conventional first: a repo licensed via COPYING (the GPL
// convention) or LICENSE.md is licensed, not license-less. Resolved here because two checks
// need it, RS-license to govern it and RS-prose to leave it alone.
const LICENSE_CANDIDATES = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'LICENCE', 'LICENCE.md', 'LICENCE.txt', 'COPYING', 'COPYING.md', 'COPYING.txt', 'UNLICENSE']
const licenseFile = LICENSE_CANDIDATES.find((f) => exists(f)) ?? null

const proseTargets = () => {
  const set = proseScan === 'docs'
    ? [...new Set([...metaDocs, ...stableDocs])].filter((f) => exists(f))
    : walkFiles().filter((f) => (proseScan === 'markdown' ? f.endsWith('.md') : !looksBinary(f)))
  // The license text is never swept: it is a legal instrument reproduced verbatim, and
  // "rewrite that sentence" is not an option a repo has. Generated output is skipped for the
  // mirror-image reason, that rewriting it would be undone by the next regenerate.
  return set.filter((f) => f !== licenseFile
    && !proseExemptedBy(f)
    && !(assetsCfg && underPath(f, assetsDir))
    && !ignoreGenerated.some((g) => underPath(f, g.path)))
}

if (!proseCfg) {
  if (!disabled.prose) skipCheck('RS-prose', 'no writing profile declared ("prose": false); the marketing-voice ban (RS-voice) still applies, and setting "prose" opts into the enterprise profile')
  else skipCheck('RS-prose', `disabled in config: ${disabled.prose}`)
} else gate('prose', `RS-prose the ${proseCfg.profile} writing profile holds across ${proseScan} (no em dash anywhere it reaches, no filler in markdown prose)`, () => {
  const profile = PROSE_PROFILES[proseCfg.profile]
  const allowed = new Set(proseAllow.map((a) => a.term))
  const filler = [...profile.filler.filter((t) => !allowed.has(t)), ...proseExtra]
  const targets = proseTargets()
  assert.ok(targets.length > 0, `the ${proseScan} prose scan matched no files, and a profile that reads nothing proves nothing`)
  for (const doc of targets) {
    // Markdown gets the same mention-versus-use exemptions the voice ban uses: a fence is
    // example text and a quoted or backticked span is a NAMING of a term, not a use of it
    // (this standard's own docs list every banned term). Any other file type is scanned raw,
    // because in source code a quote is syntax rather than a quotation.
    const isMarkdown = doc.endsWith('.md')
    let text = read(doc)
    // A released CHANGELOG section is a record of what shipped, not live prose. Rewriting it to
    // satisfy a profile adopted later would falsify the history the file exists to preserve, so
    // the scan stops at the first dated version and everything above it stays governed.
    if (doc === DOC.changelog) {
      const firstDated = [...text.matchAll(/^## +\[[^\]]+\]/gm)].find((m) => !/^## +\[unreleased\]/i.test(m[0]))
      if (firstDated) text = text.slice(0, firstDated.index)
    }
    // Scannable lines are kept POSITIONALLY: a fenced or exempt line becomes an empty line
    // rather than disappearing, so line numbers in the failure message are the real ones.
    const source = text.split('\n')
    let inFence = false
    const bareLines = source.map((line) => {
      if (isMarkdown) {
        if (FENCE_LINE.test(line)) { inFence = !inFence; return '' }
        if (inFence) return ''
        return line.replace(/"[^"]*"|`[^`]*`/g, '').replace(/(?<![A-Za-z0-9])'[^']*'(?![A-Za-z0-9])/g, '')
      }
      return line
    })
    bareLines.forEach((bare, i) => {
      for (const rule of profile.dashes) {
        assert.ok(!rule.re.test(bare), `${doc}:${i + 1} uses an ${rule.label}: ${rule.fix}\n      ${source[i].trim().slice(0, 90)}`)
      }
    })
    // Filler is a register rule, so it applies to markdown prose and stops there (see the list's
    // own note). Multi-word terms are matched across the whole document, because a hard-wrapped
    // paragraph splits a phrase over two lines and a per-line scan would never see it. A quoted
    // mention wraps the same way, so the same pass blanks quoted and backticked spans that cross
    // a line break, replacing them with spaces rather than removing them: line numbers in the
    // failure message have to keep pointing at the real line.
    if (!isMarkdown) continue
    const joined = bareLines.join('\n').replace(/"[^"]*"|`[^`]*`/g, (m) => m.replace(/[^\n]/g, ' '))
    const lineOf = (index) => joined.slice(0, index).split('\n').length
    for (const term of filler) {
      const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/-/g, '[\\s-]+').replace(/ /g, '\\s+')
      const hit = new RegExp(`\\b${safe}`, 'i').exec(joined)
      assert.ok(!hit, hit ? `${doc}:${lineOf(hit.index)} uses banned filler "${term}": ${source[lineOf(hit.index) - 1].trim().slice(0, 70)}` : '')
    }
  }
})

// ────────────────────────────────────────────────────────────────────────── RS-counts
if (counts.length === 0) {
  if (!disabled.counts) skipCheck('RS-counts', '0 counts declared in config; declare each machine-checkable numeric claim')
  else skipCheck('RS-counts', `disabled in config: ${disabled.counts}`)
} else gate('counts', `RS-counts ${counts.length === 1 ? 'the 1 declared count claim matches the repo and agrees' : `all ${counts.length} declared count claims match the repo and agree`} across docs`, () => {
  for (const c of counts) {
    let truth = null
    if (c.glob !== undefined) truth = globCount(c.glob)
    else if (c.file !== undefined) {
      assert.ok(exists(c.file), `counts.${c.id}: source file ${c.file} does not exist`)
      truth = (read(c.file).match(new RegExp(c.lineRegex, 'gm')) || []).length
    }
    const scanDocs = c.docs ?? metaDocs
    const found = []
    for (const doc of scanDocs) {
      assert.ok(exists(doc), `counts.${c.id}: doc ${doc} does not exist`)
      let text = stripFences(read(doc))
      if (c.under) {
        // scan only the region below the first heading whose TEXT matches `under`, up to the
        // next heading of the same or higher level, so historical numbers outside it stay history.
        const headings = [...text.matchAll(/^(#{1,6}) +(.+?)\s*$/gm)]
        const start = headings.find((h) => c.under.test(h[2]))
        if (!start) { continue } // region absent in this doc → no mentions here, not an error
        const level = start[1].length
        const end = headings.find((h) => h.index > start.index && h[1].length <= level)
        text = text.slice(start.index, end ? end.index : undefined)
      }
      for (const m of text.matchAll(new RegExp(c.pattern.source, 'g'))) {
        const n = Number(String(m[1]).replace(/,/g, ''))
        assert.ok(Number.isFinite(n), `counts.${c.id}: pattern matched "${m[0]}" in ${doc} but captured no number`)
        found.push({ doc, n, text: m[0] })
      }
    }
    if (truth !== null) for (const f of found) assert.ok(f.n === truth, `counts.${c.id}: ${f.doc} states "${f.text}" but the repo derives ${truth}`)
    const distinct = [...new Set(found.map((f) => f.n))]
    assert.ok(distinct.length <= 1, `counts.${c.id}: the number disagrees across docs (${found.map((f) => `${f.doc}: ${f.n}`).join(' vs ')}); update every mention together`)
    if (c.minMentions) assert.ok(found.length >= c.minMentions, `counts.${c.id}: stated ${found.length} time(s) but minMentions is ${c.minMentions}`)
  }
})

// ─────────────────────────────────────────────────────────────────── RS-reflexivity
gate('reflexivity', `RS-reflexivity ${DOC.conventions} documents the enforced vocabulary (lint ⟺ spec)`, () => {
  assert.ok(exists(DOC.conventions), `${DOC.conventions} must exist`)
  const conv = read(DOC.conventions)
  for (const c of CHANGELOG_CATEGORIES) assert.ok(conv.includes(c), `${DOC.conventions} must document the CHANGELOG category "${c}"`)
  for (const s of [...(docsOnly ? README_CANON_DOCS_ONLY : README_CANON), 'License']) assert.ok(conv.includes(s), `${DOC.conventions} must document the required README section "${s}"`)
  assert.ok(/keepachangelog|Keep a Changelog/i.test(conv), `${DOC.conventions} must cite the Keep a Changelog standard`)
  assert.ok(/standard-readme/i.test(conv), `${DOC.conventions} must cite the standard-readme standard`)
  for (const w of extraBanned) assert.ok(conv.toLowerCase().includes(w.toLowerCase()), `${DOC.conventions} must document the extra banned voice term "${w}" (config cannot grow rules the written standard does not carry)`)
  // The same rule one layer up: a repo that switches the writing profile on is holding its
  // contributors to a list of terms, so the list has to be written down where they will read
  // it. Naming a term in backticks is a mention, which is exactly how it should appear.
  if (proseCfg) {
    assert.match(conv, /em[\s-]dash/i, `${DOC.conventions} must document the em dash rule: the "${proseCfg.profile}" writing profile is active, and a rule contributors cannot read is a rule they will keep breaking`)
    for (const t of [...PROSE_PROFILES[proseCfg.profile].filler, ...proseExtra]) {
      assert.ok(conv.toLowerCase().includes(t.toLowerCase()), `${DOC.conventions} must document the banned filler term "${t}" (the "${proseCfg.profile}" profile enforces it, so the written standard has to carry it)`)
    }
  }
  // A contributor who does not know the artwork is generated will hand-edit an SVG, and the
  // next regenerate will silently revert their work.
  if (assetsCfg) {
    assert.match(conv, /generate\.mjs/, `${DOC.conventions} must document how the README assets are regenerated (\`node ${assetsGeneratorPath}\`); a contributor who does not know they are generated will hand-edit one`)
  }
})

// ─────────────────────────────────────────────────────────────────── RS-stable-docs
gate('stable-docs', `RS-stable-docs the stable meta files exist with an H1 (${stableDocs.join(', ') || 'none declared'})`, () => {
  for (const f of stableDocs) {
    assert.ok(exists(f), `${f} must exist`)
    assert.match(read(f), /^# .+/m, `${f} must open with an H1`)
  }
})

// ──────────────────────────────────────────────────────────────────────── RS-todos
gate('todos', 'RS-todos no TODO(scaffold) marker survives in a governed doc', () => {
  for (const doc of [...metaDocs, ...stableDocs]) {
    if (!exists(doc)) continue
    let inFence = false
    read(doc).split('\n').forEach((line, i) => {
      if (FENCE_LINE.test(line)) { inFence = !inFence; return }
      if (inFence) return
      // same mention-vs-use rule as the voice ban: NAMING the marker in backticks/quotes
      // (docs about the scaffolder do) is not an unfinished scaffold. The match is
      // case-insensitive and space-tolerant, so a hand-retyped "todo (scaffold)" is still an
      // unfinished scaffold.
      const bare = line.replace(/"[^"]*"|`[^`]*`/g, '').replace(/(?<![A-Za-z0-9])'[^']*'(?![A-Za-z0-9])/g, '')
      assert.ok(!/todo\s*\(scaffold\)/i.test(bare), `${doc}:${i + 1} still carries a TODO(scaffold) marker; the scaffold is unfinished: ${line.trim().slice(0, 70)}`)
    })
  }
})

// ──────────────────────────────────────────────────────────────────────── RS-license
// GitHub cannot supply a LICENSE org-wide (every repo carries its own), yet the scaffolded
// set's one non-markdown file is the one RS-stable-docs cannot govern (a license text has no
// H1). This closes that hole: the file must exist, and when its text is a recognizable
// standard license, the version manifest's license field and the README's License section must
// name the same id: the declared-vs-discovered divergence license scanners flag, caught by
// the committed gate instead of an audit.
// (LICENSE_CANDIDATES and licenseFile are resolved above, where RS-prose also needs them.)
// twin of harness/sense-state.mjs's licenseFromFile chain, self-contained because a target
// repo receives ONLY this file; a change to either copy belongs in both. Each arm keys on what
// DISTINGUISHES its license (the BSD family shares one preamble verbatim; MIT's grant sentence
// also appears in other permissive texts), and an unmatchable text says 'unrecognized' rather
// than guessing.
const licenseIdOf = (text) =>
  /Apache License\s*\n\s*Version 2\.0/.test(text) ? 'Apache-2.0'
  : /GNU GENERAL PUBLIC LICENSE\s*\n\s*Version 3/.test(text) ? 'GPL-3.0'
  : /Mozilla Public License Version 2\.0/.test(text) ? 'MPL-2.0'
  : /Neither the name of the copyright holder|BSD 3-Clause/i.test(text) ? 'BSD-3-Clause'
  : /BSD 2-Clause/i.test(text) ? 'BSD-2-Clause'
  : /^MIT No Attribution\b/m.test(text) ? 'MIT-0'
  : /^MIT License/m.test(text) ? 'MIT'
  : /Redistribution and use in source and binary forms/.test(text) ? 'unrecognized' // some BSD variant; say so rather than guess
  // the bare grant sentence is shared across the MIT family (MIT-0 drops the notice-preservation
  // condition), so claim MIT only when that condition is present too, else say so rather than guess.
  : /Permission is hereby granted, free of charge/.test(text)
    ? (/above copyright notice and this permission notice/i.test(text) ? 'MIT' : 'unrecognized')
  : 'unrecognized'
const licenseText = licenseFile ? read(licenseFile) : null
const licenseId = licenseText && licenseText.trim() ? licenseIdOf(licenseText) : null
// a detected id matches a declared one exactly, or with the GNU -only/-or-later suffix the
// license TEXT alone cannot distinguish, because that grant choice lives in the declaration.
const idMatches = (declared) => declared === licenseId || declared === `${licenseId}-only` || declared === `${licenseId}-or-later`
// EVERY existing JSON manifest is consulted: checking only the first would let package.json
// (the manifest npm actually reads) contradict the LICENSE whenever plugin.json omits the field.
const licenseManifests = ['.claude-plugin/plugin.json', 'package.json'].filter((p) => exists(p))
const manifestDeclaresLicense = licenseManifests.some((p) => {
  try { const v = JSON.parse(read(p)).license; return v !== undefined && v !== null } catch { return false }
})

gate('license', `RS-license ${licenseFile ?? 'LICENSE'} exists and its id agrees with the manifest and README`, () => {
  assert.ok(licenseFile !== null, `no license file at the repo root (looked for ${LICENSE_CANDIDATES.join(', ')}) . GitHub cannot supply a LICENSE org-wide, so a governed repo carries its own; add one, or disable checks.license with a stated reason`)
  assert.ok(licenseText.trim().length > 0, `${licenseFile} is empty: an empty license file licenses nothing`)
  if (licenseId === 'unrecognized') return // agreement is unverifiable, and the named SKIP below says so out loud
  // manifest agreement: every existing JSON manifest that declares a license must agree. The
  // legacy object/array license form is itself the failure: npm deprecated it, and it renders
  // as "[object Object]" anywhere a string is expected.
  for (const manifestPath of licenseManifests) {
    let mf
    try { mf = JSON.parse(read(manifestPath)) } catch (e) { throw new Error(`${manifestPath} is not valid JSON, so its license field cannot be checked: ${e.message}`) }
    if (mf.license === undefined || mf.license === null) continue
    assert.ok(typeof mf.license === 'string', `${manifestPath} "license" uses the deprecated object/array form; declare a string SPDX expression (e.g. "${licenseId}")`)
    const tokens = mf.license.split(/[\s()]+/).filter(Boolean)
    assert.ok(tokens.some(idMatches), `${manifestPath} declares license "${mf.license}" but ${licenseFile} carries ${licenseId}; the manifest and the license file must agree`)
  }
  // README agreement: the License section (RS-readme already requires it last and non-empty)
  // must name the id the license file carries.
  if (exists(DOC.readme)) {
    const rm = stripFences(read(DOC.readme))
    const licH2 = [...rm.matchAll(/^## +(.+?)\s*$/gm)].filter((h) => /license/i.test(h[1])).pop()
    if (licH2) {
      const rest = rm.slice(licH2.index + licH2[0].length)
      const nextH2 = rest.search(/^## /m)
      const body = nextH2 === -1 ? rest : rest.slice(0, nextH2)
      const esc = licenseId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      assert.ok(new RegExp(`\\b${esc}(?:-only|-or-later)?(?![A-Za-z0-9-])`).test(body), `${DOC.readme}'s License section must name the license ${licenseFile} carries (${licenseId}); found no mention of it`)
    }
  }
})
if (!disabled.license && licenseId === 'unrecognized') {
  skipCheck('RS-license (id agreement)', `${licenseFile} is not a recognized standard license text, so LICENSE ⟺ manifest ⟺ README agreement cannot be checked; existence and non-emptiness were`)
}
// the ✓ line above must not imply a manifest agreement that never ran: when no manifest
// declares a license there is nothing to compare, and that absence is stated, not passed.
if (!disabled.license && licenseId && licenseId !== 'unrecognized' && !manifestDeclaresLicense) {
  skipCheck('RS-license (manifest leg)', licenseManifests.length
    ? `${licenseManifests.join(' and ')} declare${licenseManifests.length === 1 ? 's' : ''} no license field, so LICENSE ⟺ manifest agreement is not checkable (the scaffold skill backfills the field); the README leg still ran`
    : 'no version manifest exists, so LICENSE ⟺ manifest agreement is not checkable; the README leg still ran')
}

// ─────────────────────────────────────────────────────────────────── RS-placeholders
gate('placeholders', 'RS-placeholders no unfilled {{PLACEHOLDER}} token survives in a governed doc', () => {
  for (const doc of new Set([...metaDocs, ...stableDocs, ...(licenseFile ? [licenseFile] : [])])) {
    if (!exists(doc)) continue
    let inFence = false
    read(doc).split('\n').forEach((line, i) => {
      // deliberately NO fence exemption: template placeholders live inside fenced install/usage
      // examples ({{INSTALL_COMMAND}}), which is exactly where a hand-copied template escapes
      // fill-template's own refusal. Inline-code and quoted MENTIONS stay exempt in PROSE only
      // because inside a fence a quote is code syntax (a JSON/YAML example quotes its every value),
      // so the fence is scanned raw, delimiter lines included.
      const isDelim = FENCE_LINE.test(line)
      if (isDelim) inFence = !inFence
      const bare = (inFence || isDelim) ? line
        : line.replace(/"[^"]*"|`[^`]*`/g, '').replace(/(?<![A-Za-z0-9])'[^']*'(?![A-Za-z0-9])/g, '')
      const m = bare.match(/\{\{[A-Z0-9_]+\}\}/)
      assert.ok(!m, `${doc}:${i + 1} carries an unfilled template placeholder ${m?.[0]}: a hand-copied template bypassed the fill engine, so fill the value or delete the line: ${line.trim().slice(0, 70)}`)
    })
  }
})

// ──────────────────────────────────────────────────────────────────────── RS-shadow
// GitHub resolves README and every community health file with precedence .github/ > root >
// docs/, so a copy in a higher-precedence location silently REPLACES the governed one on the
// repo page while every content check here stays green. One copy per governed doc, wherever
// it lives, and only the three GitHub-served locations count (a README in some other subdirectory
// is that directory's business).
//
// README is the ONE exception, because it is the one governed basename with two jobs. It is a
// front-page fallback, and it is also the directory index GitHub renders whenever anyone browses
// a folder. A docs/README.md beside a root README.md is the second job: the root still serves
// the front page, nothing is hidden, and the documentation index is the conventional way to
// write one. Treating it as a shadow punished the correct pattern hard enough that a repo
// switched this whole check off to keep its docs index, which is a false positive rather than a
// policy. So docs/README.md is never a shadow; .github/README.md beside a root one still is.
gate('shadow', 'RS-shadow no governed doc is duplicated across the GitHub-served locations (.github/ > root > docs/)', () => {
  // EVERY governed doc, not just the health files: the manifest doc and docs.extra are swept
  // by voice/todos/placeholders/counts, so they are governed vocabulary here too.
  const basenames = new Set([DOC.readme, DOC.changelog, DOC.conventions, ...stableDocs, ...(manifestCfg ? [manifestCfg.file] : []), ...extraDocs].map((p) => p.split('/').pop()))
  for (const name of basenames) {
    const locations = name === 'README.md'
      ? [`.github/${name}`, name]
      : [`.github/${name}`, name, `docs/${name}`]
    const hits = locations.filter((p) => exists(p))
    assert.ok(hits.length <= 1, `duplicate meta file: ${hits[0]} shadows ${hits.slice(1).join(' and ')} (precedence .github/ > root > docs/, which is what GitHub serves for README and community health files); one governed copy only, so delete the rest`)
  }
  // The decoy that exemption could otherwise open: a repo that CONFIGURES its README into docs/
  // while a higher-precedence copy exists is checking a page GitHub never serves.
  if (DOC.readme === 'docs/README.md') {
    const higher = ['.github/README.md', 'README.md'].filter((p) => exists(p))
    assert.deepEqual(higher, [], `docs.readme points at docs/README.md but ${higher.join(' and ')} also exists. GitHub serves the higher-precedence copy, so the governed README is never the front page`)
  }
})

// ───────────────────────────────────────────────────────────────────────── RS-index
// The catalog a documentation tree keeps of itself: what each document is for, what state it is
// in, and when a human last checked it against the code. Two properties are load-bearing and
// both are structural. COVERAGE, because a doc nobody indexed is a doc nobody maintains and the
// way a docs tree rots is by quietly growing. RESOLUTION, because an index whose links have
// rotted is worse than no index: it reads authoritative and sends people nowhere.
//
// What this never does is read the clock. The recorded date is a FACT the repo states, and the
// check is that it exists and is well formed. Comparing it to today would make the same tree
// lint differently tomorrow, which is the one thing this toolkit refuses everywhere. Deriving
// freshness from git history instead sounds more rigorous and is worse: a repo handed over as a
// single squashed baseline gives every file the same commit, which is precisely the moment a
// freshness signal earns its keep.
const posixJoin = (dir, rel) => join(dir, rel).split('\\').join('/')

// The row parse, hoisted out of the per-index check so that a question spanning two indexes can
// ask it too. Memoised because it is now asked more than once per page.
//   A catalog row is a table row with a link to a file in it. Column ORDER is deliberately not
// fixed: what matters is that a row names a real file and says what state it is in, not which
// column each of those sits in.
//   Cells split on UNESCAPED pipes only. A `\|` is the markdown way to write a literal pipe
// inside a description, and splitting on it tore one cell into two, which shifted the status out
// of the column this check reads and failed a row that was correct.
/*
 * INLINE CODE SPANS, as offset ranges, because a link inside one is not a link.
 *
 * `| `[one.mjs](one.mjs)` | The engine. | active |` renders as literal text in a code span and
 * catalogues nothing, and both engines counted it as a row for one.mjs. Blanking every span
 * wholesale is not the fix: `` `active` `` is the ordinary way to write a status cell and
 * `` [`one.mjs`](one.mjs) `` puts a span inside a link LABEL, so a page that writes its table the
 * conventional way would have lost both. What is wrong is narrower than that. A link whose
 * opening bracket sits inside a span is text, and nothing else about the cell changes.
 *
 * CommonMark 6.3: a backtick string of length N opens a span, and the next backtick string of
 * EXACTLY length N closes it.
 */
const codeSpans = (s) => {
  const runs = [...s.matchAll(/`+/g)].map((m) => ({ at: m.index, len: m[0].length }))
  const out = []
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      if (runs[j].len !== runs[i].len) continue
      out.push([runs[i].at, runs[j].at + runs[j].len])
      i = j
      break
    }
  }
  return out
}
const insideSpan = (spans, at) => spans.some(([a, b]) => at >= a && at < b)
// Kept for the cheap "does this cell hold a link at all" test under grammar 1.
const LINK = /\[[^\]]*\]\(/
/*
 * ONE PARSED LINK, read by hand rather than by regex, and answering every question about the SAME
 * link from the offset it opened at.
 *
 * Two regexes over a whole cell used to answer two questions about two different links: in
 * `[a](open.md and also [b](closed.md)` the destination came from the first and the closure test
 * was satisfied by the second, so a row whose link never closes read as a catalog entry here and
 * as literal text on the page.
 *
 * A regex could not do the rest of it either. A markdown destination is not a regular language:
 * CommonMark 6.6 allows BALANCED parentheses inside an unbracketed destination, so `[x](one(a).mjs)`
 * names `one(a).mjs`, and a `[^\s)]+` destination stopped at the first `)` and named `one(a` ,
 * which resolves to no file and was reported as a row pointing nowhere. The angle-bracket form is
 * the only way to write a destination containing a space, and it is read here too.
 */
/*
 * A BACKSLASH ESCAPE, counted rather than looked for. CommonMark 2.4 lets any ASCII punctuation be
 * escaped, and an escape can itself be escaped, so what decides is whether the run of backslashes
 * in front of a character is ODD. `\[one.mjs](one.mjs)` renders as literal text and catalogues
 * nothing, and it was read here as a row.
 */
const escapedAt = (s, i) => { let n = 0; while (i - 1 - n >= 0 && s[i - 1 - n] === '\\') n++; return n % 2 === 1 }
const firstLink = (cell, spans = codeSpans(cell)) => {
  const ws = (c) => c !== undefined && /\s/.test(c)
  for (let i = 0; i < cell.length; i++) {
    if (cell[i] !== '[' || insideSpan(spans, i) || escapedAt(cell, i)) continue
    // AN IMAGE IS NOT A LINK. `![alt](one.mjs)` renders the file as a picture; a reader cannot
    // click through to it, and a catalog row is the one place a destination has to be navigable.
    // Both engines read it as a row, so a directory could be "catalogued" by pictures of itself.
    if (cell[i - 1] === '!' && !escapedAt(cell, i - 1)) continue
    // The label ends at the first UNESCAPED "]": `[a\](x)` closes nowhere a reader can see.
    let close = -1
    for (let k = i + 1; k < cell.length; k++) if (cell[k] === ']' && !escapedAt(cell, k)) { close = k; break }
    if (close === -1 || cell[close + 1] !== '(') continue
    let k = close + 2
    while (ws(cell[k])) k++
    let dest = ''
    if (cell[k] === '<') {
      const gt = cell.indexOf('>', k + 1)
      if (gt === -1) return { dest: '', closed: false }
      dest = cell.slice(k + 1, gt)
      k = gt + 1
    } else {
      const start = k
      let depth = 0
      for (; k < cell.length; k++) {
        const c = cell[k]
        if (ws(c)) break
        if (c === '(') depth++
        else if (c === ')') { if (depth === 0) break; depth-- }
      }
      dest = cell.slice(start, k)
    }
    while (ws(cell[k])) k++
    if (cell[k] === '"' || cell[k] === "'") {
      const q = cell.indexOf(cell[k], k + 1)
      if (q !== -1) { k = q + 1; while (ws(cell[k])) k++ }
    }
    return { dest: dest.trim(), closed: cell[k] === ')' }
  }
  return null
}
/*
 * A link destination as a REPO PATH. The fragment and the query are addressing rather than
 * filename, and each SEGMENT is percent-decoded on its own.
 *
 * `decodeURI` deliberately preserves the reserved set (#, ?, :, /), so a file genuinely named
 * `one#two.mjs` and correctly written `one%23two.mjs` came back still encoded and was reported as
 * a row pointing nowhere. And `one.mjs?raw=1` is a link to one.mjs: the query was carried into the
 * filename and the same row failed. Both are correct markdown that the coverage rule refused.
 */
const destToPath = (dest) => dest.split('#')[0].split('?')[0].split('/').map((s) => decodeURIComponent(s)).join('/')
const cellsOf = (l) => {
  let t = l.trim()
  if (t.startsWith('|')) t = t.slice(1)
  if (t.endsWith('|') && !t.endsWith('\\|')) t = t.slice(0, -1)
  const out = []
  let cur = ''
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '\\' && i + 1 < t.length) { cur += t[i] + t[i + 1]; i++; continue }
    if (t[i] === '|') { out.push(cur.trim()); cur = ''; continue }
    cur += t[i]
  }
  out.push(cur.trim())
  return out
}
/*
 * THE TABLE GRAMMAR, in two declared versions.
 *
 * Version 1 is what shipped: any line starting with `|`, any cell holding the link, any cell
 * beginning with a status word, any cell that is a date. It is kept as the default because
 * changing what a row MEANS under an adopter is a migration, not a fix, and version 1 is an
 * honest shape for a page that carries no headers.
 *
 * Version 2 reads the table the way a reader does. Three false greens the two engines shared,
 * each of which let a file look catalogued when nothing catalogued it:
 *   - an UNRELATED table (a roadmap, a compatibility matrix) whose rows happen to link files and
 *     carry a word from the status vocabulary counted as coverage;
 *   - a DESCRIPTION cell beginning with a status word satisfied the status rule while the status
 *     column sat empty;
 *   - a bare date in ANY column satisfied `requireDate`, so an "Added" column answered for a
 *     "Last verified" one that was blank.
 * Under version 2 a catalog row is a body row of a table whose header names a file column, the
 * status is read from the column whose header says status, and the date from the column whose
 * header says when it was last checked.
 *
 * FENCES are stripped in BOTH versions, because that was never a version question. A table
 * inside a code fence renders as an example of a table; counting its rows as coverage meant a
 * page could document the grammar and be credited with obeying it.
 */
const FILE_COL = /^(file|document|doc|path|name|page|entry)\b/i
const STATUS_COL = /^(status|state|lifecycle)\b/i
const DATE_COL = /\b(verified|reconciled|checked|reviewed|confirmed)\b/i
// Blanked rather than deleted, so a reported line number is the line the operator opens.
//   A CLOSING fence carries no info string (CommonMark 4.5: "the closing code fence ... may not
// have an info string"). Accepting one meant a page could reopen itself from inside its own
// example: a line reading ```` ```notclose ```` ended the fence here and not on GitHub, so every
// row after it counted as coverage while a reader saw one code block. The opener's info string is
// what tells the two apart, and it was not being read at all.
/*
 * AT MOST THREE SPACES, on the opening fence and on the closing one (CommonMark 4.5). `^\s*`
 * accepted a fence at any indentation, and four spaces inside an open fence is CONTENT: a page
 * could write an indented ``` that ended the block here and did not end it on GitHub, so the
 * fenced example beneath it stopped being blanked and every row in it counted as coverage.
 */
const FENCE_LINE_RE = /^ {0,3}(```+|~~~+)[ \t]*(.*)$/
/*
 * CommonMark 4.6 type 1: these four tags open a RAW HTML block whose content markdown never parses
 * and which ends at the matching close tag, or at the end of the file. A complete, column-correct
 * glossary inside <pre> was credited by both engines as full coverage and rendered as literal text.
 */
const HTML_RAW_OPEN = /^ {0,3}<(pre|script|style|textarea)(?=[\s/>]|$)/i
/*
 * CommonMark 4.6 type 6, verbatim from the specification so the set is one somebody can check
 * against it rather than a list that grew by anecdote: a block-level tag opens a block of raw HTML
 * that ends at the next BLANK line. A table inside one is markup, not a table.
 */
const HTML_BLOCK_TAGS = new Set(['address', 'article', 'aside', 'base', 'basefont', 'blockquote', 'body', 'caption', 'center', 'col', 'colgroup', 'dd', 'details', 'dialog', 'dir', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'frame', 'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hr', 'html', 'iframe', 'legend', 'li', 'link', 'main', 'menu', 'menuitem', 'nav', 'noframes', 'ol', 'optgroup', 'option', 'p', 'param', 'search', 'section', 'summary', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'title', 'tr', 'track', 'ul'])
const HTML_BLOCK_OPEN = /^ {0,3}<\/?([a-zA-Z][a-zA-Z0-9-]*)(?=[\s/>]|$)/
// The leaf blocks that CLOSE an open paragraph, which is the whole question an indented line
// depends on. Without them a four-space glossary sitting straight under a heading was read as a
// table and credited as coverage no reader can see.
const ATX_HEADING = /^ {0,3}#{1,6}(?:[ \t]|$)/
const THEMATIC_BREAK = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/
const SETEXT_UNDERLINE = /^ {0,3}(?:=+|-+)[ \t]*$/
// Blank a half-open range to spaces, newlines kept, so every offset and every line number in the
// result is the offset and line number in the file.
const blankRange = (s, a, b) => s.slice(0, a) + s.slice(a, b).replace(/[^\n]/g, ' ') + s.slice(b)
/*
 * HTML COMMENTS as ranges, INCLUDING the one nobody closed. `/<!--[\s\S]*?-->/` matched nothing at
 * all when the closing marker was missing, so a page could comment its real table out with one
 * typo, render as a comment that swallows the rest of the document on GitHub, and be reported
 * structurally complete here.
 */
const commentRanges = (text) => {
  const out = []
  for (let i = 0; ;) {
    const a = text.indexOf('<!--', i)
    if (a === -1) return out
    const b = text.indexOf('-->', a + 4)
    if (b === -1) { out.push([a, text.length]); return out }
    out.push([a, b + 3])
    i = b + 3
  }
}
/*
 * EVERYTHING ON THE PAGE MARKDOWN DOES NOT RENDER AS CONTENT, blanked POSITIONALLY: the result is
 * the SAME LENGTH as the source, so a reported line number is the line the operator opens and an
 * offset is the offset in the file. That equal length is load-bearing beyond tidiness, because it
 * is what lets a second consumer ask "is this byte inside something a reader can see" by comparing
 * the two strings, instead of keeping a second, drifting copy of these rules.
 *
 * Six contexts, each of which held a complete, well-formed, column-correct glossary that both
 * engines credited as full coverage and no reader could see:
 *   a FENCED block, where a table is an EXAMPLE of a table;
 *   a fenced block closed by an INDENTED pseudo-fence, which does not close it on GitHub;
 *   an HTML COMMENT, rendered as nothing at all, whether or not anyone closed it;
 *   a RAW HTML block (<pre>, <script>, <style>, <textarea>), rendered as literal text;
 *   an HTML BLOCK (<div>, <details>, <table>...), which is markup until the next blank line;
 *   an INDENTED CODE BLOCK, including one sitting directly under a heading.
 * A page could therefore document the grammar, comment the real table out, or paste it as a code
 * sample, and be credited with obeying it. "Every file has a row" has to mean a row somebody can
 * read, or the check is measuring the file rather than the page.
 *
 * ORDER IS THE RULE, not an implementation detail. Fences come first because a fence's content is
 * literal: a comment marker or an HTML tag inside one is text, and blanking those first would let
 * an example of a comment swallow a real table below it.
 */
const blankNonRendering = (text) => {
  let fence = null
  const unfenced = text.split('\n').map((line) => {
    const m = line.match(FENCE_LINE_RE)
    // An unclosed fence runs to the end of the file, which is what GitHub renders.
    if (fence) { if (m && m[1][0] === fence[0] && m[1].length >= fence.length && m[2].trim() === '') fence = null; return ' '.repeat(line.length) }
    if (m) { fence = m[1]; return ' '.repeat(line.length) }
    return line
  }).join('\n')
  let masked = unfenced
  for (const [a, b] of commentRanges(unfenced)) masked = blankRange(masked, a, b)
  let raw = null, htmlBlock = false, paragraphOpen = false, inIndented = false
  return masked.split('\n').map((line) => {
    const blank = ' '.repeat(line.length)
    if (raw !== null) {
      if (new RegExp(`</${raw}(?:\\s*)>`, 'i').test(line)) raw = null
      paragraphOpen = false
      return blank
    }
    // A blank line closes every open paragraph and every open HTML block. A line the passes above
    // already blanked arrives here as spaces and is treated the same way, which is correct: after a
    // fenced block ends, no paragraph is open, so the next indented line IS code.
    if (line.trim() === '') { paragraphOpen = false; inIndented = false; htmlBlock = false; return line }
    if (htmlBlock) { paragraphOpen = false; return blank }
    const rawOpen = line.match(HTML_RAW_OPEN)
    if (rawOpen) {
      raw = rawOpen[1].toLowerCase()
      if (new RegExp(`</${raw}(?:\\s*)>`, 'i').test(line.slice(rawOpen[0].length))) raw = null
      paragraphOpen = false
      return blank
    }
    // CommonMark 4.4: an indented code block cannot interrupt a paragraph, so four spaces (or a
    // tab) is code only where no paragraph is open. A table indented one to three spaces still
    // renders, and is left alone.
    if (/^(?: {4}|\t)/.test(line) && (!paragraphOpen || inIndented)) { inIndented = true; return blank }
    inIndented = false
    const blockOpen = line.match(HTML_BLOCK_OPEN)
    if (blockOpen && HTML_BLOCK_TAGS.has(blockOpen[1].toLowerCase())) { htmlBlock = true; paragraphOpen = false; return blank }
    if (ATX_HEADING.test(line) || THEMATIC_BREAK.test(line)) { paragraphOpen = false; return line }
    if (paragraphOpen && SETEXT_UNDERLINE.test(line)) { paragraphOpen = false; return line }
    paragraphOpen = true
    return line
  }).join('\n')
}
/*
 * A markdown table is a header row, a DELIMITER row, and body rows. Under grammar 2 that shape is
 * what makes a run of pipe lines a table rather than a coincidence, and the header is what binds
 * each check to a column instead of to whichever cell happens to satisfy it.
 *
 * GFM 4.10: the delimiter row's cells contain only hyphens with an optional leading or trailing
 * colon, and "the delimiter row must match the header row in the number of cells. If not, a table
 * will not be recognized." Both halves are enforced here. The old test asked only whether a hyphen
 * appeared somewhere on the line, so `| --- | not a delimiter |` opened a table and every pipe
 * line beneath it counted as a catalog row.
 *   `|-|-|-|` is VALID GFM and still opens a table: one hyphen is a legal delimiter cell, GitHub
 * renders it, and refusing it would fail a page a reader can see perfectly well.
 */
const DELIMITER_CELL = /^:?-+:?$/
const isDelimiter = (line, headerCells) => {
  if (!line.includes('|')) return false
  const cells = cellsOf(line)
  return cells.length === headerCells && cells.every((c) => DELIMITER_CELL.test(c.trim()))
}
const tablesOf = (lines) => {
  const out = []
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].trimStart().startsWith('|')) continue
    const header = cellsOf(lines[i]).map((c) => undecorate(c))
    if (!lines[i + 1] || !isDelimiter(lines[i + 1], header.length)) continue
    const body = []
    let j = i + 2
    for (; j < lines.length && lines[j].trimStart().startsWith('|'); j++) body.push({ line: j + 1, raw: lines[j] })
    out.push({ headerLine: i + 1, header, body, fileCol: header.findIndex((h) => FILE_COL.test(h)), statusCol: header.findIndex((h) => STATUS_COL.test(h)), dateCol: header.findIndex((h) => DATE_COL.test(h)) })
    i = j - 1
  }
  return out
}
const catalogs = new Map()
const catalogOf = (ix) => {
  if (catalogs.has(ix)) return catalogs.get(ix)
  const cataloged = new Map(), dupes = [], escaping = [], order = [], undecodable = [], malformed = [], siteAbsolute = [], headerGaps = []
  const lines = blankNonRendering(exists(ix.file) ? read(ix.file) : '').split('\n')
  // Under grammar 2 only the body rows of a table whose header names a file column are catalog
  // rows, and each row carries the columns its checks read. Under grammar 1 every pipe line is a
  // candidate and every cell answers for everything, which is what it always did.
  const tables = ix.grammar === 2 ? tablesOf(lines).filter((t) => t.fileCol !== -1) : []
  // A COLUMN THAT IS NOT THERE is a gap in the page, never permission to read another one. With
  // no status column the check fell back to "any cell", so renaming `Status` to `Phase` turned
  // the bound rule back into the unbound one and a description beginning with a status word
  // answered for a column that does not exist. Same for the verification date under an `Added`
  // header. Grammar 2 is the promise that each check reads the column its header names, and a
  // missing header means the promise cannot be kept, so it is reported instead of downgraded.
  if (ix.grammar === 2) {
    for (const t of tables) {
      if (ix.statuses !== null && t.statusCol === -1) headerGaps.push({ line: t.headerLine, need: 'status', header: t.header })
      if (ix.requireDate && t.dateCol === -1) headerGaps.push({ line: t.headerLine, need: 'verification-date', header: t.header })
    }
  }
  const rowsUnderGrammar = ix.grammar === 2
    ? tables.flatMap((t) => t.body.map((b) => ({ ...b, fileCol: t.fileCol, statusCol: t.statusCol, dateCol: t.dateCol })))
    : lines.map((raw, i) => ({ line: i + 1, raw, fileCol: -1, statusCol: -1, dateCol: -1 })).filter((r) => r.raw.trimStart().startsWith('|'))
  for (const { line: lineNo, raw: line, fileCol, statusCol, dateCol } of rowsUnderGrammar) {
    const n = lineNo - 1
    if (!line.trimStart().startsWith('|')) continue
    const cells = cellsOf(line)
    // THE LINK COMES FROM THE FILE COLUMN under grammar 2, and from anywhere under grammar 1.
    // Searching every cell was the last unbound rule: a row with an EMPTY file cell and a link
    // sitting in its description counted as coverage, which is the "unrelated table" hole in its
    // one-row spelling. The header named the column; the parser has to read it.
    //   Under grammar 1 a cell only qualifies when it holds a link OUTSIDE a code span, for the
    // reason firstLink gives: a link inside one renders as text and catalogues nothing.
    const linkCell = fileCol >= 0 ? (cells[fileCol] ?? '') : (cells.find((c) => LINK.test(c) && firstLink(c)) ?? '')
    const link = firstLink(linkCell)
    if (!link) continue
    const target = link.dest
    // External links and in-page anchors are prose, not catalog entries.
    if (!target || /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')) continue
    // A ROOT-ABSOLUTE destination is a site path, not a file path: GitHub resolves `/guide.md`
    // against the domain, not against this directory. Joining it onto the index's directory
    // invented a repo-relative path nobody wrote, so `/guide.md` in a docs index resolved to
    // docs/guide.md and passed as coverage for a link that leads off the repo entirely.
    if (target.startsWith('/')) { siteAbsolute.push({ line: n + 1, target }); continue }
    if (!link.closed) { malformed.push({ line: n + 1, target }); continue }
    // The decoder THROWS on a target that is not valid percent-encoding, and `100%.md` is a legal
    // filename. Uncaught, one bad row took down the whole run with a decoder stack trace in place
    // of a diagnosis. It is a bad row, and it is reported as one.
    let decoded
    try { decoded = destToPath(target) } catch { undecodable.push({ line: n + 1, target }); continue }
    const resolved = posixJoin(ix.dir, decoded)
    // A row reaching OUT of the directory this index catalogues counted as coverage for a file
    // the index has no business speaking for. It is almost always a target written relative to
    // the repo root instead of to the index, which is the single most common way to get a row
    // wrong.
    if (!underPath(resolved, ix.dir)) { escaping.push({ line: n + 1, target, resolved }); continue }
    if (cataloged.has(resolved)) dupes.push({ target: resolved, lines: [cataloged.get(resolved).line, n + 1] })
    // The columns the grammar binds each check to. Under version 1 they are -1, and every check
    // falls back to "any cell", which is what version 1 has always meant.
    else { cataloged.set(resolved, { cells, line: n + 1, statusCol, dateCol }); order.push(resolved) }
  }
  const parsed = { cataloged, dupes, escaping, order, undecodable, malformed, siteAbsolute, headerGaps }
  catalogs.set(ix, parsed)
  return parsed
}

// THE UNIVERSE ITSELF, checked before anything is judged against it. Every coverage verdict below
// is a statement about a SET, and a set that quietly lost members makes "every file is catalogued"
// true of a smaller repo than the one on disk. Run wherever the universe decides something: a
// declared index, or strict ownership with none yet. A repo that has not opted into the pillar at
// all is told nothing, because there is no claim for a shrunken set to falsify.
if (!disabled.index && universeErrors.length && (indexes.length || ownership === 'strict')) {
  check('RS-index (universe) every path git keeps is one this check can actually see', () => {
    assert.deepEqual(universeErrors, [], `${universeErrors.length} path(s) git keeps cannot enter the coverage universe: ${universeErrors.map((e) => `${JSON.stringify(e.path)} (${e.why})`).join('; ')}. Until each one is resolved, every coverage result below is a statement about a smaller repo than the one git tracks`)
  })
}
if (!indexes.length) {
  if (!disabled.index) skipCheck('RS-index', 'no index declared ("docs.index": false); set it once a directory should say what each file in it is for')
  else skipCheck('RS-index', `disabled in config: ${disabled.index}`)
} else if (disabled.index) {
  skipCheck('RS-index', `disabled in config: ${disabled.index}`)
} else {
  for (const ix of indexes) {
    const label = ix.extensions.includes('*') ? 'kept' : ix.extensions.join('/')
    check(`RS-index ${ix.file} catalogues every ${label} file under ${ix.dir}/`, () => {
      assert.ok(exists(ix.file), `${ix.file} does not exist, but "${ix.at}" declares it as the index for ${ix.dir}/`)
      // (An index that no prose sweep governs is refused up in the config block, as the config
      // error it is: the fix is an edit to .repo-standard.json, and this check never runs under
      // one.)
      const body = read(ix.file)
      const { cataloged, dupes, escaping, order, undecodable, malformed, siteAbsolute, headerGaps } = catalogOf(ix)
      // FIRST, because a table missing the column a check reads makes every per-row verdict below
      // a statement about the wrong cells. Naming the header once beats naming every row in it.
      assert.deepEqual(headerGaps, [], headerGaps.length ? `${ix.file} declares grammar 2, and ${headerGaps.length} table header(s) do not name a column a declared check reads: ${headerGaps.map((g) => `line ${g.line} (${g.header.map((h) => h || '(blank)').join(' | ')}) has no ${g.need} column`).join('; ')}. Grammar 2 means each check reads the column its header names; a missing header is a gap in the page, and falling back to "any cell" would quietly restore the grammar-1 rule this index opted out of. A status column's header begins with Status, State or Lifecycle; a verification-date column's header contains verified, reconciled, checked, reviewed or confirmed` : '')
      assert.deepEqual(siteAbsolute, [], siteAbsolute.length ? `${ix.file} carries ${siteAbsolute.length} row(s) whose link destination begins with "/": ${siteAbsolute.map((e) => `line ${e.line} links "${e.target}"`).join('; ')}. A leading slash makes it a SITE path, which GitHub resolves against the domain rather than against this directory, so it is not a link to a file in this repo at all. Write the destination relative to the index` : '')
      assert.deepEqual(malformed, [], malformed.length ? `${ix.file} carries ${malformed.length} row(s) whose link never closes: ${malformed.map((e) => `line ${e.line} opens a link to "${e.target}"`).join('; ')}. A markdown link with no closing parenthesis renders as literal text, so the row reads as a catalog entry here and as prose to everyone who opens the page` : '')
      assert.deepEqual(undecodable, [], undecodable.length ? `${ix.file} carries ${undecodable.length} row(s) whose link target is not valid percent-encoding: ${undecodable.map((e) => `line ${e.line} links "${e.target}"`).join('; ')}. A literal % in a path has to be written %25, or the target cannot be decoded to a filename at all` : '')
      assert.deepEqual(escaping, [], escaping.length ? `${ix.file} carries ${escaping.length} row(s) pointing outside ${ix.dir}/: ${escaping.map((e) => `line ${e.line} links "${e.target}", which resolves to ${e.resolved}`).join('; ')}. A link target in an index is relative to the INDEX, not to the repo root, and a row for a file in another directory is coverage this index cannot hold` : '')
      // Held in a plain Map this was a silent overwrite, so an index could describe one file two
      // different ways, on two different lines, and pass every check there is.
      assert.deepEqual(dupes, [], dupes.length ? `${ix.file} catalogues ${dupes.length} file(s) more than once: ${dupes.map((d) => `${d.target} on lines ${d.lines.join(' and ')}`).join('; ')}. Two rows for one file means two descriptions to keep true and no way to tell which one is authoritative` : '')
      assert.ok(cataloged.size > 0, `${ix.file} carries no catalog rows: an index that lists nothing indexes nothing, and each row links a file and says what it is for`)
      for (const target of cataloged.keys()) {
        assert.ok(exists(target), `${ix.file} catalogues ${target}, which does not exist. An index whose links have rotted reads authoritative and sends people nowhere`)
      }
      // What this index OWNS, per file, from the declarations rather than from the floor plan. A
      // declared child is still a boundary its ancestor stops at, but only over the files the
      // child actually claims: a parent speaking for .json and a child speaking for .md used to
      // leave every .json under the child owned by nobody and green everywhere.
      const under = indexUniverse(ix.dir).filter((f) => ownerOf(f) === ix)
      const missing = under.filter((f) => !cataloged.has(f)).sort()
      assert.deepEqual(missing, [], `${ix.file} does not catalogue ${missing.length} file(s) ${ix.scope === 'direct' ? 'directly in' : 'under'} ${ix.dir}/: ${missing.join(', ')} . A file nobody indexed is a file nobody maintains: add a row, or list it under ${ix.at}.ignore. (The file universe here is ${INDEX_UNIVERSE}.)`)
      // Ascending path order, when the index declares it. Mandated rather than chosen where it is
      // on: it is the only order a later sweep reproduces, and an index whose rows are in some
      // other order gets REWRITTEN by the next run instead of diffed, which buries the one row
      // that actually changed in a hundred that did not.
      if (ix.ordered) {
        const outOfOrder = order.filter((t, i) => i > 0 && order[i - 1] > t)
        assert.deepEqual(outOfOrder, [], outOfOrder.length ? `${ix.file} lists ${outOfOrder.length} row(s) out of ascending path order: ${outOfOrder.join(', ')}. Sort the table by link target, or set "${ix.at}.ordered" to false and accept that the next sweep rewrites this page rather than diffing it` : '')
      }
      // The index-level date: one recorded reconciliation over the whole directory, rather than a
      // date per row. It is what the sweep that wrote the index can actually attest to, and it is
      // one claim to keep true instead of N. Never compared to today, only required to be there.
      if (ix.reconciled) {
        const m = body.match(INDEX_RECONCILED)
        assert.ok(m, `${ix.file} records no reconciliation date. Add a line reading "Reconciled against the code: YYYY-MM-DD" naming the day someone last read this directory and confirmed every row. The lint checks the line exists and is well formed, never how old it is`)
        assert.ok(isRealDate(m[1]), `${ix.file} records "Reconciled against the code: ${m[1]}", which has the shape of a date and names no day. A date nobody can place on a calendar is not a freshness signal, it is a string that looks like one`)
      }
      // Under grammar 2 each check reads ITS column; under grammar 1 any cell answers, which is
      // how a description beginning with a status word satisfied the status rule while the status
      // column sat empty, and how an "Added" date answered for a blank "Last verified".
      //   Under grammar 2 a column that is not there yields NOTHING to read rather than every
      // cell: the header gap above is the diagnosis, and falling back here would be the exact
      // downgrade that gap exists to refuse.
      const cellsFor = (cells, col) => (ix.grammar === 2 ? (col >= 0 ? [cells[col] ?? ''] : []) : cells)
      const where = (col, what) => (ix.grammar === 2 && col >= 0 ? `the ${what} column` : 'any cell')
      for (const [target, { cells, statusCol, dateCol }] of cataloged) {
        if (ix.statuses !== null) {
          const res = statusResFor(ix)
          const words = statusWordsFor(ix)
          assert.ok(cellsFor(cells, statusCol).some((c) => res.some((re) => re.test(undecorate(c)))), `${ix.file}: ${where(statusCol, 'status')} in the row for ${target} does not begin with one of this index's statuses (${words.join(', ')}): a catalog that cannot say which files still describe the system is a list, not an index. Backticks and emphasis around the word are fine, and so is a qualifier after it`)
        }
        if (ix.requireDate) {
          assert.ok(cellsFor(cells, dateCol).some((c) => isRealDate(c)), `${ix.file}: ${where(dateCol, 'verification-date')} in the row for ${target} records no verification date (YYYY-MM-DD). The date is the freshness signal, and it is a fact you record rather than one any tool can derive. If this index does not date every row, set "${ix.at}.requireDate" to false and record one "Reconciled against the code" line instead`)
        }
      }
    })
    // Whatever an index does not check is said out loud, the same as everywhere else.
    if (ix.statuses === null) {
      skipCheck(`RS-index (status) ${ix.file}`, `no "${ix.at}.statuses" declared, so whether each file still describes the system is stated nowhere and checked nowhere`)
    }
    if (!ix.requireDate && !ix.reconciled) {
      skipCheck(`RS-index (dates) ${ix.file}`, `neither "${ix.at}.requireDate" nor "${ix.at}.reconciled" is true, so nothing records when this index was last checked against the code`)
    }
    if (!ix.ordered) {
      skipCheck(`RS-index (order) ${ix.file}`, `"${ix.at}.ordered" is not true, so the rows may sit in any order and the next sweep over this directory produces a rewrite rather than a diff`)
    }
    // The weaker grammar, named on every run rather than left to be discovered from a green
    // build. Version 1 is the default because changing what a row MEANS under an adopter is a
    // migration rather than a fix, but three things it cannot see are three ways a file can look
    // catalogued when nothing catalogues it.
    if (ix.grammar !== 2) {
      skipCheck(`RS-index (grammar) ${ix.file}`, `"${ix.at}.grammar" is 1 (the default), so any line starting with "|" is a candidate row, any cell may carry the status, and any cell may carry the date. That means an UNRELATED table whose rows link files counts as coverage, a description beginning with a status word satisfies the status rule while the status column is empty, and a date in any column answers for a blank verification column. Set it to 2 to bind each check to the column its header names`)
    }
    // A recorded placement decision, printed for the same reason a decline is: an answered
    // question and an ignored one look identical from here otherwise.
    if (ix.retain) {
      skipCheck(`RS-index (placement) ${ix.file}`, `stays where it is rather than moving to ${ix.dir}/README.md, by recorded decision: ${ix.retain}`)
    }
  }
  // ONE file, TWO tables. The containment rule never saw this: a row in an ancestor's index for a
  // file the child owns resolves, exists, and reads as coverage, so the file ended up with two
  // authoritative descriptions and no way to tell which was current.
  if (indexes.length > 1) {
    check('RS-index no file is catalogued by two indexes', () => {
      const by = new Map()
      for (const ix of indexes) {
        if (!exists(ix.file)) continue
        for (const target of catalogOf(ix).cataloged.keys()) {
          if (!by.has(target)) by.set(target, [])
          by.get(target).push(ix.file)
        }
      }
      const shared = [...by].filter(([, where]) => where.length > 1).map(([target, where]) => `${target} (in ${where.join(' and ')})`)
      assert.deepEqual(shared, [], shared.length ? `${shared.length} file(s) are catalogued by more than one index: ${shared.join('; ')}. One file has one owner: the deepest declaration that claims it. Delete the other row, or narrow one declaration so it stops claiming the file` : '')
    })
  }
}
// ─────────────────────────────────────────────────── RS-index (ownership)
// OUTSIDE the declared-index branch, and that placement is the whole fix. Nested inside it, the
// entire ownership contract was skipped whenever a repo declared no index at all: a config
// reading `"docs.ownership": "strict"` with zero declarations printed "no index declared" and
// went green over a repo where nothing was owned by anything. The planner exited 1 on the same
// tree. Strict has to mean the same thing before the first index exists as after it, or the
// mode is a promise that only holds once it is already being kept.
//
// Under `declared` ownership this is a SKIP on purpose: a repo that indexes its markdown and not
// its images has said what it wanted, and turning that into a red build would be this toolkit
// imposing a scope it was never given. What it must never be is silent, because "no missing rows"
// over a set nobody chose reads exactly like coverage. Under `strict` it is the whole contract,
// and it fails.
//   An `ignore` entry is a DECISION, not a gap. The planner has always read it that way and this
// side did not, so one engine called an ignored file undecided and the other did not. Under
// strict ownership that difference is the difference between an answerable gate and an
// unanswerable one: without it there would be no way to say "these files owe no rows" at all.
{
  const declaredFiles = new Set(indexes.map((ix) => ix.file))
  const reaches = (ix, f) => (ix.scope === 'direct' ? dirOf(f) === ix.dir : underPath(f, ix.dir))
  const decidedOut = (f) => indexes.some((ix) => reaches(ix, f) && ix.ignore.some((i) => underPath(f, i)))
  const answersFor = (what) => `Extend an "extensions" list (or set it to ["*"]), give ${what} its own index, list ${what} under an index's "ignore", or record the directory under "docs.declined" with the reason`
  const undecidedFile = (f) => !declaredFiles.has(f) && !ownerOf(f) && !decidedOut(f)
    && !declinedIndexes.some((d) => underPath(f, d.dir))
  const unowned = keptFiles.filter((f) => undecidedFile(f) && indexes.some((ix) => underPath(f, ix.dir)))
  // THE STATED BOUNDARY of the ownership model, and it is named rather than left to be discovered.
  // A file at the repo ROOT cannot be owned: an index must live inside the directory it
  // catalogues, so a root-level declaration is refused above by construction, and the root's own
  // pages are governed by RS-readme, RS-changelog and the rest instead. A file under a
  // DOT-DIRECTORY is excluded for the reason assets.coverage excludes them: they hold tooling a
  // reader does not browse. Both were silently green under strict, which made "every kept file"
  // a sentence this check did not keep. A dot-directory that genuinely wants covering is closable
  // today by declaring an index for it, and it is covered from then on like any other.
  const outsideModel = keptFiles.filter((f) => undecidedFile(f) && !indexes.some((ix) => underPath(f, ix.dir)))
    .filter((f) => !dirOf(f) || f.split('/').some((seg, i, a) => i < a.length - 1 && seg.startsWith('.')))
    .sort()
  // A directory holding kept files that NO declaration and no recorded decline reaches. This side
  // could not see these at all: the scan above is scoped to what sits inside a declared index's
  // directory, so an entire new top-level directory of source was invisible to the gate while the
  // planner exited 1 on it.
  const undecidedDirs = [...new Set(keptFiles.map(dirOf))].filter(Boolean)
    .filter((d) => !d.split('/').some((seg) => seg.startsWith('.')))
    .filter((d) => !indexByDir.has(d)
      && !declinedIndexes.some((x) => underPath(d, x.dir))
      && keptFiles.some((f) => dirOf(f) === d && !declaredFiles.has(f) && !ownerOf(f) && !decidedOut(f)))
    .sort()
  const boundaryNote = outsideModel.length
    ? ` ${outsideModel.length} further kept file(s) sit OUTSIDE this model and are not judged by it: ${outsideModel.slice(0, 8).join(', ')}${outsideModel.length > 8 ? `, and ${outsideModel.length - 8} more` : ''}. A file at the repo root cannot be owned (an index lives inside the directory it catalogues), and a dot-directory is excluded the way assets.coverage excludes one; declare an index for a dot-directory to bring it in.`
    : ''
  if (disabled.index) {
    skipCheck('RS-index (ownership)', `disabled in config: ${disabled.index}`)
  } else if (ownership === 'strict') {
    // Stated as a passing check rather than a silence when it holds, because "strict ownership is
    // on and every file is spoken for" is the one sentence this whole pillar exists to earn.
    check('RS-index (ownership) every kept file under a declared index has exactly one owner', () => {
      assert.deepEqual(unowned, [], unowned.length ? `"docs.ownership" is "strict", and ${unowned.length} kept file(s) sit inside a directory that keeps an index with no declaration speaking for them: ${unowned.slice(0, 12).join(', ')}${unowned.length > 12 ? `, and ${unowned.length - 12} more` : ''}. ${answersFor('the directory')}` : '')
    })
    check('RS-index (ownership) every directory holding kept files has been decided about', () => {
      assert.deepEqual(undecidedDirs, [], undecidedDirs.length ? `"docs.ownership" is "strict", and ${undecidedDirs.length} directory(ies) hold kept files no index speaks for and no recorded decline covers: ${undecidedDirs.slice(0, 12).join(', ')}${undecidedDirs.length > 12 ? `, and ${undecidedDirs.length - 12} more` : ''}. ${answersFor('the directory')}` : '')
    })
    // The boundary is printed under strict WHETHER OR NOT anything is in it, because the count is
    // the qualifier on the two checks above: they say "every kept file", and this says which
    // files that phrase was never about.
    skipCheck('RS-index (ownership boundary)', outsideModel.length
      ? `${outsideModel.length} kept file(s) sit outside the ownership model, so "strict" does not judge them: ${outsideModel.slice(0, 12).join(', ')}${outsideModel.length > 12 ? `, and ${outsideModel.length - 12} more` : ''}. A file at the repo root cannot be owned (an index lives inside the directory it catalogues, so there is no declaration that could reach one), and a dot-directory is excluded the way assets.coverage excludes one: declare an index for it to bring it in`
      : 'every kept file this repo holds is either inside the ownership model or at a path the model states it does not reach (the repo root, and dot-directories); none are in the second set')
  } else {
    if (unowned.length) {
      skipCheck('RS-index (unowned)', `${unowned.length} kept file(s) sit inside a directory that keeps an index and no declaration speaks for them, so no row is required and none is checked: ${unowned.slice(0, 12).join(', ')}${unowned.length > 12 ? `, and ${unowned.length - 12} more` : ''}. ${answersFor('the directory')}. Set "docs.ownership" to "strict" once the atlas is complete, and this becomes a failure instead of this line`)
    }
    // Named even under `declared`, because the alternative is what shipped: a directory the gate
    // has no rule for at all, reported nowhere, while the planner called it structural work.
    // Only once the pillar is STARTED, though: enumerating every directory in a repo that has
    // never declared an index is a wall of text about a feature nobody opted into, and the
    // single "no index declared" skip above already says the one thing there is to say.
    if (undecidedDirs.length && indexes.length) {
      skipCheck('RS-index (undecided directories)', `${undecidedDirs.length} directory(ies) hold kept files that no index speaks for and no recorded decline covers, so nothing here is checked: ${undecidedDirs.slice(0, 12).join(', ')}${undecidedDirs.length > 12 ? `, and ${undecidedDirs.length - 12} more` : ''}. ${answersFor('a directory')}.${boundaryNote}`)
    }
  }
}
// A recorded no is information, and information this standard prints. Silence here would make a
// declined directory indistinguishable from one nobody has looked at, which is the exact
// ambiguity the per-directory record exists to remove. Printed OUTSIDE the declared-index branch,
// because a repo that turned every directory down declares no index at all, and that was the one
// shape where every recorded answer went unmentioned.
for (const d of declinedIndexes) {
  skipCheck(`RS-index (declined) ${d.dir}/`, `recorded in docs.declined and not offered again: ${d.why ?? 'no reason recorded'}${exists(d.dir) ? '' : ' (and this directory no longer exists, so the decline has outlived its subject)'}`)
}

// ──────────────────────────────────────────────────────────────────────── RS-assets
// The generated README identity: a manifest, a generator beside it, and the artwork both
// produce. Everything here is a claim the repo makes about itself in the first thing anyone
// sees, so everything here is re-derived rather than trusted.
const posix = (p) => p.split('\\').join('/')
const relFromDoc = (doc, target) => posix(relative(dirname(doc) === '.' ? '' : dirname(doc), target))
// THE SAME PATH CONTRACT, over the asset manifest. The manifest is not the config, so its paths
// are not config errors, but they are read, stat'd and traversed exactly like configured ones and
// they had a hand-rolled half-rule (a leading "/" and a ".." segment, and nothing else) that
// missed backslashes, drive letters, empty components and every symlink. A banner declared for
// "../sibling" and a pill sourced from "../sibling/package.json" both decided this repo's verdict
// from a tree it does not govern.
/*
 * ONE CANONICAL FORM, produced only after the spelling has been judged, and RETURNED so that
 * everything downstream reads the same path. Validating and then leaving each call site holding
 * the raw value is how a banner declared for "./docs" was a no-op to the generator and a coverage
 * FAILURE here: `coverage.ignore` had been canonicalised through the config contract, the manifest
 * value had not, and `"./docs"` compared equal to nothing. The rules are the config contract's,
 * character for character, because a manifest path is read, stat'd and traversed exactly like a
 * configured one.
 */
const manifestCanon = (p) => {
  const raw = String(p)
  const spelled = raw.length > 1 ? (raw.replace(/\/+$/, '') || raw) : raw
  return spelled === '.' ? spelled : spelled.replace(/^\.\//, '')
}
const manifestPath = (p, where) => {
  const raw = String(p)
  const spelled = raw.length > 1 ? (raw.replace(/\/+$/, '') || raw) : raw
  assert.ok(!escapesRepo(spelled), `${assetsManifestPath} "${where}" must be a repo-relative path that stays inside this repo (got ${JSON.stringify(p)}): no leading "/", no "..", no backslashes, no empty path components, no control characters`)
  const canon = spelled === '.' ? spelled : spelled.replace(/^\.\//, '')
  assert.ok(!escapesOnDisk(canon), `${assetsManifestPath} "${where}" is spelled as a repo-relative path (${JSON.stringify(p)}) and resolves OUTSIDE this repo: something in it is a symlink pointing away, and the file that gets opened is what decides the verdict`)
  return canon
}
/*
 * A REGULAR FILE AT THE PATH IT IS NAMED BY, checked before anything reads, imports or compares it.
 *
 * `escapesOnDisk` answers "does this land outside the repo"; this answers the question underneath
 * it, which is whether the bytes are committed HERE at all. A symlinked manifest, generator or SVG
 * satisfies exists(), reads through, hashes clean, and re-renders byte-identical against a file
 * this repo does not commit at that path. Replacing banner.svg with a link produced 29 passed, 0
 * failed, and an apply then wrote the rendered artwork straight through the link onto its target.
 */
const regularFile = (rel, what) => {
  let st = null
  try { st = lstatSync(join(ROOT, rel)) } catch { return /* absence is a different diagnosis, made by the caller */ }
  assert.ok(st.isFile(), `${rel} is ${st.isSymbolicLink() ? 'a SYMLINK' : 'not a regular file'}, and ${what}. Commit it as a regular file: a link reads through to bytes this repo does not keep at this path, so every verdict about it would be a verdict about the tree it points into, and a regenerate would write through it`)
}

const hexToChannels = (hex) => {
  const h = String(hex).replace('#', '')
  const parts = h.length === 3 ? [...h].map((c) => c + c) : [h.slice(0, 2), h.slice(2, 4), h.slice(4, 6)]
  return parts.map((p) => parseInt(p, 16) / 255)
}
// WCAG 2.2 relative luminance and contrast ratio, verbatim from the specification.
const luminance = (hex) => {
  const [r, g, b] = hexToChannels(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrastRatio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const dottedPath = (obj, path) => String(path).split('.').reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), obj)
/*
 * WHAT IS ACTUALLY IN THE ASSET DIRECTORY, including the entries a scan built on `isFile()` used to
 * drop on the floor. A SYMLINKED banner.svg is neither a file nor a directory to a Dirent, so it
 * vanished from the orphan sweep entirely: the drift check then compared the render against the
 * link's target, passed, and an apply wrote the artwork through the link. An asset that is not a
 * regular file is REPORTED, because "the directory holds nothing the manifest does not produce" is
 * a claim about the directory, and a scan that cannot see an entry cannot make it.
 */
const svgsUnder = (rel) => {
  const abs = join(ROOT, rel)
  const out = { files: [], irregular: [] }
  let entries
  try { if (!lstatSync(abs).isDirectory()) return out; entries = readdirSync(abs, { withFileTypes: true }) } catch { return out }
  for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (e.isDirectory()) {
      const nested = svgsUnder(`${rel}/${e.name}`)
      out.files.push(...nested.files.map((p) => `${e.name}/${p}`))
      out.irregular.push(...nested.irregular.map((p) => ({ ...p, rel: `${e.name}/${p.rel}` })))
      continue
    }
    if (!e.name.endsWith('.svg')) continue
    if (e.isFile()) out.files.push(e.name)
    else out.irregular.push({ rel: e.name, kind: e.isSymbolicLink() ? 'a symlink' : 'not a regular file' })
  }
  return out
}

let assetsManifest = null, assetsManifestError = null, assetsModule = null, assetsImportError = null, assetsRendered = null
if (assetsCfg && !disabled.assets) {
  if (exists(assetsManifestPath)) {
    try { assetsManifest = JSON.parse(read(assetsManifestPath)) } catch (e) { assetsManifestError = e.message }
  }
  if (exists(assetsGeneratorPath)) {
    // The one import of repo-owned code in this file. It is what turns "we regenerate the
    // artwork" from a habit into a checked property; the header states what it can and cannot
    // prove. A generator that throws on import is reported as such, never swallowed.
    //   IMPORTED ONLY FROM A REGULAR FILE. Node resolves the module's symlinks, so a linked
    // generator executes code from another checkout with this repo's manifest, and every "it
    // re-renders identical" verdict below would be about an engine this repo does not commit.
    let linked = false
    try { linked = !lstatSync(join(ROOT, assetsGeneratorPath)).isFile() } catch { /* judged as absent below */ }
    if (linked) assetsImportError = `${assetsGeneratorPath} is not a regular file, so it was not imported: the module Node would load lives somewhere else, and every drift verdict here would be about an engine this repo does not commit at this path`
    else try { assetsModule = await import(pathToFileURL(join(ROOT, assetsGeneratorPath)).href) } catch (e) { assetsImportError = e.message }
  }
  // Rendered once, because two checks need it and the second one asks a question about the pages
  // rather than about the manifest: which READMEs already carry a generated H1 that this manifest
  // no longer produces.
  if (assetsManifest !== null && typeof assetsModule?.render === 'function') {
    try { assetsRendered = assetsModule.render(assetsManifest) } catch { assetsRendered = null }
  }
}

const unsourcedPills = []
if (!assetsCfg) {
  skipCheck('RS-assets', 'no identity assets declared ("assets": false); set "assets" once a repo generates its banners and pills from a manifest')
} else if (disabled.assets) {
  skipCheck('RS-assets', `disabled in config: ${disabled.assets}`)
} else {
  check(`RS-assets ${assetsManifestPath} declares a complete, readable identity`, () => {
    assert.ok(exists(assetsManifestPath), `${assetsManifestPath} does not exist, but "assets" is declared in .repo-standard.json`)
    regularFile(assetsManifestPath, 'it is the declaration every asset and every generated line on the front page is rendered from')
    regularFile(assetsGeneratorPath, 'the lint imports it and re-renders this manifest through it')
    assert.ok(assetsManifestError === null, `${assetsManifestPath} is not valid JSON: ${assetsManifestError}`)
    const m = assetsManifest
    assert.equal(m.version, 1, `${assetsManifestPath} "version" must be the number 1 (got ${JSON.stringify(m.version)})`)
    const brand = m.brand
    assert.ok(brand && typeof brand === 'object' && !Array.isArray(brand), `${assetsManifestPath} needs a "brand" object`)
    for (const k of ['name', 'tagline', 'eyebrow']) {
      assert.ok(typeof brand[k] === 'string' && brand[k].trim(), `${assetsManifestPath} "brand.${k}" must be a non-empty string`)
    }
    // homepage is optional on purpose: a repo with no remote and no product site has nowhere for
    // the banner to point, and a link to an invented destination is the same fabricated claim as
    // a CI badge for a workflow that does not exist. Declared, it has to be real.
    assert.ok(brand.homepage === undefined || (typeof brand.homepage === 'string' && brand.homepage.trim()),
      `${assetsManifestPath} "brand.homepage" is optional, but a declared one must be a non-empty URL: omit it rather than pointing the banner nowhere`)
    const palette = brand.palette
    assert.ok(palette && typeof palette === 'object' && !Array.isArray(palette), `${assetsManifestPath} needs a "brand.palette" object of the ${ASSET_ROLES.length} roles`)
    for (const role of ASSET_ROLES) {
      assert.ok(HEX_RE.test(String(palette[role])), `${assetsManifestPath} "brand.palette.${role}" must be a hex colour (got ${JSON.stringify(palette[role])}): a half-declared palette renders silently wrong`)
    }
    const extraRoles = Object.keys(palette).filter((k) => !isComment(k) && !ASSET_ROLES.includes(k))
    assert.deepEqual(extraRoles, [], `${assetsManifestPath} "brand.palette" carries unknown role(s) ${extraRoles.join(', ')}: a role the generator never reads is a colour nobody will ever see change`)
    // Contrast is enforced, not assumed: a palette derived from someone else's design tokens
    // can be beautiful and still put 2:1 text on the banner of every folder in the repo.
    for (const [fg, bg] of CONTRAST_PAIRS) {
      const ratio = contrastRatio(palette[fg], palette[bg])
      assert.ok(ratio >= CONTRAST_FLOOR, `${assetsManifestPath}: ${fg} (${palette[fg]}) on ${bg} (${palette[bg]}) is ${ratio.toFixed(2)}:1, below the ${CONTRAST_FLOOR}:1 floor (WCAG 2.2 AA for normal text); pick a lighter ${fg} or a darker ${bg}`)
    }
    const slugs = (m.banners ?? []).map((b) => b?.slug)
    assert.equal(new Set(slugs).size, slugs.length, `${assetsManifestPath} repeats a banner slug; one asset per slug`)
    for (const [i, b] of (m.banners ?? []).entries()) {
      for (const k of ['slug', 'title', 'desc']) assert.ok(typeof b?.[k] === 'string' && b[k].trim(), `${assetsManifestPath} "banners[${i}].${k}" must be a non-empty string`)
      assert.match(String(b.slug), /^[a-z0-9][a-z0-9-]*$/, `${assetsManifestPath} "banners[${i}].slug" must be lower-case kebab`)
      if (b.dir !== undefined) {
        assert.ok(typeof b.dir === 'string', `${assetsManifestPath} "banners[${i}].dir" must be a directory path inside the repo`)
        manifestPath(b.dir, `banners[${i}].dir`)
      }
    }
    for (const [i, b] of (m.badges ?? []).entries()) {
      for (const k of ['label', 'endpoint', 'href']) assert.ok(typeof b?.[k] === 'string' && b[k].trim(), `${assetsManifestPath} "badges[${i}].${k}" must be a non-empty string`)
      assert.ok(!/^https?:/i.test(String(b.endpoint)), `${assetsManifestPath} "badges[${i}].endpoint" is the shields path after the host, not a full URL: the palette styling is appended here, so the repo cannot hand-write a URL that drifts from its own colours`)
      // A RELATIVE badge href is a link this repo owns, and it had no containment rule and no
      // existence rule at all: "../../etc/passwd" and a target that simply does not exist both
      // passed. Held to exactly what `pills[].href` is held to, because it is the same claim in
      // the same row of the same page.
      const href = String(b.href).trim()
      if (!/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith('#') && !href.startsWith('/')) {
        const target = posixJoin(dirname(DOC.readme) === '.' ? '' : dirname(DOC.readme), href.split('#')[0].split('?')[0])
        manifestPath(target, `badges[${i}].href (which resolves to ${target})`)
        assert.ok(exists(target), `${assetsManifestPath}: badge "${b.label}" links to "${href}", which resolves to ${target} and there is no such file. A badge href is written relative to ${DOC.readme}, not to the repo root`)
      }
      assert.ok(!href.startsWith('/'), `${assetsManifestPath}: badge "${b.label}" links to "${href}", and a leading slash makes it a SITE path GitHub resolves against the domain rather than against ${DOC.readme}. Write it relative to the README, or give it the full URL`)
    }
    const files = (m.pills ?? []).map((p) => p?.file)
    assert.equal(new Set(files).size, files.length, `${assetsManifestPath} repeats a pill filename; one asset per file`)
    for (const [i, p] of (m.pills ?? []).entries()) {
      for (const k of ['file', 'label', 'value']) assert.ok(typeof p?.[k] === 'string' && p[k].trim(), `${assetsManifestPath} "pills[${i}].${k}" must be a non-empty string`)
      assert.match(String(p.file), /^[a-z0-9][a-z0-9-]*\.svg$/, `${assetsManifestPath} "pills[${i}].file" must be a lower-case kebab .svg filename`)
      assert.ok(['accent', 'alt'].includes(p.scheme), `${assetsManifestPath} "pills[${i}].scheme" must be "accent" or "alt" (got ${JSON.stringify(p.scheme)})`)
      // `href` is optional for the reason `brand.homepage` is: a claim with no real destination
      // renders as a bare image rather than pointing somewhere invented. A declared one is a
      // link this repo owns, so a relative target has to resolve. An absolute URL and an in-page
      // anchor are left alone, the same as `badges[].href`.
      if (p.href !== undefined) {
        assert.ok(typeof p.href === 'string' && p.href.trim(), `${assetsManifestPath} "pills[${i}].href" is optional, but a declared one must be a non-empty link target, written as it appears in ${DOC.readme}: omit it rather than pointing the pill nowhere`)
        const href = String(p.href).trim()
        if (!/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith('#') && !href.startsWith('/')) {
          const target = posixJoin(dirname(DOC.readme) === '.' ? '' : dirname(DOC.readme), href.split('#')[0])
          // The RESOLVED target, through the same contract every configured path goes through: a
          // pill href of "../../etc/passwd" resolved out of the repo, was stat'd, and satisfied
          // the existence rule by finding a file this repo does not govern.
          manifestPath(target, `pills[${i}].href (which resolves to ${target})`)
          assert.ok(exists(target), `${assetsManifestPath}: pill ${p.file} links to "${href}", which resolves to ${target} and there is no such file. A pill href is written relative to ${DOC.readme}, not to the repo root, and a claim linking nowhere is worse than a claim linking to nothing`)
        }
        assert.ok(!href.startsWith('/'), `${assetsManifestPath}: pill ${p.file} links to "${href}", and a leading slash makes it a SITE path GitHub resolves against the domain rather than against ${DOC.readme}. Write it relative to the README, or give it the full URL`)
      }
    }
  })

  check(`RS-assets (drift) every asset in ${assetsDir} re-renders byte-identical from the manifest`, () => {
    assert.ok(exists(assetsGeneratorPath), `${assetsGeneratorPath} does not exist, so the manifest cannot be re-rendered and nothing here is verifiable`)
    assert.ok(assetsImportError === null, `${assetsGeneratorPath} could not be imported: ${assetsImportError}`)
    assert.ok(typeof assetsModule?.render === 'function', `${assetsGeneratorPath} must export render(manifest) returning { "<path>": "<svg>" }; the lint re-renders through it`)
    assert.ok(assetsManifest !== null, `${assetsManifestPath} did not parse, so there is nothing to render`)
    const rendered = assetsModule.render(assetsManifest)
    const expectedPaths = Object.keys(rendered).sort()
    // FIRST, because every comparison below reads a path and an entry that is not a regular file
    // reads through to bytes committed somewhere else. This one used to be invisible in both
    // directions: the orphan sweep could not see the entry, and the byte comparison happily
    // compared the render against whatever the link pointed at.
    const onDisk = svgsUnder(assetsDir)
    assert.deepEqual(onDisk.irregular, [], onDisk.irregular.length ? `${assetsDir} carries ${onDisk.irregular.length} .svg entr(ies) that are not regular files: ${onDisk.irregular.map((p) => `${assetsDir}/${p.rel} (${p.kind})`).join(', ')}. The artwork is generated INTO this directory, so a link here is a file this repo would render through onto a target it does not govern, and a scan built on directory entries cannot see it at all` : '')
    for (const rel of expectedPaths) {
      const full = `${assetsDir}/${rel}`
      assert.ok(exists(full), `${full} is declared in the manifest but missing; run \`node ${assetsGeneratorPath}\` from the repo root and commit the result`)
      regularFile(full, 'the artwork is generated into this path and compared byte for byte against it')
      assert.equal(read(full), rendered[rel], `${full} differs from what the manifest renders: the SVG was hand-edited, or the manifest changed without a regenerate. Run \`node ${assetsGeneratorPath}\` from the repo root and commit the result; never hand-edit the artwork`)
    }
    const orphans = onDisk.files.sort().filter((p) => !expectedPaths.includes(p))
    assert.deepEqual(orphans, [], `${assetsDir} carries SVG(s) no manifest entry produces: ${orphans.join(', ')}. A renamed slug leaves the old file behind, and an asset nothing renders is an asset nothing keeps true`)
  })

  check('RS-assets (idiom) every declared README carries the generated markdown, character for character', () => {
    assert.ok(assetsManifest !== null && typeof assetsModule?.bannerH1 === 'function', `${assetsGeneratorPath} must export bannerH1({ title, desc, to, homepage }): the H1 idiom has one source, not one per directory`)
    for (const fn of ['readmeBlock', 'badgeMarkdown']) {
      assert.ok(typeof assetsModule[fn] === 'function', `${assetsGeneratorPath} does not export ${fn}(), so the markdown the artwork sits in has no source to compare against. This generator predates the generated README block: copy the current one from the plugin payload and re-run it, or re-run the identity skill, which does both`)
    }
    const { name, tagline, homepage } = assetsManifest.brand
    const h1Of = (doc) => (read(doc).split('\n').find((l) => /^# +\S/.test(l)) ?? '').trimEnd()
    // The root README's H1 is the banner, so the repo's front page opens with the identity
    // rather than with a heading that happens to sit above one.
    assert.ok(exists(DOC.readme), `${DOC.readme} must exist`)
    regularFile(DOC.readme, 'it is the page the generated identity block is compared against, character for character')
    const rootExpected = assetsModule.bannerH1({ title: name, desc: tagline, to: relFromDoc(DOC.readme, `${assetsDir}/banner.svg`), homepage })
    assert.equal(h1Of(DOC.readme), rootExpected, `${DOC.readme}'s H1 is not the generated banner H1.\n      expected: ${rootExpected}\n      found:    ${h1Of(DOC.readme) || '(no H1)'}`)
    // The CANONICAL directory, so a banner declared for "./docs" is the same directory `docs` is
    // everywhere else in this file. Left raw, it was a no-op to the generator and a coverage
    // failure here, on one manifest, in one run.
    const declaredCarriers = new Map([[DOC.readme, `${assetsDir}/banner.svg`]])
    for (const b of assetsManifest.banners ?? []) {
      if (!b.dir) continue
      const doc = `${manifestCanon(b.dir)}/README.md`
      assert.ok(exists(doc), `${assetsManifestPath} declares a banner for ${b.dir} but ${doc} does not exist; a banner with no README is an asset for a page that was never written`)
      regularFile(doc, 'its H1 is compared byte for byte against the one this manifest generates')
      declaredCarriers.set(doc, `${assetsDir}/banners/${b.slug}.svg`)
      const expected = assetsModule.bannerH1({ title: b.title, desc: b.desc, to: relFromDoc(doc, `${assetsDir}/banners/${b.slug}.svg`), homepage })
      assert.equal(h1Of(doc), expected, `${doc}'s H1 is not the generated banner H1.\n      expected: ${expected}\n      found:    ${h1Of(doc) || '(no H1)'}`)
    }
    /*
     * THE CARRIERS THIS MANIFEST NO LONGER DECLARES, found from the PAGES rather than from the
     * manifest, which is the only direction that can see them.
     *
     * Every loop above iterates the manifest, so removing a banner entry removed the check along
     * with the claim: the SVG was deleted as an orphan, the README kept an H1 pointing at artwork
     * that no longer exists, and the generator's own preview and this gate both went green over a
     * page whose first line is a broken image. `assets.coverage` catches some of these and it is
     * the wrong instrument: it is opt-in, it reaches one level per root, and the reproduction was
     * a repo that had switched it off for that very directory.
     */
    const generatedH1Target = (doc) => {
      const m = (h1Of(doc).match(/!\[[^\]]*\]\(([^)]*)\)/) ?? [])[1]
      if (m === undefined) return null
      const d = m.trim().replace(/^<(.*)>$/, '$1').trim()
      if (!d || /^[a-z][a-z0-9+.-]*:/i.test(d) || d.startsWith('/')) return null
      let decoded = d
      try { decoded = d.split('/').map((x) => decodeURIComponent(x)).join('/') } catch { /* compared as written */ }
      return posixJoin(dirname(doc) === '.' ? '' : dirname(doc), decoded)
    }
    const staleCarriers = []
    for (const f of keptFiles) {
      if (f !== DOC.readme && !/(^|\/)README\.md$/.test(f)) continue
      if (!exists(f) || looksBinary(f)) continue
      const to = generatedH1Target(f)
      if (to === null || !underPath(to, assetsDir)) continue
      const want = declaredCarriers.get(f)
      if (want === undefined) staleCarriers.push(`${f} opens with a generated banner H1 pointing at ${to}, and ${assetsManifestPath} declares no banner for ${dirOf(f) || 'the repo root'}`)
      else if (want !== to) staleCarriers.push(`${f} opens with a banner H1 pointing at ${to}, and this manifest declares ${want} for that page`)
      else if (!exists(to)) staleCarriers.push(`${f} opens with a banner H1 pointing at ${to}, which does not exist`)
    }
    assert.deepEqual(staleCarriers, [], staleCarriers.length ? `${staleCarriers.length} README(s) carry a generated banner H1 this manifest does not produce: ${staleCarriers.join('; ')}. Removing a banner entry deletes its SVG and leaves the page it headed pointing at nothing, and every other rule here iterates the manifest, so the page is the only place the leftover is visible. Re-declare the banner, or replace the H1 with an ordinary heading` : '')
    // A pill is a claim rendered as a badge. One that no README shows is a claim nobody made.
    const rootText = read(DOC.readme)
    for (const p of assetsManifest.pills ?? []) {
      const to = relFromDoc(DOC.readme, `${assetsDir}/pills/${p.file}`)
      assert.ok(rootText.includes(to), `${assetsManifestPath} declares the pill ${p.file} but ${DOC.readme} never shows it (looked for "${to}"); delete the pill, or put it in the badge row`)
    }
    // A live badge is the one claim on the row this repo cannot render, so what is checked is
    // that it still carries the repo's own colours. A status badge whose styling drifted is a
    // small thing; a badge row where half the entries look foreign is what a reader notices.
    for (const b of assetsManifest.badges ?? []) {
      const expected = assetsModule.badgeMarkdown(assetsManifest, b)
      assert.ok(rootText.includes(expected), `${DOC.readme} does not carry the palette-styled badge line for "${b.label}".\n      expected: ${expected}`)
    }
    // Coverage: a directory that grew under a declared root without gaining a banner is exactly
    // the drift this check exists for, because nobody notices a README that was never written.
    const declaredDirs = new Set((assetsManifest.banners ?? []).filter((b) => b.dir).map((b) => manifestCanon(b.dir)))
    for (const root of coverageRoots) {
      assert.ok(existsSync(join(ROOT, root)) && statSync(join(ROOT, root)).isDirectory(), `assets.coverage.roots names "${root || '.'}", which is not a directory`)
      for (const e of readdirSync(join(ROOT, root), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
        if (!e.isDirectory() || e.name.startsWith('.') || WALK_SKIP_DIRS.has(e.name)) continue
        const rel = root ? `${root}/${e.name}` : e.name
        if (coverageIgnore.some((i) => underPath(rel, i))) continue
        // A SUBMODULE is another repository's content, and RS-index already excludes it from the
        // coverage universe on exactly that ground. Demanding a banner and a folder README from it
        // here made the two pillars disagree about the same directory, and the only way to satisfy
        // both was to write a page into a checkout this repo does not own.
        if (gitlinkDirs.has(rel)) continue
        assert.ok(declaredDirs.has(rel), `${rel}/ has no banner entry, but assets.coverage.roots requires every immediate subdirectory of ${root ? `${root}/` : 'the repo root'} to have one; add it to ${assetsManifestPath} with its README, list it in assets.coverage.ignore, or drop the root. Coverage is one level deep per root: name a nested directory as its own root to police inside it`)
      }
    }
    // Provenance: every pill value is re-read from the file it claims to come from, so a
    // version badge cannot outlive the version it names.
    for (const p of assetsManifest.pills ?? []) {
      if (p.source === false) {
        assert.ok(typeof p.why === 'string' && p.why.trim(), `${assetsManifestPath}: pill ${p.file} declares "source": false without a "why": an unverifiable claim has to say why it is unverifiable`)
        unsourcedPills.push(`${p.file} (${p.why.trim()})`)
        continue
      }
      const s = p.source
      assert.ok(s && typeof s === 'object' && !Array.isArray(s) && typeof s.file === 'string', `${assetsManifestPath}: pill ${p.file} needs a "source" of { file, json } or { file, match }, or "source": false with a "why". Every pill is a claim, and a claim with no source cannot be re-verified`)
      // A pill's PROVENANCE is the one thing that makes it falsifiable, so where it reads from is
      // exactly as load-bearing as any configured path. Sourced from "../sibling/package.json" the
      // pill was re-verified against a repo this gate does not govern, and editing that sibling
      // changed this repo's verdict.
      // The path the contract HANDS BACK, so `"./package.json"` is the file git lists rather than a
      // second spelling nothing else compares equal to.
      const sourceFile = manifestPath(s.file, `pill ${p.file}'s "source.file"`)
      assert.ok(exists(sourceFile), `${assetsManifestPath}: pill ${p.file} reads from ${sourceFile}, which does not exist`)
      regularFile(sourceFile, 'a pill is a claim, and this is the file the claim is re-verified against')
      let truth
      if (typeof s.json === 'string') {
        let parsed
        try { parsed = JSON.parse(read(sourceFile)) } catch (e) { throw new Error(`${assetsManifestPath}: pill ${p.file} reads JSON from ${sourceFile}, which does not parse: ${e.message}`) }
        truth = dottedPath(parsed, s.json)
        assert.ok(truth !== undefined && truth !== null, `${assetsManifestPath}: pill ${p.file} reads "${s.json}" from ${sourceFile}, which has no such key`)
      } else if (typeof s.match === 'string') {
        let re
        try { re = new RegExp(s.match, 'gm') } catch (e) { throw new Error(`${assetsManifestPath}: pill ${p.file} source regex does not compile: ${e.message}`) }
        // Exactly one capture group. Two groups and the resolver silently takes the first, so a
        // pill would be sourced from a substring nobody chose.
        const groups = new RegExp(`${re.source}|`).exec('').length - 1
        assert.equal(groups, 1, `${assetsManifestPath}: pill ${p.file} source regex /${s.match}/ has ${groups} capture group(s); it needs exactly one, because the resolver reads group 1 and would take it silently`)
        const hits = [...read(sourceFile).matchAll(re)]
        assert.ok(hits.length > 0, `${assetsManifestPath}: pill ${p.file} source regex /${s.match}/ matched nothing in ${sourceFile}`)
        // Every match must agree. Otherwise the pill is sourced from whichever line happens to
        // come first, and inserting a line above it silently re-points the claim.
        const captures = [...new Set(hits.map((h) => h[1]))]
        assert.equal(captures.length, 1, `${assetsManifestPath}: pill ${p.file} source regex /${s.match}/ captures ${captures.length} different values in ${s.file} (${captures.map((c) => JSON.stringify(c)).join(', ')}). The first one would win, so the claim moves when the file is reordered: narrow the regex until it matches one thing`)
        truth = captures[0]
      } else {
        throw new Error(`${assetsManifestPath}: pill ${p.file} source needs either "json" (a dotted path) or "match" (a regex with one capture group)`)
      }
      // An EMPTY truth is the hole under the whole provenance claim: `includes('')` is true for
      // every string, so a source that captures nothing would let a pill assert anything at all
      // and still pass. It is refused before the comparison rather than inside it.
      assert.ok(String(truth).trim() !== '', `${assetsManifestPath}: pill ${p.file} resolves to an empty value from ${s.file}, which would let the pill claim anything: every string contains the empty string. Point the source at something that actually says the value`)
      // The pill may decorate what it sources (18 becomes "18+"), but the sourced value has to
      // survive as a WHOLE TOKEN. Bare substring matching let a truth of "90" pass a value of
      // "1990%", which is a coincidence dressed as a verified claim.
      const bounded = new RegExp(`(^|[^a-z0-9])${String(truth).trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i')
      assert.ok(bounded.test(String(p.value)), `${assetsManifestPath}: pill ${p.file} shows "${p.value}" but ${s.file} says "${truth}"; regenerate the pill after bumping the source, or the badge advertises a version the repo no longer is. The sourced value has to appear whole in the pill, so a longer number cannot swallow a shorter one`)
    }
    // Last, the ARRANGEMENT, which is the part that goes wrong quietly. Everything above passes
    // on a front page whose pills sit left-aligned, in a different order, under a banner that
    // spans the width, because each of those assertions only asks whether a line is present
    // somewhere. What a reader actually sees is the block: the banner, then a centred row of
    // claims, then the live badge on its own line. So the generator emits the arrangement and
    // the lint compares it byte for byte, exactly as it does the artwork.
    //   It runs last on purpose. Every specific cause above (a stale pill, a drifted badge, a
    // missing asset) also changes this block, and "the block does not match" is the worst of
    // those diagnoses. Reported here, it is what is left when nothing more specific was wrong.
    const expectedBlock = assetsModule.readmeBlock(assetsManifest, { assets: relFromDoc(DOC.readme, assetsDir) })
    assert.ok(rootText.includes(expectedBlock), `${DOC.readme} does not open with the generated identity block. Run \`node ${assetsGeneratorPath}\` from the repo root and paste what it prints, whole; the pieces being present somewhere on the page is not the same as the page being arranged.\n      expected:\n${expectedBlock.split('\n').map((l) => `        ${l}`).join('\n')}`)
    // A derived palette records the token it was read from. Re-reading it turns "these are our
    // brand colours" into a fact the build re-checks, so a rebrand cannot leave the banners
    // quietly representing the old product.
    const ps = assetsManifest.paletteSource
    if (ps && ps.kind === 'derived') {
      const roles = ps.roles ?? {}
      assert.ok(Object.keys(roles).length > 0, `${assetsManifestPath}: paletteSource.kind is "derived" but no role records where it came from; derived means traceable, or it means nothing`)
      for (const [role, src] of Object.entries(roles)) {
        assert.ok(ASSET_ROLES.includes(role), `${assetsManifestPath}: paletteSource.roles has an unknown role "${role}"`)
        assert.ok(src && typeof src.file === 'string' && typeof src.token === 'string' && typeof src.value === 'string', `${assetsManifestPath}: paletteSource.roles.${role} must record { file, token, value, transform }`)
        // Through the same contract every other manifest path goes through, and it was the one
        // that never had it. A palette traced to "../sibling/tokens.css" was re-verified against a
        // design system this repo does not govern, and editing that sibling changed this repo's
        // verdict: the whole point of recording provenance, pointed out of the repo.
        const tokenFile = manifestPath(src.file, `paletteSource.roles.${role}.file`)
        assert.ok(exists(tokenFile), `${assetsManifestPath}: paletteSource.roles.${role} was read from ${tokenFile}, which no longer exists`)
        regularFile(tokenFile, 'a derived palette is only traceable while the token file it names is the one this repo commits')
        const line = read(tokenFile).split('\n').find((l) => l.includes(src.token) && l.toLowerCase().includes(src.value.toLowerCase()))
        assert.ok(line, `${assetsManifestPath}: paletteSource.roles.${role} recorded ${src.token} = ${src.value} in ${src.file}, and no line there still says both. The design identity moved: re-derive the palette and regenerate, or the banners keep showing a brand that changed`)
      }
    }
  })
}
for (const p of unsourcedPills) skipCheck('RS-assets (pill provenance)', `${p}: stated, not verified`)

// ───────────────────────────────────────────────────────────────────────── RS-about
// The About panel is the first thing a stranger reads about a repo, and until something governs
// it, it is the last thing anyone updates. It also lives on someone else's server, and this lint
// takes no network by design, so the property it can actually hold is the offline half: the
// description a repo RECORDED as synced still matches the tagline its own README carries. Change
// the tagline and this goes red with "re-sync" as the fix, which is the drift that actually
// happens. Whether GitHub is serving that text at this instant is a question only the skill can
// ask, and the check says so rather than implying it knows.
if (!aboutCfg) {
  if (!disabled.about) skipCheck('RS-about', 'no GitHub About recorded ("github.about": false), so nothing here governs the panel a stranger reads first')
  else skipCheck('RS-about', `disabled in config: ${disabled.about}`)
} else {
  gate('about', 'RS-about the recorded GitHub About still matches this repo\'s own front page', () => {
    assert.ok(exists(DOC.readme), `${DOC.readme} must exist`)
    // The tagline is the repo's one-line description of itself, already held to the readme and
    // prose checks. Deriving the About from anywhere else would give a repo two front pages.
    const rm = stripFences(read(DOC.readme)).replace(/<!--[\s\S]*?-->/g, '')
    const h1 = [...rm.matchAll(/^# +.+$/gm)][0]
    assert.ok(h1, `${DOC.readme} must have an H1 for the tagline to follow`)
    // The tagline is the first BOLD SPAN after the H1, and it may wrap across lines. Reading the
    // first line instead would cut a wrapped tagline mid sentence and compare against a string
    // with a stray `**` in it. This is a deliberate twin of harness/github-about.mjs, which
    // derives the same value for the sync; a standing test fails the build if they disagree,
    // because a check that reads the tagline differently from the engine that wrote it would
    // redden on prose nobody touched.
    const bold = rm.slice(h1.index + h1[0].length).match(/\*\*([\s\S]+?)\*\*/)
    const tagline = bold ? bold[1].replace(/\s+/g, ' ').trim() : ''
    assert.equal(aboutCfg.description.trim(), tagline,
      `the recorded GitHub About description has gone stale against ${DOC.readme}'s tagline. Re-sync it, or the panel keeps describing a repo that has moved on.\n      recorded: ${aboutCfg.description.trim()}\n      tagline:  ${tagline}`)
  })
  // What this check cannot see is said out loud rather than left for someone to assume.
  if (!disabled.about) {
    skipCheck('RS-about (live panel)', 'this lint takes no network, so what GitHub is serving right now is unverified here; re-running the scaffold skill is what re-syncs it')
  }
}

// ──────────────────────────────────────────────────────────────────────── RS-ignore
// The trust ruleset. Two properties, both structural: a secrets file can never BECOME
// trackable, and a declared generated path never pollutes the tree. This reads ignore RULES and
// the tracked file LIST. It never reads file contents looking for credentials, because secret
// scanning is a different product and pretending otherwise would be the more dangerous claim.
//
// The pattern matcher covers the gitignore forms these probes need: negation, a leading slash
// or an internal slash to anchor, a trailing slash for directory-only, `*`, `?`, and `**`, with
// last-match-wins ordering and git's own rule that a negation cannot re-include a file whose
// parent directory is excluded. It is not a general-purpose gitignore engine, and it is only
// ever asked about paths this check names.
const ignoreRuleFor = (raw) => {
  let p = raw.trim()
  const negate = p.startsWith('!')
  if (negate) p = p.slice(1)
  const dirOnly = p.endsWith('/')
  if (dirOnly) p = p.slice(0, -1)
  const anchored = p.slice(0, -1).includes('/') || p.startsWith('/')
  if (p.startsWith('/')) p = p.slice(1)
  const body = p.split('/').map((seg) => seg
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\u0000/g, '.*')).join('/')
  let re
  try { re = new RegExp(`^${body}$`) } catch { re = null }
  return { negate, dirOnly, anchored, re }
}
const ignoreMatches = (rule, path, isDir) => {
  if (rule.re === null) return false
  if (rule.dirOnly && !isDir) return false
  if (rule.anchored) return rule.re.test(path)
  const segs = path.split('/')
  for (let i = 0; i < segs.length; i++) if (rule.re.test(segs.slice(i).join('/'))) return true
  return false
}
const ignoreVerdict = (rules, path, isDir) => {
  const segs = path.split('/')
  for (let depth = 1; depth <= segs.length; depth++) {
    const sub = segs.slice(0, depth).join('/')
    const asDir = depth < segs.length ? true : isDir
    let verdict = null, by = null
    for (const r of rules) if (ignoreMatches(r.rule, sub, asDir)) { verdict = !r.rule.negate; by = r }
    if (verdict === true) return { ignored: true, by }
    if (depth === segs.length) return { ignored: verdict === true, by }
  }
  return { ignored: false, by: null }
}
const parseIgnoreFile = (text) => text.split('\n')
  .map((l, i) => ({ n: i + 1, raw: l.replace(/\r$/, '') }))
  .filter(({ raw }) => raw.trim() && !raw.trimStart().startsWith('#'))
  .map((l) => ({ ...l, rule: ignoreRuleFor(l.raw) }))

const secretExamples = new Set([...SECRET_EXAMPLES, ...ignoreAllowExamples])
const isSecretName = (base) => /^\.env(\.[^/]+)?$/.test(base) && !secretExamples.has(base)
// Tracked-file evidence needs git. Without it the rules leg still runs and this leg says so.
const trackedFiles = (() => {
  try { return execFileSync('git', ['ls-files', '--cached'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean) } catch { return null }
})()

gate('ignore', `RS-ignore ${ignoreFile} keeps secrets unstageable and declared build output out of the tree`, () => {
  assert.ok(exists(ignoreFile), `${ignoreFile} does not exist, and a repo with no ignore rules cannot stop a .env from being committed; install the repo-standard ignore ruleset`)
  const rules = parseIgnoreFile(read(ignoreFile))
  for (const probe of SECRET_PROBES) {
    const v = ignoreVerdict(rules, probe, false)
    assert.ok(v.ignored, v.by
      ? `${ignoreFile}:${v.by.n} re-exposes ${probe} through the negation "${v.by.raw}". The only names a negation may re-expose are the example files (${[...secretExamples].join(', ')}), because those carry placeholders instead of values`
      : `${ignoreFile} does not ignore ${probe}. A bare ".env" rule leaves every variant open, which is exactly where real credentials live. Add:\n        .env\n        .env.*\n        !.env.example`)
  }
  for (const g of ignoreGenerated) {
    const v = ignoreVerdict(rules, g.path, true)
    assert.ok(v.ignored, `${ignoreFile} does not ignore the declared generated path "${g.raw}" (ignore.generated); build output in the diff is noise hiding signal${v.by ? `; the last rule to match was ${ignoreFile}:${v.by.n} "${v.by.raw}"` : ''}`)
  }
})

if (disabled.ignore) {
  // the disable already printed above; nothing further to say
} else if (trackedFiles === null) {
  skipCheck('RS-ignore (tracked leg)', 'git is unavailable here, so what is actually COMMITTED cannot be checked; the ignore rules were')
} else {
  check('RS-ignore (tracked leg) no secret file and no declared build output is already committed', () => {
    const leaked = trackedFiles.filter((f) => isSecretName(f.split('/').pop()))
    assert.deepEqual(leaked, [], `these files are tracked despite the ignore rules: ${leaked.join(', ')}. Ignoring a path has no effect on one git already tracks, so rotate whatever was in them and \`git rm --cached\` the file`)
    for (const g of ignoreGenerated) {
      const inside = trackedFiles.filter((f) => underPath(f, g.path))
      assert.deepEqual(inside, [], `${inside.length} tracked file(s) under the declared generated path "${g.raw}": ${inside.slice(0, 5).join(', ')}${inside.length > 5 ? ', ...' : ''}. Ignoring a path does nothing about what is already committed`)
    }
  })
}

console.log(`\n${pass} passed, ${fail} failed${skip ? `, ${skip} skipped (each named above; a skip is visible, never silent)` : ''}`)
process.exit(fail ? 1 : 0)

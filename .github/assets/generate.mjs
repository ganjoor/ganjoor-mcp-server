#!/usr/bin/env node
/*
 * generate.mjs: the deterministic README asset generator.
 *
 * Installed by the repo-standard-toolkit identity skill, owned by THIS repo from then on. It
 * renders every banner and pill SVG from `manifest.json` beside it, with Node built-ins alone:
 * same manifest in, byte-identical SVGs out, forever. Run from the repo root:
 *
 *     node .github/assets/generate.mjs            render and write
 *     node .github/assets/generate.mjs --check    render in memory, report what WOULD change,
 *                                                 write nothing (exit 1 when anything would)
 *
 * `--check` exists because the write used to come before the comparison. On an upgrade, a
 * generator whose geometry moved by one path command rewrote every SVG in the tree and the
 * operator learned which ones from `git diff`, after the bytes had landed on files they may have
 * been holding uncommitted. Render, compare, show the plan, then apply it.
 *
 * THE PLAN IS THE WHOLE CHANGE SET, and it twice was not. `ENGINE NEW`/`ENGINE CHANGED` names this
 * file's own replacement, which is the FIRST write the approved sequence performs and which used to
 * appear in neither the list nor the exit code; and a `STALE` line names a README still heading a
 * banner the manifest no longer declares, which every manifest-driven loop here was blind to. This
 * program never copies itself and never edits a page: the plan says so, and the apply repeats it.
 *
 * IT ALSO WRITES AND DELETES, so where it does that is checked before anything moves. The assets
 * directory has to sit inside `--repo`, and every path read or written has to be a REGULAR FILE at
 * the path it is named by: a symlinked asset is invisible to a directory scan and is a file this
 * program would render straight through onto whatever it points at.
 *
 * The visual system is fixed geometry over brand inputs. Dimensions, orb drifts, wave-band
 * timings, the animated wave-edge mask, the hairline grid: all constant, so two repos with
 * different palettes are recognizably the same family. What varies is `brand` (name, tagline,
 * eyebrow, homepage) and a 15-role `palette`. The roles are named for their JOB in the artwork,
 * never for a colour, which is what lets one geometry carry a forest identity, a violet one, or
 * a neutral slate without a single line changing here.
 *
 * Three kinds of export, and the split matters:
 *   render(manifest)  → { "<relative path>": "<svg source>" } for every declared asset. PURE:
 *                       no writes, no clock, no randomness. The committed lint imports this and
 *                       compares its output to the committed bytes, which is what makes
 *                       "regenerate and nothing changes" an enforced property instead of a habit.
 *   readmeBlock(),    → the MARKDOWN the artwork lands in, generated for the same reason the
 *   bannerH1(),         artwork is. Where a banner goes wrong the page looks wrong; where the
 *   badgeMarkdown()     arrangement goes wrong it looks nearly right, which is worse. The lint
 *                       compares these bytes too.
 *   ROLES, GEOMETRY   → the vocabulary the lint, the palette engine, and the preview share.
 * Writing happens ONLY when this file is run directly (the main guard at the bottom), so an
 * import can never touch the tree.
 *
 * Adding a folder README: add a `banners` entry to manifest.json, run this, and use the H1 the
 * bannerH1() helper prints. The lint enforces that exact line, so there is one idiom, not a
 * house style per directory.
 *
 * Dependency-free: Node built-ins only.
 */

import { mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, existsSync, statSync, realpathSync, lstatSync, readlinkSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// The generator version, printed by the CLI and read by harness/sense-state.mjs to direct a
// re-run (upgrade / downgrade / local-edit) exactly the way the lint's own constant does. An
// acceptance test locks it to the plugin manifest version; keep the line's exact shape.
export const REPO_STANDARD_ASSETS_VERSION = '0.8.0'

// ─────────────────────────────────────────────────────────────────── the shared vocabulary

/*
 * The 15 palette roles, each named for the job it does in the artwork. A palette supplies all
 * of them as `#rgb` or `#rrggbb`; the lint rejects a manifest that is missing one or carries a
 * value that is not a hex colour, because a half-declared palette renders silently wrong.
 */
export const ROLES = [
  'groundDeep',   // gradient stop 0: the deepest corner of the ground
  'groundMid',    // gradient stop 0.45: the lift through the middle
  'ground',       // gradient stop 1, and the pill label plate
  'waveNear',     // the near wave band along the bottom edge
  'waveFar',      // the far wave band, counter-scrolling against it
  'text',         // headline text on the ground
  'textMuted',    // subtitle and pill-label text on the ground
  'rim',          // the hairline grid stroke
  'accent',       // primary accent: prism-bar start, first orb
  'accentAlt',    // secondary accent: prism-bar end, eyebrow, third orb
  'accentSoft',   // tertiary muted accent: the large background orb
  'pillAccentBg', // pill scheme "accent": value plate
  'pillAccentFg', // pill scheme "accent": value text
  'pillAltBg',    // pill scheme "alt": value plate
  'pillAltFg',    // pill scheme "alt": value text
]

/*
 * Fixed geometry. These numbers are the family resemblance: change one and every repo governed
 * by this generator renders differently on its next run, which is why they live in code under
 * the payload byte-sync rule rather than in anyone's manifest.
 */
export const GEOMETRY = {
  width: 1200,
  rootHeight: 300,
  folderHeight: 150,
  radius: 10,
  gridPitch: 30,
  rootEdgeDur: 22,
  folderEdgeDur: 20,
  pillHeight: 26,
}

export const PILL_SCHEMES = ['accent', 'alt']

const SANS = "ui-sans-serif, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

/*
 * FOUR ESCAPES, BECAUSE THERE ARE FOUR CONTEXTS, and one function was doing all of them.
 *
 * `esc` handled `&`, `<` and `>`, which is exactly right for an XML TEXT NODE and wrong everywhere
 * else it was used. Inside `aria-label="..."` a quote is what ends the attribute, so a tagline of
 *
 *     safe" onload="alert(1)
 *
 * rendered as `<svg ... aria-label="safe" onload="alert(1)">`: an event handler in every banner and
 * every pill this repo ships, written from a hand-edited manifest, and the committed lint then
 * re-rendered the same injected bytes and reported zero drift. Deterministic is not the same as
 * safe. And in MARKDOWN neither escape applies at all: a `]` in an alt text closes the label early,
 * and a space in a destination ends it.
 *
 * So each context gets its own function, named for the context rather than for the characters, and
 * a call site that picks the wrong one is a mistake somebody can see.
 */
// An XML text node: the three characters that can start markup.
const escText = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
/*
 * An XML attribute VALUE: the text-node set plus the DOUBLE quote, which is what ends every
 * attribute this file writes.
 *
 * The apostrophe is deliberately NOT escaped, and that is a decision rather than an oversight.
 * Every attribute here is double-quoted, so a `'` inside one is ordinary text; escaping it would
 * change the rendered bytes of every governed repository whose brand text contains an apostrophe,
 * on upgrade, for no property gained. The invariant that makes this safe is one line long and
 * belongs beside it: a call site that introduces a single-quoted attribute has to escape `'` too,
 * or use this function's double-quoted form.
 */
const escAttr = (s) => escText(s).replaceAll('"', '&quot;')
// A markdown LABEL, the `alt` in `![alt](dest)`: a bracket closes it early and a backslash escapes
// whatever follows. Newlines collapse, because a label is one line by construction.
const mdLabel = (s) => String(s).replace(/[\\[\]]/g, '\\$&').replace(/\r?\n/g, ' ')

/*
 * The alt text for a banner, and the ONLY separator this system uses between a title and its
 * description. It is a colon on purpose: alt text lands in the README as markdown prose, where
 * the repo standard's enterprise writing profile bans the em dash. A generator whose own output
 * fails the repo's prose gate would be a standard arguing with itself.
 */
export const altText = (title, desc) => `${title}: ${desc}`

/*
 * The exact H1 a governed README carries, and the single source of that idiom: the lint builds
 * the expected line with this same shape, the CLI prints it, and the skill pastes it. `to` is
 * the asset path relative to the README that will hold the line.
 *
 * `homepage` is optional, and its absence is not a degraded case. A repo with no remote and no
 * product site has nowhere for the banner to point, and inventing a destination would be the
 * same fabricated claim as a CI badge for a workflow that does not exist. Without one the H1 is
 * the image alone, which renders identically and promises nothing.
 */
/*
 * A DESTINATION AS MARKDOWN WILL READ IT. A path containing a space is not a link: CommonMark 6.6
 * ends an unbracketed destination at the first whitespace, so `![alt](my assets/banner.svg)`
 * renders as literal text and the banner never appears. The angle-bracket form is the one spelling
 * that carries a space, and it is used only where it is needed, so every existing asset directory
 * keeps rendering the exact bytes it does today.
 *   `<` and `>` inside the path would close the bracket form early, so those are percent-encoded;
 * nothing else is, because encoding a whole path would change the bytes of every banner line in
 * every governed repo for the sake of a case that does not arise.
 */
export const linkDest = (to) => {
  const s = String(to)
  if (!/[\s<>]/.test(s)) return s
  return `<${s.replaceAll('<', '%3C').replaceAll('>', '%3E')}>`
}
export const bannerH1 = ({ title, desc, to, homepage }) => {
  const img = `![${mdLabel(altText(title, desc))}](${linkDest(to)})`
  // The homepage is a DESTINATION, held to what every other destination here is held to. Written
  // raw, a homepage carrying a space ended the link at the space and left the rest of the URL as
  // prose beside a banner that pointed nowhere.
  return homepage ? `# [${img}](${linkDest(homepage)})` : `# ${img}`
}

/*
 * Live badges. A pill is a fact this repo can render, so it is rendered here and the lint
 * re-reads its source forever. A build status is not that: it changes without the repo changing,
 * and a locally rendered "passing" would be a claim that can never go red, which is the exact
 * failure this toolkit exists to prevent. So the status stays live and third-party, and what the
 * palette governs is how it LOOKS, which is enough to make one row out of two kinds of thing.
 *
 * Two honest limits, both stated rather than designed around. A third-party renderer will never
 * be pixel-identical to a local one, so the family resemblance is the colour and the label, not
 * the height. And shields draws its value text white, so a light plate would be unreadable: live
 * badges always take the accent scheme, and that is the one place the palette cannot be applied
 * freely.
 */
export const badgeUrl = (palette, { label, endpoint }) => {
  const strip = (hex) => String(hex).replace('#', '')
  const sep = endpoint.includes('?') ? '&' : '?'
  const params = `style=flat&label=${encodeURIComponent(label)}&labelColor=${strip(palette.ground)}&color=${strip(palette.pillAccentBg)}`
  return `https://img.shields.io/${endpoint}${sep}${params}`
}
export const badgeMarkdown = (manifest, badge) =>
  `[![${mdLabel(badge.label)}](${badgeUrl(manifest.brand.palette, badge)})](${linkDest(badge.href)})`

/*
 * The whole top of a governed README as one generated string: the banner H1, then the centred
 * block holding the pill row and any live badge line.
 *
 * It exists because the pieces are easy and the ARRANGEMENT is not. A pill row written by hand
 * sits left-aligned under a banner that spans the page; the `<div align="center">` wrapper needs
 * a blank line on each side or the pills render as literal text; and the badge line has to sit
 * apart from the pills for the reason `badgeMarkdown` gives above. Each of those is a detail
 * nobody remembers twice, so the generator emits the arrangement instead of describing it, and
 * the lint compares the result byte for byte, the same as it does the artwork.
 *
 * `assets` is the assets directory relative to the README that will carry the block. `banner.svg`
 * and `pills/<file>` are fixed names inside it: the same keys `render()` produces.
 *
 * A pill's `href` is optional for the reason `brand.homepage` is. A claim with no real
 * destination renders as a bare image rather than pointing somewhere invented. And a manifest
 * with no pills and no badges gets the H1 alone, because a centred div around nothing is
 * decoration for a row that was never written.
 */
export const readmeBlock = (manifest, { assets }) => {
  const dir = String(assets ?? '').replace(/\/+$/, '')
  const at = (rel) => (dir === '' || dir === '.' ? rel : `${dir}/${rel}`)
  const { name, tagline, homepage } = manifest.brand
  const h1 = bannerH1({ title: name, desc: tagline, to: at('banner.svg'), homepage })
  // The alt text is the whole claim, not the label: a reader who cannot see the plate gets
  // nothing useful from "Version". The separator is the one this system already uses everywhere.
  const pills = (manifest.pills ?? []).map((p) => {
    const img = `![${mdLabel(altText(p.label, p.value))}](${linkDest(at(`pills/${p.file}`))})`
    return p.href ? `[${img}](${linkDest(p.href)})` : img
  })
  const badges = (manifest.badges ?? []).map((b) => badgeMarkdown(manifest, b))
  if (!pills.length && !badges.length) return h1
  const rows = [pills, badges].filter((g) => g.length).map((g) => g.join('\n'))
  return `${h1}\n\n<div align="center">\n\n${rows.join('\n\n')}\n\n</div>`
}

// ────────────────────────────────────────────────────────────────────────── shared defs

/*
 * Wave geometry: the mask's white waveform reveals everything above a moving edge, so the
 * artwork dissolves into the page along a slow horizontal drift instead of ending at a hard
 * rectangle. The two edge heights are the root and folder variants of the same curve.
 */
function defs(palette, h, edgeDur) {
  const P = palette
  const isRoot = h === GEOMETRY.rootHeight
  const edgeY = isRoot ? 250 : 126
  const edgeQ = isRoot ? 234 : 117
  return `  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${GEOMETRY.width}" y2="${h}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${P.groundDeep}"/>
      <stop offset="0.45" stop-color="${P.groundMid}"/>
      <stop offset="1" stop-color="${P.ground}"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${P.accent}"/>
      <stop offset="1" stop-color="${P.accentAlt}"/>
    </linearGradient>
    <radialGradient id="orbAccent" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${P.accent}" stop-opacity="0.20"/>
      <stop offset="1" stop-color="${P.accent}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orbAlt" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${P.accentAlt}" stop-opacity="0.15"/>
      <stop offset="1" stop-color="${P.accentAlt}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="orbSoft" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${P.accentSoft}" stop-opacity="0.13"/>
      <stop offset="1" stop-color="${P.accentSoft}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" width="${GEOMETRY.gridPitch}" height="${GEOMETRY.gridPitch}" patternUnits="userSpaceOnUse">
      <path d="M ${GEOMETRY.gridPitch} 0 L 0 0 0 ${GEOMETRY.gridPitch}" fill="none" stroke="${P.rim}" stroke-opacity="0.06" stroke-width="1"/>
    </pattern>
    <clipPath id="round"><rect width="${GEOMETRY.width}" height="${h}" rx="${GEOMETRY.radius}"/></clipPath>
    <mask id="waveEdge">
      <path d="M -1200 -20 L -1200 ${edgeY} Q -1050 ${edgeQ} -900 ${edgeY} T -600 ${edgeY} T -300 ${edgeY} T 0 ${edgeY} T 300 ${edgeY} T 600 ${edgeY} T 900 ${edgeY} T 1200 ${edgeY} T 1500 ${edgeY} T 1800 ${edgeY} T 2100 ${edgeY} T 2400 ${edgeY} L 2400 -20 Z" fill="#ffffff">
        <animateTransform attributeName="transform" type="translate" values="-1200 0; 0 0" dur="${edgeDur}s" repeatCount="indefinite"/>
      </path>
    </mask>
  </defs>`
}

// ────────────────────────────────────────────────────────────── root banner (1200x300)

/*
 * Type fitting. The wordmark is centered at a fixed size in the original artwork, which works
 * for a seven-letter brand and overflows the canvas for a real repository name. Rather than
 * asking every project to abbreviate itself, the size is solved from the length: the largest
 * size at or below the design's own that still fits the measured width, with the accent bar
 * following the text it underlines. Deterministic arithmetic, so the same name always renders
 * the same bytes.
 *
 * The advance ratios are conservative averages for the two font stacks at weight 700 to 800.
 * They do not need to be exact, only stable and slightly generous, because the consequence of
 * being wrong is a few pixels of extra margin rather than a clipped wordmark.
 */
const MIN_TEXT_SIZE = 12

/*
 * Size and tracking are solved together against one width budget, and the pair that comes back
 * always fits inside it.
 *
 * The earlier form solved size alone with tracking held fixed, then clamped the result up to a
 * readable floor. Past a certain length that clamp handed back a size the budget could not pay
 * for, and the line ran off BOTH edges of a centred banner while every number in the file still
 * looked reasonable. A floor is the right instinct, since nobody wants a 4px tagline, but it has
 * to buy the width from somewhere. So when the design's tracking cannot be afforded at a
 * readable size, tracking is what gets spent first: this is what the tagline's own comment has
 * always promised, and now the arithmetic does it rather than describing it.
 *
 * Below the floor at zero tracking there is nothing left to spend, so the generator REFUSES.
 * A banner that silently clips the repo's own description is the drift this toolkit exists to
 * catch, and rendering one anyway would be the generator telling the same lie as a stale pill.
 */
const fitText = ({ label, length, max, maxWidth, advance, tracking = 0 }) => {
  const gaps = Math.max(0, length - 1)
  const widthAt = (size, track) => length * size * advance + gaps * track
  const solved = Math.floor((maxWidth - gaps * tracking) / (length * advance))
  if (solved >= MIN_TEXT_SIZE) {
    const size = Math.min(max, solved)
    // Tracking follows the size it bought, so a line that had to shrink does not stay airy.
    const track = !tracking || size >= max ? tracking : Math.max(1, Math.round(tracking * (size / max)))
    return { size, tracking: track }
  }
  const size = Math.max(MIN_TEXT_SIZE, Math.min(max, Math.floor(maxWidth / (length * advance))))
  if (widthAt(size, 0) > maxWidth) {
    const holds = Math.floor(maxWidth / (MIN_TEXT_SIZE * advance))
    throw new Error(`${label} is ${length} characters, which cannot fit a ${maxWidth}px line at a readable size: ${holds} characters is the most it holds at ${MIN_TEXT_SIZE}px. Shorten it, and the banner will render.`)
  }
  // Whatever width the size left over becomes tracking, never more than the design's own.
  const spare = maxWidth - widthAt(size, 0)
  const track = gaps ? Math.min(tracking, Math.floor((spare / gaps) * 100) / 100) : tracking
  return { size, tracking: Math.max(0, track) }
}

const fitSize = (opts) => fitText(opts).size

function rootBanner(manifest) {
  const P = manifest.brand.palette
  const { name, tagline } = manifest.brand
  const sub = escText(String(tagline).toUpperCase())
  const wordmark = String(name)
  const nameSize = fitSize({ label: 'brand.name', length: wordmark.length, max: 112, maxWidth: 1000, advance: 0.62, tracking: 10 })
  const nameWidth = Math.round(wordmark.length * nameSize * 0.62 + (wordmark.length - 1) * 10)
  const barWidth = Math.max(240, Math.min(1000, nameWidth))
  const barX = 600 - barWidth / 2
  // The tagline is tracked out under the bar; long taglines lose tracking before they lose size.
  // Measured at the UPPERCASE advance because that is how it renders: caps are wider than the
  // mixed-case ratio, and measuring the string as typed rather than as drawn was the second half
  // of the overflow this solver had to fix.
  const { size: subSize, tracking: subTracking } = fitText({ label: 'brand.tagline', length: String(tagline).length, max: 17, maxWidth: 1040, advance: 0.62, tracking: 7 })
  return `<svg width="1200" height="300" viewBox="0 0 1200 300" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escAttr(altText(name, tagline))}">
${defs(P, 300, GEOMETRY.rootEdgeDur)}

  <g clip-path="url(#round)" mask="url(#waveEdge)">
    <rect width="1200" height="300" fill="url(#bg)"/>

    <g>
      <circle cx="170" cy="90" r="180" fill="url(#orbAccent)">
        <animateTransform attributeName="transform" type="translate" values="0 0; 60 34; 0 0" dur="26s" repeatCount="indefinite"/>
      </circle>
      <circle cx="1040" cy="230" r="210" fill="url(#orbSoft)">
        <animateTransform attributeName="transform" type="translate" values="0 0; -70 -30; 0 0" dur="32s" repeatCount="indefinite"/>
      </circle>
      <circle cx="960" cy="40" r="150" fill="url(#orbAlt)">
        <animateTransform attributeName="transform" type="translate" values="0 0; -40 44; 0 0" dur="21s" repeatCount="indefinite"/>
      </circle>
      <circle cx="380" cy="290" r="160" fill="url(#orbAlt)" opacity="0.6">
        <animateTransform attributeName="transform" type="translate" values="0 0; 50 -26; 0 0" dur="29s" repeatCount="indefinite"/>
      </circle>
    </g>

    <rect width="1200" height="300" fill="url(#grid)"/>

    <path d="M -1200 300 L -1200 240 Q -1100 226 -1000 240 T -800 240 T -600 240 T -400 240 T -200 240 T 0 240 T 200 240 T 400 240 T 600 240 T 800 240 T 1000 240 T 1200 240 T 1400 240 T 1600 240 T 1800 240 T 2000 240 T 2200 240 T 2400 240 L 2400 300 Z" fill="${P.waveNear}" fill-opacity="0.5">
      <animateTransform attributeName="transform" type="translate" values="0 0; -1200 0" dur="14s" repeatCount="indefinite"/>
    </path>
    <path d="M -1200 300 L -1200 258 L -1050 258 Q -900 240 -750 258 T -450 258 T -150 258 T 150 258 T 450 258 T 750 258 T 1050 258 T 1350 258 T 1650 258 T 1950 258 T 2250 258 T 2550 258 L 2400 300 Z" fill="${P.waveFar}" fill-opacity="0.55">
      <animateTransform attributeName="transform" type="translate" values="-1200 0; 0 0" dur="18s" repeatCount="indefinite"/>
    </path>

    <g font-family="${SANS}" text-anchor="middle">
      <text x="600" y="152" font-size="${nameSize}" font-weight="800" letter-spacing="10" fill="${P.text}">${escText(wordmark)}</text>
      <rect x="${barX}" y="170" width="${barWidth}" height="7" rx="3.5" fill="url(#accent)"/>
      <text x="600" y="210" font-size="${subSize}" font-weight="600" letter-spacing="${subTracking}" fill="${P.accentAlt}">${sub}</text>
    </g>
  </g>
</svg>
`
}

// ──────────────────────────────────────────────────────────── folder banners (1200x150)

function folderBanner(manifest, { title, desc }) {
  const P = manifest.brand.palette
  const t = String(title)
  // Monospace advance is 0.6em, so a deep path fits by shrinking rather than by clipping.
  const titleSize = fitSize({ label: `banner title "${t}"`, length: t.length, max: 46, maxWidth: 1040, advance: 0.6, tracking: 0 })
  const underline = Math.min(1100, Math.round(t.length * titleSize * 0.6 * 1.03))
  const ux = 600 - underline / 2
  // Uppercase advance, for the same reason as the root tagline: this line renders in caps.
  const { size: descSize, tracking: descTracking } = fitText({ label: `banner description for "${t}"`, length: String(desc).length, max: 13, maxWidth: 1040, advance: 0.62, tracking: 5 })
  return `<svg width="1200" height="150" viewBox="0 0 1200 150" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escAttr(altText(title, desc))}">
${defs(P, 150, GEOMETRY.folderEdgeDur)}
  <g clip-path="url(#round)" mask="url(#waveEdge)">
    <rect width="1200" height="150" fill="url(#bg)"/>
    <circle cx="180" cy="40" r="150" fill="url(#orbAccent)">
      <animateTransform attributeName="transform" type="translate" values="0 0; 50 20; 0 0" dur="24s" repeatCount="indefinite"/>
    </circle>
    <circle cx="1020" cy="120" r="170" fill="url(#orbAlt)">
      <animateTransform attributeName="transform" type="translate" values="0 0; -60 -18; 0 0" dur="30s" repeatCount="indefinite"/>
    </circle>
    <rect width="1200" height="150" fill="url(#grid)"/>
    <path d="M -1200 150 L -1200 120 Q -1100 112 -1000 120 T -800 120 T -600 120 T -400 120 T -200 120 T 0 120 T 200 120 T 400 120 T 600 120 T 800 120 T 1000 120 T 1200 120 T 1400 120 T 1600 120 T 1800 120 T 2000 120 T 2200 120 T 2400 120 L 2400 150 Z" fill="${P.waveNear}" fill-opacity="0.5">
      <animateTransform attributeName="transform" type="translate" values="0 0; -1200 0" dur="13s" repeatCount="indefinite"/>
    </path>
    <text x="28" y="28" font-family="${SANS}" font-size="11" font-weight="600" letter-spacing="3" fill="${P.accentAlt}">${escText(manifest.brand.eyebrow)}</text>
    <g text-anchor="middle">
      <text x="600" y="72" font-family="${MONO}" font-size="${titleSize}" font-weight="700" fill="${P.text}">${escText(t)}</text>
      <rect x="${ux}" y="84" width="${underline}" height="5" rx="2.5" fill="url(#accent)"/>
      <text x="600" y="104" font-family="${SANS}" font-size="${descSize}" font-weight="600" letter-spacing="${descTracking}" fill="${P.textMuted}">${escText(String(desc).toUpperCase())}</text>
    </g>
  </g>
</svg>
`
}

// ──────────────────────────────────────────────────────── pills (height 26, two segments)

function pill(manifest, { label, value, scheme }) {
  const P = manifest.brand.palette
  const seg = (s) => Math.max(30, Math.round(String(s).length * 7.2) + 18)
  const lw = seg(label)
  const vw = seg(value)
  const w = lw + vw
  const bg = scheme === 'alt' ? P.pillAltBg : P.pillAccentBg
  const fg = scheme === 'alt' ? P.pillAltFg : P.pillAccentFg
  return `<svg width="${w}" height="26" viewBox="0 0 ${w} 26" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escAttr(label)}: ${escAttr(value)}">
  <clipPath id="r"><rect width="${w}" height="26" rx="4"/></clipPath>
  <g clip-path="url(#r)" font-family="${SANS}" font-size="11" font-weight="700" text-anchor="middle" letter-spacing="0.5">
    <rect width="${lw}" height="26" fill="${P.ground}"/>
    <rect x="${lw}" width="${vw}" height="26" fill="${bg}"/>
    <text x="${lw / 2}" y="17.5" fill="${P.textMuted}">${escText(label)}</text>
    <text x="${lw + vw / 2}" y="17.5" fill="${fg}">${escText(value)}</text>
  </g>
</svg>
`
}

// ──────────────────────────────────────────────────────────────────────────── render

/*
 * The whole asset set for a manifest, keyed by path relative to the assets directory. Pure and
 * total: every declared banner and pill is rendered, nothing else is, and the same manifest
 * always produces the same bytes. The lint compares this map to what is committed.
 */
export function render(manifest) {
  const out = {}
  out['banner.svg'] = rootBanner(manifest)
  for (const b of manifest.banners ?? []) out[`banners/${b.slug}.svg`] = folderBanner(manifest, b)
  for (const p of manifest.pills ?? []) out[`pills/${p.file}`] = pill(manifest, p)
  return out
}

// ─────────────────────────────────────────────────────────────────── CLI (writes only here)

/*
 * Defensive validation for the CLI path only. The committed lint does its own, independent
 * manifest checking: what a repo is held to must never be delegated to a file the repo can
 * edit. This exists so that running the generator by hand fails with a sentence instead of a
 * stack trace or, worse, a silently malformed SVG.
 */
function cliValidate(manifest, repoRoot) {
  const errs = []
  if (!manifest || typeof manifest !== 'object') return ['manifest.json must be a JSON object']
  // Every manifest path this program will FOLLOW, held to the contract the committed lint holds
  // it to. Checked before anything is read, because the whole value of --check is that its answer
  // comes from the tree the operator is looking at.
  const contained = (rel, where) => {
    if (typeof rel !== 'string' || !rel.trim()) return
    // The CANONICAL form, the same one every use site takes, so validation and use cannot disagree
    // about which path was judged.
    if (!containedIn(repoRoot, manifestCanon(rel))) {
      errs.push(`"${where}" is ${JSON.stringify(rel)}, which does not stay inside ${repoRoot}: no leading "/", no "..", no backslashes, no control characters, and nothing in it may be a symlink pointing away. A path that leaves the repo makes this preview's answer depend on a tree the repo does not govern`)
    }
  }
  const brand = manifest.brand
  if (!brand || typeof brand !== 'object') errs.push('"brand" must be an object with name, tagline, eyebrow, homepage, palette')
  else {
    for (const k of ['name', 'tagline', 'eyebrow']) {
      if (typeof brand[k] !== 'string' || !brand[k].trim()) errs.push(`"brand.${k}" must be a non-empty string`)
    }
    if (brand.homepage !== undefined && (typeof brand.homepage !== 'string' || !brand.homepage.trim())) {
      errs.push('"brand.homepage" is optional, but a declared one must be a non-empty URL: omit it rather than pointing the banner nowhere')
    }
    const palette = brand.palette
    if (!palette || typeof palette !== 'object') errs.push('"brand.palette" must be an object of the 15 roles')
    else for (const role of ROLES) {
      if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(palette[role]))) {
        errs.push(`"brand.palette.${role}" must be a hex colour (got ${JSON.stringify(palette[role])})`)
      }
    }
  }
  for (const [i, b] of (manifest.banners ?? []).entries()) {
    for (const k of ['slug', 'title', 'desc']) if (typeof b?.[k] !== 'string' || !b[k].trim()) errs.push(`"banners[${i}].${k}" must be a non-empty string`)
    if (b?.slug !== undefined && !/^[a-z0-9][a-z0-9-]*$/.test(String(b.slug))) errs.push(`"banners[${i}].slug" must be lower-case kebab (got ${JSON.stringify(b.slug)})`)
    // The README this banner heads is READ by --check, so where it lives decides the answer.
    if (b?.dir !== undefined) contained(b.dir, `banners[${i}].dir`)
  }
  // A pill's source and a derived palette's tokens are both re-read here the way the lint re-reads
  // them, so both are held to the same containment rule.
  for (const [i, p] of (manifest.pills ?? []).entries()) {
    if (p?.source && typeof p.source === 'object') contained(p.source.file, `pills[${i}].source.file`)
  }
  if (manifest.paletteSource && typeof manifest.paletteSource === 'object' && manifest.paletteSource.roles && typeof manifest.paletteSource.roles === 'object') {
    for (const [role, src] of Object.entries(manifest.paletteSource.roles)) {
      if (src && typeof src === 'object') contained(src.file, `paletteSource.roles.${role}.file`)
    }
  }
  for (const [i, b] of (manifest.badges ?? []).entries()) {
    for (const k of ['label', 'endpoint', 'href']) if (typeof b?.[k] !== 'string' || !b[k].trim()) errs.push(`"badges[${i}].${k}" must be a non-empty string`)
    if (b?.endpoint !== undefined && /^https?:/i.test(String(b.endpoint))) errs.push(`"badges[${i}].endpoint" is the shields path after the host (e.g. "github/actions/workflow/status/owner/repo/test.yml?branch=main"), not a full URL`)
  }
  for (const [i, p] of (manifest.pills ?? []).entries()) {
    for (const k of ['file', 'label', 'value']) if (typeof p?.[k] !== 'string' || !p[k].trim()) errs.push(`"pills[${i}].${k}" must be a non-empty string`)
    if (p?.file !== undefined && !/^[a-z0-9][a-z0-9-]*\.svg$/.test(String(p.file))) errs.push(`"pills[${i}].file" must be a lower-case kebab .svg filename (got ${JSON.stringify(p.file)})`)
    if (!PILL_SCHEMES.includes(p?.scheme)) errs.push(`"pills[${i}].scheme" must be one of ${PILL_SCHEMES.join(', ')} (got ${JSON.stringify(p?.scheme)})`)
    if (p?.href !== undefined && (typeof p.href !== 'string' || !p.href.trim())) errs.push(`"pills[${i}].href" is optional, but a declared one must be a non-empty link target written as it appears in the README; omit it rather than pointing the pill nowhere`)
  }
  return errs
}

/*
 * THE CONTAINMENT CONTRACT, over the manifest paths the CLI actually follows.
 *
 * The committed lint holds this over the same keys, and the generator held it over none of them.
 * `banners[].dir` of "../outside" made `--check` read a README in a sibling checkout and report on
 * it: planting a satisfying README there changed this repo's answer from "3 of 3 carriers do not
 * match" to "2 of 3". A preview whose verdict is controlled by a tree the repo does not govern is
 * not a preview.
 */
const escapesRepoSpelling = (p) => p.startsWith('/') || /^[A-Za-z]:/.test(p) || p.includes('\\')
  || /[\u0000-\u001f\u007f]/.test(p)
  || p.split('/').some((seg) => seg === '..' || seg === '')
/*
 * ONE CANONICAL FORM for a manifest path, matching the committed lint character for character.
 *
 * A banner declared for `"./docs"` was a NO-OP here (join() normalises the "./" away on the way to
 * the README) and a coverage FAILURE there, because the lint compares the manifest's directory
 * against config paths that have been canonicalised and the manifest's own value never was. One
 * manifest, two verdicts, and neither engine wrong about anything else.
 */
const manifestCanon = (p) => {
  const raw = String(p)
  const spelled = raw.length > 1 ? (raw.replace(/\/+$/, '') || raw) : raw
  return spelled === '.' ? spelled : spelled.replace(/^\.\//, '')
}
// A path this program READS or WRITES has to be a regular file at the path it is named by. A
// symlinked banner.svg vanished from the directory scan (a Dirent for a link is neither a file nor
// a directory), so `--check` reported "nothing changes" and the apply that followed wrote the
// rendered artwork straight through the link onto a file outside the repo. null means absent,
// which is a different answer from substituted.
const isRegularFile = (abs) => { try { return lstatSync(abs).isFile() } catch { return null } }
const containedIn = (root, rel) => {
  if (escapesRepoSpelling(rel)) return false
  const abs = join(root, rel)
  const realOf = (a) => {
    try { return realpathSync(a) } catch { /* missing, or a dangling link */ }
    try { if (lstatSync(a).isSymbolicLink()) return resolve(dirname(a), readlinkSync(a)) } catch { /* not on disk */ }
    return null
  }
  const real = realOf(abs) ?? realOf(dirname(abs))
  if (real === null) return true // nothing on disk anywhere in the chain can leak content
  let rootReal = root
  try { rootReal = realpathSync(root) } catch { /* the plain path is the best there is */ }
  return real === rootReal || real.startsWith(rootReal + sep)
}

/*
 * Run-as-main guard: importing this module must never write to the tree, because the committed
 * lint imports it on every CI run.
 *
 * THE COMPARISON IS BETWEEN TWO FILES, NOT BETWEEN TWO SPELLINGS OF A PATH, and for one release it
 * was the second. Node canonicalises a script's symlinks before running it, so `import.meta.url`
 * names the file on disk, while `process.argv[1]` keeps the path exactly as it was INVOKED. A
 * marketplace installed from a directory source reaches its plugins through a link, so
 * `${CLAUDE_PLUGIN_ROOT}` is a symlink to the checkout and
 * `node <link>/assets/generate.mjs --check` is the ordinary way an upgrade is previewed. The two
 * spellings differ there, the lexical test was false, and this program exited 0 having printed
 * nothing. Exit 0 with an empty plan is what a repo needing no work looks like, so the silence was
 * read as "nothing changes" by the journey that then copied a new engine over the old one.
 *
 * So: the cheap lexical test first, because it answers the common case without touching the disk,
 * and a realpath comparison only when it does not. The realpath leg is wrapped because a path that
 * is not on disk must resolve to NOT MAIN: a guard that throws while deciding whether it may write
 * is a guard that decides nothing, and the safe direction for a program that writes is to stay
 * quiet. `realpathSync` is a Node built-in of long standing, so this holds on Node 18.
 */
const invokedDirectly = Boolean(process.argv[1]) && (() => {
  const self = import.meta.url
  if (self === pathToFileURL(process.argv[1]).href) return true
  try { return realpathSync(fileURLToPath(self)) === realpathSync(process.argv[1]) } catch { return false }
})()
if (invokedDirectly) {
  /*
   * STRICT ARGUMENT PARSING, because this program writes to the tree and the one flag that stops
   * it writing was a substring test.
   *
   * `process.argv.includes("--check")` means a typo is not an error, it is a WRITE.
   * `--chek` rendered every asset and wrote it; so did `--CHECK`; so did any flag this program
   * has never heard of. The operator who typed the flag was asking for the one behaviour they did
   * not get, and they got it on a working tree they had not been told to check.
   *
   * So: every argument must be a flag this program knows, every value-taking flag must be given a
   * value, no flag may be repeated, and a positional argument is an error. Anything else exits 2
   * having written nothing.
   *
   *   --check             render in memory, print the complete plan, write nothing
   *   --assets-dir <dir>  where manifest.json and the SVGs live (default: beside this file)
   *   --repo <dir>        the repo root whose READMEs carry the generated markdown (default: cwd)
   *   --readme <path>     the front page, repo-relative (default: docs.readme from
   *                       .repo-standard.json, else README.md)
   */
  const VALUED = new Set(['--assets-dir', '--repo', '--readme'])
  const BARE = new Set(['--check'])
  const die = (msg) => { console.error(`generate: ${msg}`); process.exit(2) }
  const seen = new Set()
  const opt = {}
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i]
    if (!VALUED.has(a) && !BARE.has(a)) {
      const known = [...BARE, ...VALUED].sort().join(', ')
      die(a.startsWith('-')
        ? `unknown argument "${a}" (known: ${known}). Nothing was written: a flag this program does not recognise is an error rather than a silent no-op, because the flag that stops it writing is one of them`
        : `unexpected argument "${a}": this program takes flags only (${known}). Nothing was written`)
    }
    if (seen.has(a)) die(`"${a}" is given more than once, and the second one would silently win. Nothing was written`)
    seen.add(a)
    if (BARE.has(a)) { opt[a] = true; continue }
    const v = process.argv[i + 1]
    if (v === undefined || v.startsWith('--')) die(`${a} expects a value. Nothing was written`)
    opt[a] = v
    i++
  }
  const check = opt['--check'] === true
  const here = opt['--assets-dir'] ? resolve(opt['--assets-dir']) : dirname(fileURLToPath(import.meta.url))
  const repoRoot = opt['--repo'] ? resolve(opt['--repo']) : process.cwd()
  const readIf = (abs) => { try { return readFileSync(abs, 'utf8') } catch { return null } }
  /*
   * THE ASSETS DIRECTORY HAS TO BE INSIDE THE REPO IT RENDERS FOR, and nothing checked that.
   *
   * `--assets-dir` is a WRITE target: this program creates directories under it, writes every
   * rendered SVG into it, and DELETES the ones the manifest no longer produces. Pointed outside
   * `--repo` it did all three, on a tree the repo does not govern, at the request of a flag whose
   * whole purpose is to let one repo's generator plan another repo's assets. The containment rule
   * the manifest's own paths are held to is the rule this one needed first.
   */
  const hereRel = relative(repoRoot, here).split('\\').join('/')
  if (!containedIn(repoRoot, hereRel || '.')) {
    die(`--assets-dir resolves to ${here}, which is not inside --repo (${repoRoot}). This program WRITES every rendered asset into that directory and DELETES the ones the manifest no longer produces, so it has to be a directory the named repo actually owns. Nothing was written`)
  }
  /*
   * WHICH PAGE IS THE FRONT PAGE, which this program used to answer with a constant.
   *
   * `join(repoRoot, "README.md")` is wrong for every repo that configures `docs.readme`, and both
   * other values are ones the standard explicitly supports. On a repo whose README lives at
   * .github/README.md, `--check` reported the root README MISSING, said two of two carriers did not
   * match, and exited 1: a false failure on a correct repo, with a fix that would have created a
   * second front page. The config is the authority the lint uses, so it is the authority here.
   */
  const SERVED = ['README.md', 'docs/README.md', '.github/README.md']
  let readmeRel = 'README.md'
  if (opt['--readme']) {
    readmeRel = opt['--readme']
    if (!SERVED.includes(readmeRel)) die(`--readme must be one of ${SERVED.join(', ')} (the paths GitHub renders as a front page), got ${JSON.stringify(readmeRel)}`)
  } else {
    const cfgText = readIf(join(repoRoot, '.repo-standard.json'))
    if (cfgText !== null) {
      try {
        const declared = JSON.parse(cfgText)?.docs?.readme
        if (typeof declared === 'string') {
          const canon = declared.replace(/^\.\//, '').replace(/\/+$/, '')
          if (SERVED.includes(canon)) readmeRel = canon
        }
      } catch { /* an unparseable config is the gate's to report, not this program's */ }
    }
  }
  const readmeAbs = join(repoRoot, readmeRel)
  const manifestPath = join(here, 'manifest.json')
  if (isRegularFile(manifestPath) === false) {
    die(`${manifestPath} is not a regular file. Every asset and every generated line on the front page is rendered from it, so a link here means this preview describes a declaration committed somewhere else. Nothing was written`)
  }
  let manifest
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (e) {
    die(`cannot read ${manifestPath}: ${e.message}`)
  }
  const errs = cliValidate(manifest, repoRoot)
  if (errs.length) {
    console.error('generate: manifest.json is not renderable:')
    for (const e of errs) console.error(`  - ${e}`)
    process.exit(2)
  }
  const files = render(manifest)
  /*
   * RENDER, THEN COMPARE, THEN WRITE. This used to write first and let whatever was on disk be
   * discovered afterwards, which is the wrong order for the one moment it matters: an UPGRADE.
   * A generator version that changes a single path command rewrites every SVG in the tree, and the
   * operator found out from `git diff` after the bytes had already landed on top of files they may
   * have been holding uncommitted. `--check` renders to memory and reports the diff without touching
   * anything, so the plan can be reviewed and approved before it is applied.
   */
  const rel = (fromDir, asset) => relative(fromDir, asset).split('\\').join('/')
  // Every .svg entry, INCLUDING the ones a scan built on `isFile()` dropped on the floor. A
  // symlinked asset is neither a file nor a directory to a Dirent, so it was invisible to the
  // orphan sweep, invisible to the change list, and a write target all the same.
  const svgsUnder = (dir, prefix = '') => {
    const out = { files: [], irregular: [] }
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return out }
    for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (e.isDirectory()) {
        const nested = svgsUnder(join(dir, e.name), `${prefix}${e.name}/`)
        out.files.push(...nested.files)
        out.irregular.push(...nested.irregular)
        continue
      }
      if (!e.name.endsWith('.svg')) continue
      if (e.isFile()) out.files.push(`${prefix}${e.name}`)
      else out.irregular.push(`${prefix}${e.name}`)
    }
    return out
  }
  const onDisk = svgsUnder(here)
  if (onDisk.irregular.length) {
    die(`${here} carries ${onDisk.irregular.length} .svg entr(ies) that are not regular files: ${onDisk.irregular.join(', ')}. The artwork is generated INTO this directory, so a link here is a path this program would render THROUGH onto whatever it points at, and a directory scan cannot see it at all. Resolve each one first. Nothing was written`)
  }
  const changes = Object.entries(files).map(([r, svg]) => {
    const abs = join(here, r)
    // A path that exists and is not a regular file cannot be compared or written honestly. The
    // sweep above catches every .svg in the directory; this catches a declared asset whose parent
    // directory is a link, which the sweep never descends into as a directory entry.
    if (isRegularFile(abs) === false) {
      die(`${abs} is declared by the manifest and is not a regular file. Rendering it would write through to whatever it points at. Nothing was written`)
    }
    const on = readIf(abs)
    return { rel: r, state: on === null ? 'new' : on === svg ? 'unchanged' : 'changed' }
  })
  /*
   * DELETIONS ARE HALF THE PLAN, and this program could not express one.
   *
   * It only ever wrote the keys the current manifest renders, so removing a pill, removing a
   * banner, or renaming a slug left the old SVG on disk forever. `--check` compared the render to
   * the files it was about to write and never to the DIRECTORY, so it answered "every asset on
   * disk already matches this manifest" for a tree carrying an asset the manifest no longer
   * produces; and a full apply could not reach the state the lint wants either, because
   * RS-assets (drift) fails on exactly that orphan. The reconciliation the operator was told had
   * happened was one this program had no way to perform.
   */
  const expected = new Set(Object.keys(files))
  const orphans = onDisk.files.filter((r) => !expected.has(r)).map((r) => ({ rel: r, state: 'delete' }))
  /*
   * THE ENGINE ITSELF IS PART OF THE CHANGE SET, and the preview left it out of both the list and
   * the exit code.
   *
   * The whole reason `--assets-dir` exists is so a NEW generator can plan an OLD target. On a real
   * repository the payload generator and the installed one had different SHA-256 values, the plan
   * printed "nothing changes", and the sequence the scaffold journey then follows copies this file
   * over that one before running it. So the first write in the approved change set was the one
   * write the change set did not mention, and every asset line below it was computed by an engine
   * the operator had not been told was arriving.
   *
   * This program does NOT copy itself: the caller does, deliberately, so the replacement is an act
   * somebody performs rather than a side effect of a preview. What it owes is to SAY so.
   */
  const selfPath = fileURLToPath(import.meta.url)
  const installedEngine = join(here, 'generate.mjs')
  const engine = (() => {
    if (resolve(installedEngine) === resolve(selfPath)) return { state: 'unchanged' }
    const regular = isRegularFile(installedEngine)
    if (regular === null) return { state: 'new' }
    if (regular === false) {
      die(`${installedEngine} is not a regular file, so the engine this repo renders with is committed somewhere else and replacing it would write through the link. Nothing was written`)
    }
    return { state: readIf(installedEngine) === readIf(selfPath) ? 'unchanged' : 'changed' }
  })()
  const moving = [...changes.filter((c) => c.state !== 'unchanged'), ...orphans]
  /*
   * THE MARKDOWN IS THE OTHER HALF, and `--check` used to print its filenames and compare none of
   * its bytes. Four ordinary manifest edits (a pill `href`, a `brand.homepage`, a badge `href`, a
   * banner `dir`) each render byte-identical artwork and each move markdown the lint compares
   * character for character. So the same three comparisons RS-assets makes are made here, against
   * the same helpers, and they reach the exit code.
   */
  const h1Of = (text) => (text === null ? null : (text.split('\n').find((l) => /^# +\S/.test(l)) ?? '').trimEnd())
  const readmeText = readIf(readmeAbs)
  const readmeDir = dirname(readmeAbs)
  const mdChanges = []
  const expectBlock = readmeBlock(manifest, { assets: rel(readmeDir, here) })
  mdChanges.push({
    rel: readmeRel,
    what: 'the generated identity block',
    state: readmeText === null ? 'missing' : readmeText.includes(expectBlock) ? 'unchanged' : 'changed',
    expected: expectBlock,
  })
  const rootH1 = bannerH1({ title: manifest.brand.name, desc: manifest.brand.tagline, to: rel(readmeDir, join(here, 'banner.svg')), homepage: manifest.brand.homepage })
  mdChanges.push({
    rel: readmeRel,
    what: 'the banner H1',
    state: readmeText === null ? 'missing' : h1Of(readmeText) === rootH1 ? 'unchanged' : 'changed',
    expected: rootH1,
  })
  // The carriers this manifest DECLARES, keyed by absolute path, so the sweep below can tell a
  // declared one from a leftover. Canonical, so `"./docs"` is the directory `docs` is everywhere.
  const declaredCarriers = new Map([[resolve(readmeAbs), resolve(join(here, 'banner.svg'))]])
  for (const b of manifest.banners ?? []) {
    if (!b.dir) continue
    const dir = manifestCanon(b.dir)
    const doc = join(repoRoot, dir, 'README.md')
    const text = readIf(doc)
    declaredCarriers.set(resolve(doc), resolve(join(here, 'banners', `${b.slug}.svg`)))
    const expectedH1 = bannerH1({ title: b.title, desc: b.desc, to: rel(dirname(doc), join(here, 'banners', `${b.slug}.svg`)), homepage: manifest.brand.homepage })
    mdChanges.push({
      rel: `${dir}/README.md`,
      what: 'the banner H1',
      state: text === null ? 'missing' : h1Of(text) === expectedH1 ? 'unchanged' : 'changed',
      expected: expectedH1,
    })
  }
  /*
   * THE CARRIERS THIS MANIFEST NO LONGER DECLARES, found from the PAGES rather than from the
   * manifest, which is the only direction that can see them.
   *
   * Every loop above iterates `manifest.banners`, so DELETING a banner entry deleted the check
   * along with the claim: the SVG went out as an orphan, the README it headed kept an H1 pointing
   * at artwork that no longer exists, and this preview and the committed lint both went green over
   * a page whose first line is a broken image. A change set that reports the deletion and not the
   * page the deletion breaks is not the change set.
   */
  const readmesUnder = (dir, prefix = '') => {
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return [] }
    return entries.sort((a, b) => (a.name < b.name ? -1 : 1)).flatMap((e) => {
      if (e.isDirectory()) return e.name === '.git' || e.name === 'node_modules' || e.name.startsWith('.') ? [] : readmesUnder(join(dir, e.name), `${prefix}${e.name}/`)
      return e.isFile() && e.name === 'README.md' ? [`${prefix}${e.name}`] : []
    })
  }
  const h1AssetOf = (abs) => {
    const text = readIf(abs)
    if (text === null) return null
    const m = (h1Of(text) ?? '').match(/!\[[^\]]*\]\(([^)]*)\)/)
    if (m === null) return null
    const d = m[1].trim().replace(/^<(.*)>$/, '$1').trim()
    if (!d || /^[a-z][a-z0-9+.-]*:/i.test(d) || d.startsWith('/')) return null
    let decoded = d
    try { decoded = d.split('/').map((x) => decodeURIComponent(x)).join('/') } catch { /* compared as written */ }
    return resolve(dirname(abs), decoded)
  }
  const renderedAbs = new Set(Object.keys(files).map((r) => resolve(join(here, r))))
  for (const r of [...new Set([...readmesUnder(repoRoot), relative(repoRoot, readmeAbs).split('\\').join('/')])].sort()) {
    const abs = join(repoRoot, r)
    const asset = h1AssetOf(abs)
    if (asset === null) continue
    const inAssets = asset === resolve(here) || asset.startsWith(resolve(here) + sep)
    if (!inAssets) continue
    const want = declaredCarriers.get(resolve(abs))
    if (want === asset && renderedAbs.has(asset)) continue
    mdChanges.push({
      rel: r,
      what: want === undefined
        ? `a generated banner H1 pointing at ${rel(repoRoot, asset)}, which no banner entry declares for this page`
        : `a generated banner H1 pointing at ${rel(repoRoot, asset)}, which this manifest does not render for this page`,
      state: 'stale',
      expected: want === undefined
        ? 'declare a banner for this directory, or replace the H1 with an ordinary heading: applying this plan leaves the page pointing at artwork nothing produces'
        : `the declared asset for this page is ${rel(repoRoot, want)}`,
    })
  }
  const mdMoving = mdChanges.filter((c) => c.state !== 'unchanged')
  if (check) {
    console.log(`generate v${REPO_STANDARD_ASSETS_VERSION} --check: rendered ${changes.length} asset(s) in memory against ${here}; NOTHING was written`)
    // FIRST, because it is the first write the approved sequence performs and everything under it
    // was rendered by this engine rather than by the one currently installed.
    if (engine.state !== 'unchanged') {
      console.log(`  ENGINE ${engine.state.toUpperCase().padEnd(3)} ${rel(repoRoot, installedEngine)}: this plan was rendered by generate v${REPO_STANDARD_ASSETS_VERSION} at ${selfPath}, and the file installed there ${engine.state === 'new' ? 'does not exist yet' : 'has different bytes'}. Applying this plan means copying this engine over that one FIRST; every asset line below is what THIS engine renders, not what the installed one would`)
    }
    for (const c of moving) console.log(`  ${c.state.toUpperCase().padEnd(9)} ${here.split('/').pop()}/${c.rel}`)
    console.log(moving.length
      ? `  ${moving.length} asset change(s): ${changes.filter((c) => c.state === 'new').length} new, ${changes.filter((c) => c.state === 'changed').length} rewritten, ${orphans.length} DELETED (an asset the manifest no longer produces; the lint fails on one left behind).`
      : '  every asset on disk already matches this manifest, and the directory holds nothing the manifest does not produce.')
    // Named apart from the artwork, because they are a different edit: the SVGs are written by
    // the run that follows, and the markdown is pasted by a person reading the block it prints.
    console.log(`  generated markdown, compared byte for byte against ${repoRoot} (front page: ${readmeRel}):`)
    for (const c of mdMoving) {
      console.log(`  ${c.state.toUpperCase().padEnd(9)} ${c.rel}: ${c.what}`)
      if (c.state === 'changed' || c.state === 'stale') console.log(`            ${c.state === 'stale' ? 'fix' : 'expected'}: ${c.expected.split('\n')[0]}${c.expected.includes('\n') ? ' ...' : ''}`)
    }
    console.log(mdMoving.length
      ? `  ${mdMoving.length} of ${mdChanges.length} generated markdown carrier(s) do not match this manifest. Re-run without --check to write the artwork, then paste the printed block and H1 lines: the lint compares those bytes.`
      : '  every generated markdown carrier already matches this manifest.')
    // The engine counts. A plan that omitted its own replacement described a change set beginning
    // one write later than the one the operator was about to approve.
    const total = moving.length + mdMoving.length + (engine.state === 'unchanged' ? 0 : 1)
    console.log(total
      ? `  ${total} change(s) in total${engine.state === 'unchanged' ? '' : ', of which one is the generator itself'}. Confirm the working tree holds nothing you are not ready to have rewritten${orphans.length ? ', and note that applying this DELETES the assets listed above' : ''}.`
      : '  nothing changes: a run would be a no-op in the engine, the artwork, the directory, and the markdown.')
    process.exit(total ? 1 : 0)
  }
  for (const [r, svg] of Object.entries(files)) {
    const abs = join(here, r)
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, svg)
  }
  // Only what --check listed, only .svg files, and only inside the assets directory. This is the
  // approved half of the plan being carried out; it is never a sweep of anything else.
  for (const o of orphans) rmSync(join(here, o.rel), { force: true })
  console.log(`generate v${REPO_STANDARD_ASSETS_VERSION}: wrote ${Object.keys(files).length} asset(s) into ${here} (${changes.filter((c) => c.state !== 'unchanged').length} changed, ${changes.length - changes.filter((c) => c.state !== 'unchanged').length} already matched${orphans.length ? `, ${orphans.length} deleted` : ''})`)
  for (const o of orphans) console.log(`  deleted ${here.split('/').pop()}/${o.rel}: the manifest no longer produces it`)
  // Anything the plan called STALE is still stale after an apply: this program writes artwork and
  // never edits a page. Naming it here is what stops "wrote 12 assets" reading as "the tree is
  // consistent now".
  for (const c of mdChanges.filter((c) => c.state === 'stale')) console.log(`  STILL STALE ${c.rel}: ${c.what}. ${c.expected}`)
  if (engine.state !== 'unchanged') {
    console.log(`  note: ${rel(repoRoot, installedEngine)} ${engine.state === 'new' ? 'does not exist' : 'has different bytes from'} the engine that just rendered these assets (${selfPath}). This program never copies itself; the caller does, and until it has, the next run from the installed path renders with the other one.`)
  }
  // The one idiom, printed rather than remembered: paste these as the top of each README. The
  // paths are relative to the page that carries them, and `--assets-dir` is required to sit inside
  // `--repo`, so they can always be worked out.
  {
    // Printed flush left and fenced, never indented: this is a block to paste whole, and two
    // leading spaces on a pasted `<div>` is exactly the kind of near-miss the lint then reports.
    const rule = '\u2500'.repeat(72)
    console.log(`\nthe top of ${readmeRel}, pasted whole (the lint compares these bytes):\n${rule}`)
    console.log(expectBlock)
    console.log(rule)
    if ((manifest.badges ?? []).length) {
      console.log('the last line in that block is a live badge: rendered by shields, not by this repo, so its status changes without the repo changing.')
    }
    for (const b of manifest.banners ?? []) {
      if (!b.dir) continue
      const d = manifestCanon(b.dir)
      console.log(`\n${d}/README.md H1:\n  ${bannerH1({ title: b.title, desc: b.desc, to: rel(join(repoRoot, d), join(here, 'banners', `${b.slug}.svg`)), homepage: manifest.brand.homepage })}`)
    }
  }
}

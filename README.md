# OGForge

A dynamic Open Graph (social share preview) image generator that renders real
PNGs **on the Edge Runtime**, on demand, from a URL — the same pattern behind
`vercel.com/**/opengraph-image`, Vercel's own blog, and most modern
blogs/SaaS sites: instead of hand-designing a static preview image per page,
you generate it from a query string at request time and let a CDN cache it.

## Why the Edge Runtime (and not a Node canvas library)

The obvious way to generate an image on a server is `node-canvas`,
`sharp` + SVG, or Puppeteer/Playwright screenshotting an HTML page. All three
need either native bindings (canvas, sharp) or a full headless browser —
neither can run in the Edge Runtime, which is a V8-isolate sandbox with no
filesystem, no native addons, and only Web-standard APIs (`fetch`, `Request`,
`Response`, `crypto.subtle`, etc.). Edge isolates start in single-digit
milliseconds instead of the hundreds of milliseconds a cold Node/Lambda
container takes, and they run at CDN points of presence close to the
requester — exactly what you want for something a crawler (Twitter, Slack,
LinkedIn, iMessage) fetches synchronously before it will render your link
preview.

[Satori](https://github.com/vercel/satori) (via `@vercel/og`, which wraps it
for Next.js) sidesteps the native-binding problem entirely: it's a pure
JS/WASM library that lays out a **constrained subset of HTML/CSS via
flexbox**, and rasterizes straight to SVG → PNG, with zero native
dependencies. That constraint is real — no CSS grid, no arbitrary
`position: absolute` layout tricks, every multi-child `<div>` needs an
explicit `display: flex` — but in exchange it's genuinely edge-portable. This
project leans into that constraint rather than working around it: every
template here is built from flexbox primitives only.

## What actually works

- `GET /api/og` — generates a real 1200×630 PNG social preview image, in
  three distinct hand-built layouts, in light or dark theme, driven entirely
  by query parameters.
- **3 real templates**, not one layout with a color swap: a blog-post
  layout (kicker + title + subtitle + byline), a product/project card
  (centered logo mark generated from the first letter of the title/author,
  gradient badge), and a quote card (oversized quote mark, attribution rule).
- **Correct font loading for the edge runtime.** Satori doesn't read your
  OS/browser font stack — every font has to be fetched as raw bytes
  (`ArrayBuffer`) and handed to `ImageResponse`'s `fonts` option explicitly.
  Two more real gotchas this project ran into and fixed (see
  [Font handling](#font-handling-the-real-gotcha)): Node's `fs.readFile`
  doesn't exist on the edge, and Satori accepts TTF/OTF/**WOFF only** — not
  WOFF2, which is what most font packages ship by default.
- **Input validation with a documented, mixed strategy** — some params
  default silently, some are strict and 400. See the
  [query-param reference](#query-parameter-reference) below.
- **Long-title safety**, tested with pathological input (a 500-character
  string with *no whitespace at all*, which defeats naive wrapping and just
  overflows the canvas). Fixed with `wordBreak`/`overflowWrap` for wrapping
  plus a hard `maxHeight` + `overflow: hidden` safety net on every text
  block, so no input can ever push text outside the 1200×630 frame or
  collide with another element, regardless of character width or whether the
  string contains a single breakable space.
- **Real HTTP caching headers** — `Cache-Control` is set for long edge/CDN
  caching with revalidation, since the same query string always renders the
  same bytes.
- **A live demo page** (`/`) — edit title/subtitle/author, switch
  template/theme, watch the actual `/api/og` PNG update, and copy the
  generated URL.

## Tech stack

- **Next.js 15** (App Router) + **TypeScript**
- [`@vercel/og`](https://www.npmjs.com/package/@vercel/og) (`ImageResponse`),
  which wraps [Satori](https://github.com/vercel/satori) for JSX → SVG → PNG
- Deployed as a Next.js **Edge Function** (`export const runtime = "edge"`)
  on the `/api/og` route
- No external APIs, no database, no secrets — fonts are bundled locally in
  the repo

## Setup

```bash
git clone https://github.com/m-aoun/og-image-edge.git
cd og-image-edge
npm install
npm run dev
```

Then open <http://localhost:3000> for the live demo, or hit the endpoint
directly, e.g.:

```
http://localhost:3000/api/og?title=Hello+World&theme=dark
```

`npm run build` runs a production build (Turbopack) — this is also how you
verify there are zero Edge Runtime compatibility issues: Next.js will fail
the build (or surface a warning) if code under `runtime = "edge"` reaches for
a Node-only API.

## Query parameter reference

`GET /api/og`

| Param       | Required | Accepted values                | Default    | Behavior on missing / invalid input |
|-------------|----------|---------------------------------|------------|--------------------------------------|
| `title`     | no       | any string, any length          | `Untitled` | Missing/empty → default. Longer than 100 chars → truncated to 100 with a trailing "…". Also hard-capped visually (max render height + `overflow: hidden`) so even pathological input (no whitespace, very wide glyphs) can never overlap other elements. |
| `subtitle`  | no       | any string, any length          | *(hidden)* | Missing/empty → the subtitle line is omitted entirely (not rendered as blank space). Longer than 140 chars → truncated with "…". Same overflow safety net as `title`. |
| `author`    | no       | any string, any length          | template-specific (see below) | Longer than 60 chars → truncated with "…". |
| `theme`     | no       | `light`, `dark`                 | `light`    | Missing → default `light`. **Present but not one of the two values → `400 Bad Request`** (JSON body `{ "error": "..." }`) — an explicit, obviously-wrong enum value is treated as a caller bug, not silently coerced. |
| `template`  | no       | `post`, `product`, `quote`      | `post`     | Missing → default `post`. **Present but invalid → `400 Bad Request`**, same reasoning as `theme`. |

`author` default by template: `post` → `"OGForge"`, `product` → `"New
Project"`, `quote` → `"Unknown"`.

Rationale for the mixed validation strategy: free-text params (`title`,
`subtitle`, `author`) are what a human is actively typing into the demo form
or a CMS field — an empty or too-long value there is normal, not a bug, so it
gets a sensible default/truncation and the request still returns `200` with
a usable image (an OG-image endpoint that 400s on a long blog title would be
a bad time for whoever's crawler is trying to render a link preview).
Enum params (`theme`, `template`) are almost always set by the developer
wiring up the URL, not typed by an end user — a typo there (`?theme=drak`) is
a real bug worth surfacing loudly as a `400` with a clear message, rather
than silently rendering the wrong theme and leaving the mistake unnoticed in
production.

## Example URLs

```
/api/og?template=post&theme=light&title=Edge+Functions+Explained&subtitle=A+practical+tour+of+the+Edge+Runtime&author=Muhammad+Aoun+Shabbir

/api/og?template=post&theme=dark&title=Ship+Small,+Ship+Often

/api/og?template=product&theme=dark&title=OGForge&subtitle=Dynamic+Open+Graph+images+on+the+Edge&author=v1.0

/api/og?template=product&theme=light&title=My+New+SaaS

/api/og?template=quote&theme=dark&title=Ship+the+smallest+thing+that+proves+the+architecture+works.&author=Engineering+Notes

/api/og?template=quote&theme=light&title=Good+design+is+as+little+design+as+possible.
```

## Font handling (the real gotcha)

Satori renders text by measuring and laying out glyphs itself — it has no
access to the system/browser font stack, so setting `fontFamily` in a style
prop alone does nothing without also registering the actual font bytes:

```ts
const fonts = [
  { name: "Inter", data: regularArrayBuffer, weight: 400, style: "normal" },
  { name: "Inter", data: boldArrayBuffer, weight: 700, style: "normal" },
];

new ImageResponse(<Template />, { width: 1200, height: 630, fonts });
```

Two constraints made this non-trivial on the edge specifically:

1. **No filesystem.** The "obvious" `fs.readFileSync("./font.ttf")` used in
   Node-runtime examples throws immediately under `runtime = "edge"` — there
   is no `fs` module. The fix that works on the edge is to bundle the font
   file inside the route's own directory and load it with
   `fetch(new URL("./fonts/Inter-Regular.woff", import.meta.url))`. Next.js's
   edge bundler statically detects that exact pattern at build time and
   inlines the asset into the function bundle, so the `fetch` resolves from
   the bundle with no network round-trip at request time. See
   `app/api/og/route.tsx` → `loadFonts()`.
2. **WOFF2 is not supported.** Satori accepts TTF, OTF, and WOFF — **not**
   WOFF2, which is the default format most font packages (including
   `@fontsource/*`) ship. This project uses the plain `.woff` build of Inter
   (`app/api/og/fonts/Inter-Regular.woff`, `Inter-Bold.woff`), pulled out of
   `@fontsource/inter`'s `files/` directory rather than the WOFF2 default.

## Deployment

**Vercel (as built):** push to a repo connected to Vercel — no config
needed. `runtime = "edge"` on `app/api/og/route.tsx` is picked up
automatically and deployed as an Edge Function on Vercel's global edge
network, and the demo page deploys as a normal Next.js route.

**Cloudflare Workers — portable, with caveats.** The rendering code itself
(`@vercel/og` / Satori, the JSX templates, the font-loading approach) has no
Vercel-specific API calls and is Web-standard, so it is not locked to Vercel.
To actually run this on Cloudflare Workers, honestly, here's what would
change:

- The routing/hosting layer would move from Next.js's App Router edge
  runtime to either [`@cloudflare/next-on-pages`](https://github.com/cloudflare/next-on-pages)
  (adapts a Next.js app fairly directly, with some restrictions) or a plain
  Workers app (drop Next.js entirely for this endpoint and call
  `ImageResponse` from a Workers `fetch` handler / Hono route).
  `@vercel/og` itself works fine on Workers — it's Satori underneath.
- Local font loading via `fetch(new URL(..., import.meta.url))` is a
  Next.js-bundler-specific trick. On Workers you'd instead import the font
  file as a static asset via Workers' native asset bindings (or inline it as
  a base64 string / `import ... with { type: "..." }`) and read it into an
  `ArrayBuffer` that way.
- `Cache-Control` headers still work the same way (Cloudflare's edge cache
  respects standard `s-maxage`/`stale-while-revalidate` semantics), so no
  change needed there.
- The demo page (`/`) is ordinary React/Next.js UI with no edge-specific
  code, so it would need the same Next.js-on-Workers adapter, or could be
  hosted anywhere and simply point at the Workers-hosted `/api/og` URL.

## Project structure

```
app/
  api/og/
    route.tsx        # the Edge Function: validation, templates, ImageResponse
    fonts/
      Inter-Regular.woff
      Inter-Bold.woff
  page.tsx            # live demo form + preview
  page.module.css
  layout.tsx
  globals.css
```

## License

MIT — see [LICENSE](LICENSE).

## Author

Muhammad Aoun Shabbir — [github.com/m-aoun](https://github.com/m-aoun)

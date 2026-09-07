import { ImageResponse } from "@vercel/og";
import type { ReactElement } from "react";

// This route MUST run on the Edge Runtime, not Node.js. Satori (the library
// @vercel/og wraps) renders JSX -> SVG -> PNG entirely in JS/WASM with no
// filesystem, no `sharp`, no Node canvas bindings -- which is exactly what
// makes it viable on the edge. Do not import Node-only APIs anywhere in this
// file (fs, path, Buffer as a value, etc.) or the edge build will fail.
export const runtime = "edge";

const WIDTH = 1200;
const HEIGHT = 630;

const TEMPLATES = ["post", "product", "quote"] as const;
type Template = (typeof TEMPLATES)[number];

const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];

// --- Validation limits -----------------------------------------------------
// Title/subtitle/author are free text typed by whoever is sharing a link, so
// they can be arbitrarily long or entirely absent. We never want a weird
// query string to crash the endpoint or produce a broken image, so:
//  - missing values fall back to sensible defaults
//  - present-but-too-long values are truncated with an ellipsis rather than
//    left to overflow the fixed 1200x630 canvas
const MAX_TITLE_LENGTH = 100;
const MAX_SUBTITLE_LENGTH = 140;
const MAX_AUTHOR_LENGTH = 60;

const DEFAULT_TITLE = "Untitled";

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`; // trailing "…"
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// --- Fonts -------------------------------------------------------------
// Satori (what @vercel/og renders through) does NOT read the OS/browser font
// stack the way normal HTML does -- `font-family` in a style prop is just a
// label. Every font you use has to be fetched as raw bytes (an ArrayBuffer)
// and handed to ImageResponse's `fonts` option explicitly, or text falls
// back to Satori's built-in (fairly ugly) default. This is the single most
// common gotcha with @vercel/og.
//
// Two more constraints that bit us while building this:
//  1. Node's `fs.readFile` is NOT available on the edge runtime, so fonts
//     can't be read off disk the "normal" Next.js way.
//  2. Satori only understands TTF, OTF, and WOFF -- NOT WOFF2. Most modern
//     font packages (including @fontsource) ship WOFF2 by default, so the
//     regular/bold WOFF (not WOFF2) files were pulled out specifically.
//
// The fix that works on the edge: bundle the font files inside this route's
// own directory and load them with `fetch(new URL(..., import.meta.url))`.
// Next.js's edge bundler statically detects that pattern at build time and
// inlines the asset into the function bundle, so the fetch resolves locally
// with no network round trip at request time.
async function loadFonts() {
  const [regular, bold] = await Promise.all([
    fetch(new URL("./fonts/Inter-Regular.woff", import.meta.url)).then((r) =>
      r.arrayBuffer(),
    ),
    fetch(new URL("./fonts/Inter-Bold.woff", import.meta.url)).then((r) =>
      r.arrayBuffer(),
    ),
  ]);

  return [
    { name: "Inter", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Inter", data: bold, weight: 700 as const, style: "normal" as const },
  ];
}

// --- Theme palette -------------------------------------------------------
const PALETTES: Record<
  Theme,
  {
    background: string;
    title: string;
    subtitle: string;
    muted: string;
    accent: string;
    accentSoft: string;
    cardBackground: string;
    border: string;
  }
> = {
  light: {
    background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
    title: "#0f172a",
    subtitle: "#334155",
    muted: "#64748b",
    accent: "#4f46e5",
    accentSoft: "#e0e7ff",
    cardBackground: "#ffffff",
    border: "#e2e8f0",
  },
  dark: {
    background: "linear-gradient(135deg, #0b1120 0%, #1e293b 100%)",
    title: "#f8fafc",
    subtitle: "#cbd5e1",
    muted: "#94a3b8",
    accent: "#818cf8",
    accentSoft: "#312e81",
    cardBackground: "#111827",
    border: "#1f2937",
  },
};

type Palette = (typeof PALETTES)["light"];

interface RenderProps {
  title: string;
  subtitle: string;
  author: string;
  palette: Palette;
}

// --- Template: "post" (blog-post style layout) ---------------------------
function PostTemplate({ title, subtitle, author, palette }: RenderProps): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: "72px",
        background: palette.background,
        fontFamily: "Inter",
      }}
    >
      <div
        style={{
          display: "flex",
          width: 64,
          height: 8,
          borderRadius: 4,
          background: palette.accent,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", width: "100%", maxWidth: 960 }}>
        <div
          style={{
            display: "flex",
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: palette.accent,
            marginBottom: 24,
          }}
        >
          Blog Post
        </div>
        {/* wordBreak/overflowWrap matter here: Satori only wraps at
            whitespace by default, so a single very long unbroken token
            (a URL, a hashtag-style string, etc.) would otherwise overflow
            the fixed 1200px canvas instead of wrapping to the next line.
            maxHeight + overflow:hidden is a second safety net: even after
            truncating by character count, a title made of wide glyphs
            (e.g. all caps) can still wrap onto more lines than a normal
            title of the same length. Capping the box height guarantees the
            title can never grow tall enough to collide with the byline
            below it, regardless of how it wraps. */}
        <div
          style={{
            display: "flex",
            width: "100%",
            maxHeight: 228,
            overflow: "hidden",
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.15,
            color: palette.title,
            wordBreak: "break-word",
            overflowWrap: "break-word",
          }}
        >
          {title}
        </div>
        {subtitle ? (
          <div
            style={{
              display: "flex",
              width: "100%",
              maxHeight: 90,
              overflow: "hidden",
              fontSize: 30,
              fontWeight: 400,
              lineHeight: 1.4,
              color: palette.subtitle,
              marginTop: 28,
              wordBreak: "break-word",
              overflowWrap: "break-word",
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div
          style={{
            display: "flex",
            fontSize: 26,
            fontWeight: 700,
            color: palette.muted,
          }}
        >
          {author ? author : "OGForge"}
        </div>
        <div style={{ display: "flex", fontSize: 24, color: palette.muted }}>
          og-image-edge
        </div>
      </div>
    </div>
  );
}

// --- Template: "product" (project/product card with a logo mark) ---------
function ProductTemplate({ title, subtitle, author, palette }: RenderProps): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        background: palette.background,
        fontFamily: "Inter",
        padding: "72px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 120,
          height: 120,
          borderRadius: 28,
          background: `linear-gradient(135deg, ${palette.accent} 0%, #ec4899 100%)`,
          boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
          marginBottom: 48,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 56,
            fontWeight: 700,
            color: "#ffffff",
          }}
        >
          {(author || title || "OG").trim().charAt(0).toUpperCase() || "O"}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          width: "100%",
          maxWidth: 940,
          maxHeight: 216,
          overflow: "hidden",
          textAlign: "center",
          justifyContent: "center",
          fontSize: 60,
          fontWeight: 700,
          lineHeight: 1.15,
          color: palette.title,
          wordBreak: "break-word",
          overflowWrap: "break-word",
        }}
      >
        {title}
      </div>
      {subtitle ? (
        <div
          style={{
            display: "flex",
            width: "100%",
            maxWidth: 820,
            maxHeight: 86,
            overflow: "hidden",
            textAlign: "center",
            justifyContent: "center",
            fontSize: 28,
            fontWeight: 400,
            lineHeight: 1.4,
            color: palette.subtitle,
            marginTop: 24,
            wordBreak: "break-word",
            overflowWrap: "break-word",
          }}
        >
          {subtitle}
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: 1,
          color: palette.accent,
          background: palette.accentSoft,
          borderRadius: 999,
          padding: "10px 26px",
          marginTop: 40,
        }}
      >
        {author ? author : "New Project"}
      </div>
    </div>
  );
}

// --- Template: "quote" (quote card) --------------------------------------
function QuoteTemplate({ title, author, palette }: RenderProps): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        background: palette.background,
        fontFamily: "Inter",
        padding: "80px 96px",
      }}
    >
      <div
        style={{
          display: "flex",
          fontSize: 140,
          lineHeight: 1,
          fontWeight: 700,
          color: palette.accent,
          height: 90,
          marginBottom: 8,
        }}
      >
        &ldquo;
      </div>
      <div
        style={{
          display: "flex",
          width: "100%",
          maxWidth: 980,
          maxHeight: 272,
          overflow: "hidden",
          fontSize: 50,
          fontWeight: 700,
          lineHeight: 1.35,
          color: palette.title,
          wordBreak: "break-word",
          overflowWrap: "break-word",
        }}
      >
        {title}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginTop: 48,
        }}
      >
        <div
          style={{
            display: "flex",
            width: 56,
            height: 4,
            background: palette.accent,
            marginRight: 20,
          }}
        />
        <div
          style={{
            display: "flex",
            fontSize: 28,
            fontWeight: 700,
            color: palette.subtitle,
          }}
        >
          {author ? author : "Unknown"}
        </div>
      </div>
    </div>
  );
}

function renderTemplate(template: Template, props: RenderProps): ReactElement {
  switch (template) {
    case "product":
      return <ProductTemplate {...props} />;
    case "quote":
      return <QuoteTemplate {...props} />;
    case "post":
    default:
      return <PostTemplate {...props} />;
  }
}

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);

  // --- theme: missing -> default "light"; present but invalid -> 400 -----
  const rawTheme = searchParams.get("theme");
  const theme: Theme = rawTheme ? (rawTheme as Theme) : "light";
  if (rawTheme && !THEMES.includes(theme)) {
    return jsonError(
      `Invalid "theme" value: "${rawTheme}". Expected one of: ${THEMES.join(", ")}.`,
      400,
    );
  }

  // --- template: missing -> default "post"; present but invalid -> 400 ---
  const rawTemplate = searchParams.get("template");
  const template: Template = rawTemplate ? (rawTemplate as Template) : "post";
  if (rawTemplate && !TEMPLATES.includes(template)) {
    return jsonError(
      `Invalid "template" value: "${rawTemplate}". Expected one of: ${TEMPLATES.join(", ")}.`,
      400,
    );
  }

  // --- title/subtitle/author: missing -> defaults; long -> truncated -----
  const rawTitle = searchParams.get("title");
  const title = truncate(rawTitle && rawTitle.trim() ? rawTitle : DEFAULT_TITLE, MAX_TITLE_LENGTH);

  const rawSubtitle = searchParams.get("subtitle") ?? "";
  const subtitle = truncate(rawSubtitle, MAX_SUBTITLE_LENGTH);

  const rawAuthor = searchParams.get("author") ?? "";
  const author = truncate(rawAuthor, MAX_AUTHOR_LENGTH);

  const palette = PALETTES[theme];

  try {
    const fonts = await loadFonts();

    const image = new ImageResponse(
      renderTemplate(template, { title, subtitle, author, palette }),
      {
        width: WIDTH,
        height: HEIGHT,
        fonts,
      },
    );

    // Edge-cache aggressively: OG images are deterministic for a given query
    // string, so CDNs (Vercel's edge network, Cloudflare, etc.) can serve a
    // cached copy for a long time while we still allow revalidation.
    image.headers.set(
      "Cache-Control",
      "public, immutable, no-transform, max-age=86400, s-maxage=31536000, stale-while-revalidate=86400",
    );

    return image;
  } catch (error) {
    console.error("Failed to render OG image", error);
    return jsonError("Failed to render image.", 500);
  }
}

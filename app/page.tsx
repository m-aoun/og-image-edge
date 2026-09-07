"use client";

import { useMemo, useState } from "react";
import styles from "./page.module.css";

const TEMPLATES = [
  { value: "post", label: "Blog Post" },
  { value: "product", label: "Product" },
  { value: "quote", label: "Quote Card" },
] as const;

const THEMES = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

type TemplateValue = (typeof TEMPLATES)[number]["value"];
type ThemeValue = (typeof THEMES)[number]["value"];

const EXAMPLES: Array<{
  label: string;
  params: {
    template: TemplateValue;
    theme: ThemeValue;
    title: string;
    subtitle?: string;
    author?: string;
  };
}> = [
  {
    label: "Blog post · light",
    params: {
      template: "post",
      theme: "light",
      title: "Edge Functions Explained: Where Your Code Actually Runs",
      subtitle: "A practical tour of V8 isolates, cold starts, and the Web-standard runtime.",
      author: "Muhammad Aoun Shabbir",
    },
  },
  {
    label: "Product · dark",
    params: {
      template: "product",
      theme: "dark",
      title: "OGForge",
      subtitle: "Dynamic Open Graph images, rendered at the edge in milliseconds.",
      author: "v1.0",
    },
  },
  {
    label: "Quote card · dark",
    params: {
      template: "quote",
      theme: "dark",
      title: "Ship the smallest thing that proves the architecture works.",
      author: "Engineering Notes",
    },
  },
];

function buildQuery(params: {
  title: string;
  subtitle: string;
  author: string;
  theme: ThemeValue;
  template: TemplateValue;
}): string {
  const search = new URLSearchParams();
  if (params.title) search.set("title", params.title);
  if (params.subtitle) search.set("subtitle", params.subtitle);
  if (params.author) search.set("author", params.author);
  search.set("theme", params.theme);
  search.set("template", params.template);
  return search.toString();
}

export default function Home() {
  const [title, setTitle] = useState(
    "Edge Functions Explained: Where Your Code Actually Runs",
  );
  const [subtitle, setSubtitle] = useState(
    "A practical tour of V8 isolates, cold starts, and the Web-standard runtime.",
  );
  const [author, setAuthor] = useState("Muhammad Aoun Shabbir");
  const [theme, setTheme] = useState<ThemeValue>("light");
  const [template, setTemplate] = useState<TemplateValue>("post");
  const [copied, setCopied] = useState(false);

  const query = useMemo(
    () => buildQuery({ title, subtitle, author, theme, template }),
    [title, subtitle, author, theme, template],
  );

  const relativeUrl = `/api/og?${query}`;
  const absoluteUrl = useMemo(() => {
    if (typeof window === "undefined") return relativeUrl;
    return `${window.location.origin}${relativeUrl}`;
  }, [relativeUrl]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard API can be unavailable (older browsers, insecure context).
      // Fail silently -- the URL is still visible and selectable.
    }
  }

  function loadExample(example: (typeof EXAMPLES)[number]) {
    setTitle(example.params.title ?? "");
    setSubtitle(example.params.subtitle ?? "");
    setAuthor(example.params.author ?? "");
    setTheme(example.params.theme);
    setTemplate(example.params.template);
  }

  return (
    <main className={styles.page}>
      <div className={styles.hero}>
        <span className={styles.kicker}>
          <span className={styles.dot} />
          Edge Runtime · Satori · @vercel/og
        </span>
        <h1 className={styles.title}>OGForge</h1>
        <p className={styles.subtitle}>
          A dynamic Open Graph image generator that renders real PNGs on the
          Edge Runtime, on demand, from a URL. Try the form below, then paste
          the URL as your page&apos;s <code>og:image</code> and it just works.
        </p>
      </div>

      <div className={styles.grid}>
        <section className={styles.panel} aria-label="Image configuration">
          <div className={styles.field}>
            <label className={styles.label} htmlFor="title">
              Title
            </label>
            <input
              id="title"
              className={styles.input}
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled"
            />
            <span className={styles.hint}>
              Truncated to 100 characters server-side if longer.
            </span>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="subtitle">
              Subtitle
            </label>
            <input
              id="subtitle"
              className={styles.input}
              value={subtitle}
              maxLength={260}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="(optional)"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="author">
              Author / label
            </label>
            <input
              id="author"
              className={styles.input}
              value={author}
              maxLength={80}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="(optional)"
            />
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Template</span>
            <div className={styles.segmented}>
              {TEMPLATES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`${styles.segmentButton} ${
                    template === t.value ? styles.active : ""
                  }`}
                  onClick={() => setTemplate(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Theme</span>
            <div className={styles.segmented}>
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`${styles.segmentButton} ${
                    theme === t.value ? styles.active : ""
                  }`}
                  onClick={() => setTheme(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.previewCol} aria-label="Live preview">
          <div className={styles.previewFrame}>
            {/* Changing `src` re-requests /api/og with the new query string,
                so this always reflects the live edge-rendered PNG -- not a
                client-side mock. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={styles.previewImage}
              src={relativeUrl}
              alt="Generated Open Graph preview"
              width={1200}
              height={630}
            />
          </div>

          <div className={styles.previewMeta}>
            <span className={styles.badge}>1200 × 630 · image/png</span>
            <span className={styles.badge}>
              {TEMPLATES.find((t) => t.value === template)?.label} ·{" "}
              {THEMES.find((t) => t.value === theme)?.label}
            </span>
          </div>

          <div className={styles.urlRow}>
            <div className={styles.urlBox}>{relativeUrl}</div>
            <button className={styles.copyButton} onClick={handleCopy} type="button">
              {copied ? "Copied" : "Copy URL"}
            </button>
          </div>

          <div className={styles.examples}>
            {EXAMPLES.map((example) => (
              <a
                key={example.label}
                className={styles.exampleLink}
                href={`/api/og?${buildQuery({
                  title: example.params.title ?? "",
                  subtitle: example.params.subtitle ?? "",
                  author: example.params.author ?? "",
                  theme: example.params.theme,
                  template: example.params.template,
                })}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => loadExample(example)}
              >
                <span>{example.label}</span>
                <span>Open →</span>
              </a>
            ))}
          </div>
        </section>
      </div>

      <footer className={styles.footer}>
        <span>OGForge — dynamic OG images on the Edge Runtime</span>
        <a href="https://github.com/m-aoun/og-image-edge" target="_blank" rel="noreferrer">
          github.com/m-aoun/og-image-edge
        </a>
      </footer>
    </main>
  );
}

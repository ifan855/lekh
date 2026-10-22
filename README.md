# lekh

**Read. Write. Belong.** — a calm, ad-free home for stories.

lekh is a Wattpad-inspired storytelling platform: a genuinely good writing editor, a
comfortable reader with themes and page-turn mode, multilingual stories, per-chapter
and per-line comments, image-to-text transcription, an admin panel, and an MCP server so
an AI agent can write a book with you.

- **Web app:** Next.js 15 (App Router) · React 19 · Tailwind v4 · shadcn-style components
- **Data:** Neon Postgres (serverless) + Drizzle ORM
- **Auth:** Neon Auth (Managed Better Auth) — email one-time codes, no passwords
- **Storage:** Neon Object Storage (S3 compatible) for covers, thumbnails, avatars, uploads
- **Live co-writing:** Neon Realtime + block-level last-write-wins merge
- **MCP server:** a separate Neon Function (`apps/mcp`) — writing tools only

---

## Features

### Writing (the point of the whole thing)

- TipTap/ProseMirror editor tuned for phones: bottom format bar, selection bubble,
  no hover-only controls, one-thumb reachability.
- **Automatic saving** — debounced per-keystroke autosave to Postgres *and* to
  `localStorage`, so a killed tab, a closed laptop or a tunnel never loses a sentence.
  Unsaved local changes are detected and offered for restore on return.
- Block-level merge: every paragraph carries a stable id, so co-writers never clobber
  each other and comments stay anchored to the text they were written about.
- Per-chapter thumbnails, parts (like Wattpad), chapter reordering, book-wide font
  presets (Literary / Nocturne / Atlas / Hyperlegible / Typewriter / Grotesk).
- Outline view with per-chapter word counts and status.
- Export any chapter to plain text or Markdown.
- **Text from photos:** upload several scans or photos, the vision model transcribes
  each one, you review and correct it, ask the AI to fix mistakes, approve, and it is
  appended to your chapter — one image at a time.

### Reading

- Four themes (Paper, Sepia, Night, Midnight), six fonts, adjustable size, line height
  and measure, justified text, paragraph spacing.
- **Scroll** and **page-turn** modes (swipe / arrow keys, one screen at a time).
- Immersive mode: chrome hides itself, edge taps turn pages, screen dimming,
  fullscreen.
- Chapter navigation grouped by part, story progress, RTL support.
- Comments on the story, on the chapter, and inline on any paragraph.

### Discovery

Trending (recency-weighted), new releases, popular, staff picks, tag pages, author
pages, search, follow/favourite, library, read counts. Stories can be **public**
(listed everywhere), **unlisted** (link only) or **private** (author + co-authors).

### Admin

Users, stories, comments, tags, site settings, feature flags, audit log — and the
**vision provider configuration** (OpenAI / Anthropic / Gemini / any OpenAI-compatible
endpoint, model, prompt, API key) that drives the image-to-text pipeline.

### MCP server (writing only)

`apps/mcp` exposes 27 tools over Streamable HTTP: list/read stories, create and update
stories, parts and chapters, `write_blocks` for structured prose, publish, export, and
live editor sessions (`open_session`, `session_read`, `session_write`, `session_cursor`)
so an agent can co-write in the same document as a human.

It deliberately has **no** tools for comments, votes, follows, favourites or any other
social action — those stay human.

---

## Repository layout

```
apps/web        Next.js app (reader, writer, explore, profile, settings, admin, API)
apps/mcp        MCP server (Neon Function) — shares packages/core
packages/db     Drizzle schema, migrations, seed script
packages/core   shared services: auth/permissions, stories, settings, storage, AI
```

## Local development

```bash
npm install
cp .env.example .env          # fill in the Neon values
npm run db:migrate            # apply migrations
npm run db:seed               # optional: demo stories
npm run dev                   # http://localhost:3000
```

The MCP server runs separately:

```bash
npm run dev --workspace @lekh/mcp
```

### Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres (direct endpoint) |
| `NEON_AUTH_BASE_URL` | Neon Auth base URL |
| `NEON_AUTH_COOKIE_SECRET` | ≥32 chars, signs the session cookie |
| `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Neon Object Storage |
| `NEXT_PUBLIC_APP_URL` | public URL of the web app |
| `ADMIN_EMAILS` | comma-separated emails that get the admin role on first sign-in |


## Deployment (current)

| Piece | Where |
| --- | --- |
| Web app | https://lekh-9rcw.netlify.app (Netlify, repo root + `apps/web` base) |
| MCP server | https://br-bitter-math-b46cponh-lekhmcp.compute.c-6.us-east-2.aws.neon.tech/mcp (Neon Function `lekhmcp`) |
| Database / auth / storage | Neon project `lekh` (`noisy-paper-34184978`), branch `main` |
| Repository | https://github.com/ifan855/lekh |

### Web app (Netlify)

`netlify.toml` sets the base directory to `apps/web`. Add the environment variables in
the Netlify UI (or via the API) and deploy.

The repository is connected to Netlify through the Netlify GitHub app, so **every push to
`main` builds and deploys automatically** — no tokens, no workflow file, nothing to run by
hand.

Site id: `b3580380-5beb-4919-8d46-27d9643fafda`.

### MCP server (Neon Functions)

```bash
npm run build --workspace @lekh/mcp     # bundles to apps/mcp/dist/index.js
neon functions deploy lekhmcp --src apps/mcp/dist/index.js
```

Neon injects `DATABASE_URL` automatically. The public URL looks like
`https://<branch>-<slug>.compute.<region>.aws.neon.tech/`, with the MCP endpoint at
`/mcp`.

### Email delivery

One-time codes are sent by **Neon Auth**, not by lekh. The SMTP provider lives in the Neon
branch's configuration, so the web app's environment stays free of email secrets.

**Admin → Settings → Email delivery** writes that configuration into Neon through the Neon
API (`NEON_API_KEY`, `NEON_PROJECT_ID`, `NEON_BRANCH_ID` are the only requirements). Pick a
mailbox, paste the credentials, press *Save*, then *Send test*.

For Gmail: enable 2-Step Verification, create an
[app password](https://myaccount.google.com/apppasswords) (16 characters, no spaces) and use
`smtp.gmail.com:587` with your full Gmail address as the username. Any other SMTP server
works too (Outlook, Yahoo, Resend, SES) — host, port, username and password are all
configurable from the same panel.

If you prefer the console: **Project → Better Auth → Email provider** shows the same
settings, and `neon neon-auth config email-provider update --type standard --host … --port …
--username … --password … --sender-email …` does the same from the terminal.

### Making yourself admin

Set `ADMIN_EMAILS` to your email address and sign in — the role is granted on first
login. After that, the admin panel can promote anyone.

---

## Licence

MIT.

<!-- deploy check -->


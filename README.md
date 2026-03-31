# Streakboard

**Track your learning. Share your streak.**

Like GitHub contribution graphs — but for your study goals. Built for exam students and self-improvers who want to stay accountable publicly.

Every user gets a shareable public profile at `/u/username` — no login required to view.

---

## Features

- **GitHub-style activity heatmap** — 20 weeks of study sessions at a glance
- **Streak tracking** — current + longest streak, days logged
- **Exam countdown** — see exactly how many days until your exam
- **Goal progress bars** — set targets, track incremental progress
- **One-link sharing** — `streakboard.app/u/you` — share anywhere
- **Private dashboard** — log daily sessions, manage goals
- **100% free** — no paywalls, no subscriptions

---

## Tech Stack

- **Next.js 14** (App Router)
- **Tailwind CSS v4**
- **Prisma** + **PostgreSQL** (Neon)
- **NextAuth v5** (credentials auth)

---

## Local Development

```bash
git clone https://github.com/bluebud123/streakboard
cd streakboard
npm install

# Uses SQLite locally — no setup needed
npm run db:push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploy to Vercel

### 1. Create a free Neon database

Go to [neon.tech](https://neon.tech) → New Project → create a database called `streakboard`.

Copy both connection strings:
- **Pooled connection** → `DATABASE_URL`
- **Direct connection** → `DIRECT_URL`

### 2. Deploy

```bash
npx vercel
```

When prompted, add these environment variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `DIRECT_URL` | Neon direct connection string |
| `AUTH_SECRET` | Run `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your Vercel URL (e.g. `https://streakboard.vercel.app`) |

### 3. Run migrations

```bash
DATABASE_URL="your-neon-url" npx prisma db push
```

---

## Environment Variables

See [`.env.example`](.env.example) for the full list.

---

## Viral Loop

1. User signs up, logs daily sessions
2. Shares `streakboard.app/u/username` on Twitter / Reddit
3. Viewers see the heatmap + streak — no login needed
4. "Create your free Streakboard →" footer converts them
5. Loop repeats

---

## License

MIT

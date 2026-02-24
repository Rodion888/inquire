# Inquire

> Visual knowledge exploration tool — interactive graph of topics

**Inspired by:** [rabbithole.chat](https://www.rabbithole.chat/)

## Quick start

```bash
pnpm install
pnpm dev
```

## Stack

| Tech | Purpose |
|------|---------|
| Next.js 14 | App Router |
| TypeScript | Type safety |
| CSS Modules | Styling |
| @tanstack/react-query | Caching, loading states |
| Groq (Llama 3.3 70B) | AI generation (primary) |
| Gemini 2.5 Flash | AI generation (fallback) |
| Firebase | Auth (Google) + Firestore |
| pnpm | Package manager |

## Environment variables

```env
# Server-side only (NOT exposed to browser)
GROQ_API_KEY=
GEMINI_API_KEY=

# Client-side (Firebase — safe to expose)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

## Architecture

```
src/
├── app/                      # Next.js App Router
│   ├── api/explore/          # Server-side AI route
│   ├── explore/[topic]/      # Graph exploration page
│   └── page.tsx              # Home page
└── shared/                   # Reusable (ui, api, lib, config)
```

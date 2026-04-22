# Syncro

Syncro is a collaborative team workspace built with React, Vite, and Supabase-ready auth.
It combines team channels, floating chat windows, shared calendar planning, and social presence in one interface.

## Highlights

- Team workspaces with channel-based communication
- Floating, draggable, and resizable channel chat windows
- Rich message support with:
- Bold, italic, underline formatting
- Media attachments with inline preview (image, video, audio, downloadable files)
- Message edit and delete actions
- Custom in-channel delete confirmation modal (no browser default alert)
- Shared and personal calendar events with quick add and modal creation
- Profile controls from sidebar (nickname + account cleanup flow)
- Demo mode support when Supabase env vars are not configured

## Tech Stack

- React 18 + TypeScript
- Vite 5
- Tailwind CSS + shadcn/ui primitives
- Framer Motion
- Supabase JS (auth-ready)
- Vitest + Testing Library

## Project Scripts

- `npm run dev` - Start development server
- `npm run build` - Create production build
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run test` - Run tests once
- `npm run test:watch` - Run tests in watch mode

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Optional: configure Supabase auth:

```bash
cp .env.local.example .env.local
```

Then set:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

3. Start the app:

```bash
npm run dev
```

## Auth Modes

- With valid Supabase env vars: real Supabase auth is enabled.
- Without env vars: app runs in demo-friendly mode (default flow remains usable for local development).

## Data Storage Notes

- Workspace entities (teams, channels, messages, events, nickname metadata) are currently persisted in browser localStorage.
- This makes local iteration fast and reliable for UI development.
- Supabase client is already wired for auth; production-grade message/event persistence can be added on top.

## Current Chat UX

- Enter sends a message
- Shift+Enter inserts a newline
- Formatting toolbar is toggle-based in the composer
- Composer action buttons include formatting toggle, media attach, voice-note placeholder, and send

## Repository Layout

- [src/components](src/components) - UI components including chat/calendar/sidebar panels
- [src/pages](src/pages) - Route-level pages
- [src/context](src/context) - App contexts (auth)
- [src/lib](src/lib) - Utilities (storage, message sanitization, Supabase client)
- [src/types](src/types) - Shared TypeScript types

## Notes

- Voice note button currently represents UX scaffolding and recording state; full audio recording pipeline is not yet wired.
- If ports 8080/8081 are in use, Vite automatically selects the next available port.

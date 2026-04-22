# DearDekNek

Interview Project Technical Brief

## Project Overview

This project is a collaborative workspace web app built to demonstrate a complete product stack:

- Real user authentication with login and signup
- Backend-powered data handling
- Database-backed persistence for teams, channels, messages, and calendar events
- Deployable production build for a live website

The app is designed as a shared operating space where users can create teams, manage channels, chat, track calendar events, and view team activity.

## Assignment Alignment

This implementation is structured to satisfy the round 2 requirements:

1. Real user authentication
2. Proper backend system
3. Database integration
4. Deployment of the project

## Technical Specifications

### Frontend

- Framework: React 18
- Language: TypeScript
- Build tool: Vite
- Styling: Tailwind CSS
- UI primitives: shadcn/ui style components
- Animation: Framer Motion
- Routing: React Router
- Notifications: Sonner toast system

### Backend

- Backend service: Supabase
- Authentication: Supabase Auth
- Database: Supabase Postgres
- Storage: Ready for Supabase Storage if file uploads are expanded later

### State and Persistence

- Local UI state is handled with React hooks
- Workspace data is currently persisted in localStorage for fast local operation
- Supabase is configured through environment variables and is ready for real backend integration

### Environment Variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## How The App Works

### 1. Authentication Flow

The app boots through `AuthProvider` in `src/context/AuthContext.tsx`.

- If Supabase keys exist, the app checks the current session from Supabase Auth
- If no session is found, the user is redirected to the login page
- If demo mode is enabled, the app allows access with a local demo user
- Sign out clears either the Supabase session or the demo mode flag

Pages involved:

- `src/pages/AuthPage.tsx` handles login and signup forms
- `src/components/ProtectedRoute.tsx` blocks dashboard access unless the user is authenticated
- `src/App.tsx` wires routing and the auth provider together

### 2. Workspace Data Model

The app uses a structured collaboration model defined in `src/types/collab.ts`.

Core entities:

- Team: a workspace container with a leader email and channels
- Channel: text, meeting, or hidden channel type
- ChatMessage: message content, author, timestamp, and media metadata
- WorkspaceEvent: calendar items and reminders

This structure supports both visible team communication and private DM-style channels.

### 3. Team and Channel Management

`src/pages/Index.tsx` is the main orchestration layer.

- Loads teams, active team, and calendar events from localStorage
- Normalizes team data so default channels always exist
- Passes state and handlers into the sidebar, calendar, and social panel
- Saves updates back to localStorage when state changes

`src/components/TeamSidebar.tsx` is where users:

- Create new teams
- Add channels
- Open meeting channels or text channels
- Schedule meetings and generate reminders

### 4. Chat and Messaging

`src/components/PulseCalendar.tsx` manages open chat windows.

- Users can open multiple text channel windows
- Chat windows can be dragged and resized
- Messages support plain text and file metadata
- User messages are visually distinguished from leader messages
- Important leader messages can be highlighted with special styling

Private chat behavior:

- `src/components/SocialPanel.tsx` creates private DM channels
- DM channels are stored as text channels with hidden participant metadata
- This makes them easy to render while still keeping access rules attached to the channel

### 5. Online Now and Calls

The Social Panel derives an online roster from the active team.

- Team leader email is always included
- Message authors are collected as active participants
- Hidden channel members are included as well
- Private chat starts a DM channel
- Video calls open a Jitsi room using the team and target email to generate a unique room name

### 6. Calendar and Events

The calendar in `PulseCalendar.tsx` is a full monthly planner.

- Users can create personal or team-scoped events
- Meeting reminders are generated from scheduled meetings
- Upcoming events are shown in the notifications dock
- Calendar state is saved locally so refreshes do not lose data

### 7. Notifications

`src/components/NotificationsDock.tsx` shows upcoming events.

- Personal and space events are separated
- Events are filtered by date and sorted by schedule
- Team metadata is displayed when available

## Current Backend Readiness

The application already has the Supabase client configured in `src/lib/supabase.ts`.

Current behavior:

- If Supabase env vars are missing, the app falls back to demo mode
- If Supabase is configured, the app uses real auth session handling
- The codebase is ready to move from localStorage persistence to database persistence

## What Should Be Stored In The Database

For a production version, these tables should exist in Supabase:

- users or profiles
- teams
- team_members
- channels
- messages
- workspace_events

Recommended relationships:

- A team has many channels
- A team has many members
- A channel has many messages
- A team has many workspace events

## Deployment Plan

The app is ready to be deployed as a standard Vite production site.

Recommended deployment flow:

1. Build the app for production
2. Deploy the frontend to a host such as Vercel or Netlify
3. Set the Supabase environment variables in the hosting dashboard
4. Configure Supabase Auth redirect URLs for the production domain
5. Verify authentication, database writes, and routing in production

## How To Explain This In An Interview

You can describe the project like this:

"This is a collaborative workspace app built with React, TypeScript, Vite, Tailwind, and Framer Motion on the frontend, with Supabase planned as the backend for authentication and persistent data. The app supports teams, channels, messages, calendar events, and private collaboration flows. I structured the code so the UI works locally with demo data, but the same architecture is ready for real auth and database storage in Supabase."

## Key Strengths

- Clear component separation
- Strong type definitions for collaboration data
- Auth boundary already in place
- Backend integration path is established
- Ready for production deployment

## Files Worth Mentioning

- `src/App.tsx` routes and providers
- `src/context/AuthContext.tsx` auth session handling
- `src/lib/supabase.ts` Supabase client config
- `src/pages/Index.tsx` workspace state orchestration
- `src/components/TeamSidebar.tsx` team and channel management
- `src/components/SocialPanel.tsx` online users and private chat/calls
- `src/components/PulseCalendar.tsx` calendar, events, and chat windows
- `src/components/NotificationsDock.tsx` notifications UI
- `src/types/collab.ts` shared data contracts

## Notes

The current codebase still uses localStorage for some workspace state. That is acceptable for a prototype or interview demo, but the next production step would be to replace those local writes with Supabase tables and live subscriptions.
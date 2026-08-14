# TaskFlow

A simple, user-specific task management web application with Google Sign-In.

## Overview

TaskFlow lets a user sign in with their Google account, create tasks, and move
each task through three statuses: **Planned → In Progress → Complete**. Every
user only ever sees and modifies their own tasks.

## Features

- Sign in with Google (OAuth 2.0)
- Create a task
- View your tasks
- Change a task's status
- Tasks are scoped to the logged-in user

## Technology Stack

| Part                  | Technology                |
| ---------------------- | -------------------------- |
| Frontend               | HTML + CSS + JavaScript    |
| Backend                | Node.js                    |
| API framework          | Express.js                 |
| Authentication         | Google OAuth 2.0            |
| Auth library           | Passport.js                |
| Database               | SQLite                     |
| SQLite library         | better-sqlite3             |
| Sessions               | express-session            |
| Environment variables  | dotenv                     |
| Hosting (intended)     | Render                     |

## Application Flow

```
Browser --> /auth/google --> Google login --> /auth/google/callback
                                                     |
                                          find or create user
                                                     |
                                             create session
                                                     |
                                                 Dashboard
```

Once logged in, the frontend calls `/api/me` to check session state and
`/api/tasks` to load that user's tasks. Creating a task calls `POST /api/tasks`;
changing status calls `PATCH /api/tasks/:id/status`.

## How to Use

### Login Instructions

1. Open the app in a browser.
2. Click **Continue with Google**.
3. Approve the Google consent screen.
4. You're redirected back to the dashboard, now signed in.

### Creating a Task

1. Type a title into the "Enter task title..." field.
2. Click **Add Task**.
3. The task appears at the top of the list with status **Planned**.

### Updating Task Status

1. Use the status dropdown next to any task.
2. Choose **Planned**, **In Progress**, or **Complete**.
3. The change is saved immediately.

## Assumptions

1. Google authentication is the only authentication method.
2. Each task belongs to exactly one authenticated user.
3. New tasks start with status `Planned`.
4. Only the three specified statuses are supported (`Planned`, `In Progress`, `Complete`).
5. Tasks cannot be deleted, since deletion wasn't part of the requirements.
6. Tasks are displayed newest first.
7. Task title is mandatory.

## Known Limitations

1. No task deletion, since it wasn't part of the assessment requirements.
2. No task editing — only status updates are supported.
3. The application supports Google authentication only.
4. SQLite is intended for this small assessment application rather than
   high-scale production workloads.
5. No notifications or reminders.
6. Sessions use the default in-memory `express-session` store, which is fine
   for a single-instance assessment app but would need a persistent session
   store (e.g. Redis) for a multi-instance production deployment.

## Security Considerations

- All `/api/*` routes require an authenticated session (`401` otherwise).
- Every task query and mutation is scoped to `req.user.id` — a user cannot
  read another user's tasks (`GET /api/tasks` filters by `user_id`).
- `PATCH /api/tasks/:id/status` verifies the task belongs to the logged-in
  user before updating it, returning `403` otherwise.
- Task status is validated against a fixed allow-list; any other value
  returns `400`.
- Session cookies are `httpOnly`, and `secure` is enabled automatically when
  `NODE_ENV=production`.
- `.env` (real secrets) is git-ignored; `.env.example` documents the required
  variables without values.
- Task titles are rendered via `textContent` on the frontend, not
  `innerHTML`, to avoid script injection through task titles.

## Local Setup

### Prerequisites

- Node.js (v18+ recommended)
- A Google Cloud project with an OAuth 2.0 Client ID

### 1. Install dependencies

```
npm install
```

### 2. Configure Google OAuth

In the [Google Cloud Console](https://console.cloud.google.com/):

1. Create a project (or use an existing one).
2. Configure the OAuth consent screen.
3. Create an OAuth Client ID of type **Web application**.
4. Add an authorized JavaScript origin: `http://localhost:3000`
5. Add an authorized redirect URI: `http://localhost:3000/auth/google/callback`
6. Copy the generated Client ID and Client Secret.

### 3. Configure environment variables

Copy `.env.example` to `.env` and fill in your values:

```
PORT=3000

GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

SESSION_SECRET=your-random-secret
```

Never commit `.env` to version control.

### 4. Run the app

```
npm start
```

or, for auto-restart during development:

```
npm run dev
```

The app will be available at `http://localhost:3000`. SQLite will
automatically create `database/taskflow.db` with the `users` and `tasks`
tables on first run.

## Environment Variables

| Variable               | Description                                      |
| ------------------------ | ------------------------------------------------- |
| `PORT`                  | Port the server listens on (default `3000`)       |
| `GOOGLE_CLIENT_ID`      | OAuth Client ID from Google Cloud Console          |
| `GOOGLE_CLIENT_SECRET`  | OAuth Client Secret from Google Cloud Console      |
| `GOOGLE_CALLBACK_URL`   | OAuth redirect URI registered with Google          |
| `SESSION_SECRET`        | Random string used to sign session cookies         |

## API Endpoints

```
GET    /auth/google                  Start Google sign-in
GET    /auth/google/callback         Google OAuth callback
GET    /auth/logout                  Log out and clear session

GET    /api/me                       Return the logged-in user (401 if none)

GET    /api/tasks                    List the logged-in user's tasks
POST   /api/tasks                    Create a task ({ title })
PATCH  /api/tasks/:id/status         Update a task's status ({ status })
```

## Data Model

```
users
-----------------------
id          (text, primary key — Google profile id)
google_id   (text, unique)
name
email
photo
created_at

tasks
-----------------------
id           (integer, autoincrement)
user_id      (references users.id)
title
status       ('Planned' | 'In Progress' | 'Complete')
created_at
```

One user has many tasks; every task belongs to exactly one user.

## Testing

Manually verified scenarios:

1. Login with Google shows the dashboard.
2. Creating a task defaults its status to `Planned`.
3. Status can be moved `Planned → In Progress → Complete`.
4. Creating a task with an empty title shows "Task title is required."
5. Logging out makes the dashboard inaccessible (`/api/me` returns `401`).
6. A second Google account never sees the first account's tasks.
7. A user cannot change another user's task status (`403 Forbidden`).
8. Submitting an invalid status value returns `400 Bad Request`.

## AI Usage Summary

AI assistance was used during development for:

- Requirement analysis and architecture planning
- Generating initial backend and frontend code
- Reviewing API design and identifying edge cases (e.g. task ownership checks)
- Writing documentation

AI-generated code was reviewed and tested manually, including:

- The authentication flow and session handling
- Task ownership validation logic
- Status validation
- Error handling and HTTP status codes
- Database schema and queries
- End-to-end manual testing of all API routes (auth, tasks, ownership,
  validation) before removing any temporary test scaffolding

## Deployment

Deployed on [Render](https://render.com) using the `render.yaml` Blueprint in
this repo (service name `jaswanthproductsupport`, so the live URL is
`https://jaswanthproductsupport.onrender.com`).

1. In the Render dashboard: **New +** → **Blueprint**, and select this GitHub repo.
2. Render reads `render.yaml` and proposes the `jaswanthproductsupport` web service.
3. Fill in the environment variables it prompts for (marked `sync: false` in
   the blueprint): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and
   `GOOGLE_CALLBACK_URL` (`https://jaswanthproductsupport.onrender.com/auth/google/callback`).
   `NODE_ENV` and `SESSION_SECRET` are already set by the blueprint.
4. Click **Apply** — Render runs `npm install` then `npm start`.
5. In Google Cloud Console, add `https://jaswanthproductsupport.onrender.com`
   as an authorized JavaScript origin and the callback URL above as an
   authorized redirect URI on the OAuth Client.

> Note: the free plan's filesystem is ephemeral across redeploys, so the
> SQLite database resets whenever the service redeploys. Persisting it across
> deploys requires a paid plan with a Render Disk mounted over `database/`
> (free-tier services can't attach disks).

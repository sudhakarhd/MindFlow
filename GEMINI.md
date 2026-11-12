# MindFlow - Project Instructions & Guidelines

## Tech Stack

- **Frontend:** React, Vite, TypeScript, Tailwind CSS v4, Lucide React
- **Backend:** Python, FastAPI, Uvicorn, Google Gemini API
- **Database & Auth:** Supabase (`@supabase/supabase-js`)

## Folder Layout

- **Root Directory (`/`):** Contains backend Python files, project notes, and configuration.
  - `main.py`: FastAPI backend entry point
  - `test_api.py`: API tests / test script
  - `project_notes.md`: High-level product principles and architecture notes
  - `venv/`: Python virtual environment
- **Frontend Directory (`/frontend`):** React SPA client application managed via Vite.
  - `src/`: React components, hooks, utils, Supabase client (`supabase.ts`)
  - `public/`: Static assets (audio, favicon, icons)
  - `package.json`: Frontend dependencies and scripts

## Development & Git Workflows

1. **Feature Branches:** Always create and work on dedicated feature branches (e.g., `feature/my-feature` or `bugfix/my-fix`) for all code changes. Never commit directly to `main`.
2. **Testing & Validation:** Thoroughly test changes locally (frontend build/lint and backend checks) before merging or pushing.
3. **No Direct Push:** Never push untested code or push directly to `main`.

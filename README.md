# PharmaTrack

Team project & sourcing tracker for pharma operations — built with React, Supabase, and Claude AI.

## Features

- **3 project types**: Sourcing (product pipeline), Development (phases + milestones), General (task lists)
- **Team collaboration**: Assign projects and tasks to team members; assigned tasks surface in "My Tasks"
- **Product database**: Shared global catalogue with structured fields (generic name, strength, dosage form, packing)
- **Price comparison**: Track every quote from every manufacturer, compare across suppliers and currencies (INR, USD, EUR, AED, etc.)
- **AI-powered price import**: Upload Excel files, paste WhatsApp messages, or upload photos of price lists — Claude extracts all products and prices automatically
- **Communication log**: Per-project log for emails, calls, meetings, and action items
- **Quick Todos**: Personal task list independent of projects

---

## Setup (one-time, ~15 minutes)

### 1. Install Node.js
Download from https://nodejs.org (LTS version). Restart your terminal after installing.

### 2. Clone and install dependencies
```bash
cd "C:\Users\harsh\New folder\pharma-tracker"
npm install
```

### 3. Set up Supabase

1. Go to https://supabase.com and create a new project
2. Go to **SQL Editor → New query**, paste the entire contents of `supabase/schema.sql`, and click **Run**
3. Go to **Settings → API** and copy:
   - Project URL
   - `anon` public key

### 4. Create environment file
Copy `.env.example` to `.env`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

The `ANTHROPIC_API_KEY` goes into Vercel (Step 6), NOT in `.env`.

### 5. Run locally
```bash
npm run dev
```
Open http://localhost:5173

> Note: The AI price import (`/api/parse-price`) requires `vercel dev` locally (Step 6) to work.
> Everything else works with `npm run dev`.

---

## Deploy to Vercel (one-time)

### 6. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/pharma-tracker.git
git push -u origin main
```

### 7. Connect to Vercel
1. Go to https://vercel.com → New Project → Import from GitHub
2. Select your `pharma-tracker` repo
3. Add these **Environment Variables** in Vercel:
   - `VITE_SUPABASE_URL` = your Supabase URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
   - `ANTHROPIC_API_KEY` = your Anthropic API key (sk-ant-...)
4. Click **Deploy**

Your app will be live at `https://pharma-tracker-xxx.vercel.app`

---

## For local AI price import (optional)
Install Vercel CLI and run both the frontend and API together:
```bash
npm install -g vercel
vercel login
vercel dev
```
This runs on http://localhost:3000 with the `/api/parse-price` endpoint active.

---

## Inviting team members

1. Each team member signs up at your Vercel URL
2. The project owner goes to a project → **Team** → adds their email
3. They'll see the project in their dashboard and any tasks assigned to them in **My Tasks**

---

## Using the AI price import

1. Go to **Products & Prices** → **Import Price List**
2. Choose input mode:
   - **Paste text**: Copy-paste WhatsApp messages or email content directly
   - **Upload file**: Excel (.xlsx) or CSV from a manufacturer
   - **Upload image**: Photo or screenshot of a printed price list
3. Optionally select the manufacturer or let Claude detect it
4. Click **Parse with AI** — Claude extracts all products in seconds
5. Review the extracted products, deselect any you don't want
6. Click **Import** — all products and prices are saved to the database

Historical quotes are preserved. You can compare all suppliers for any product via the **Compare prices** button.

---

## Tech stack

| Layer | Tool |
|---|---|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Database + Auth | Supabase (PostgreSQL + Row Level Security) |
| AI parsing | Claude claude-opus-4-6 via Anthropic API |
| Hosting | Vercel (serverless API routes + CDN) |

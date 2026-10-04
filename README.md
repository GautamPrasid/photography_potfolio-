# Photography Portfolio CMS

The public pages use CMS data from `/api/public/site`. Run the Node.js server locally or deploy the project to Vercel; opening the HTML files directly or serving them as a static-only site will not load this data or the admin API.

## Requirements

- Node.js 22.13 or newer
- A Supabase project with PostgreSQL tables and a public Storage bucket (e.g., `portfolio`).

## Run locally

1. Copy `.env.example` to `.env`.
2. Configure your Supabase project settings (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_STORAGE_BUCKET`).
3. Set a unique `ADMIN_USERNAME` and an `ADMIN_PASSWORD` of at least 12 characters.
4. (Optional) Run the migration script if you have existing local SQLite data: `node scripts/migrate-sqlite-to-supabase.js`.
5. Run `npm start`.
6. Open `http://localhost:3000/` for the site or `http://localhost:3000/admin` for the CMS.

Do not open `home.html` with VS Code Live Server (usually port `5500`). Live Server only serves static files and does not provide `/api/public/site`, so the page's CMS content will be missing. Use the Node.js server above and open `http://localhost:3000/home.html` instead.

Supabase PostgreSQL is the source of website content. Uploaded images are stored in Supabase Storage.

## Deploy to Vercel

Import this repository into Vercel with the repository root as the project root. Vercel uses `vercel.json` to route public paths and the `/api/*` requests to the serverless handler.

### Environment Variables on Vercel
When deploying to Vercel (or when `NODE_ENV=production`), the application enforces strict production security and requires the following variables:
- `SUPABASE_URL`: Your Supabase project URL (e.g. `https://xyz.supabase.co`).
- `SUPABASE_SECRET_KEY`: Supabase Service Role Key (used for secure server-side database and storage operations).
- `SUPABASE_STORAGE_BUCKET`: The Supabase storage bucket name (default: `portfolio`).
- `ADMIN_USERNAME`: Unique admin username.
- `ADMIN_PASSWORD`: Strong password of at least 12 characters.
- `SESSION_SECRET`: Dedicated secret key (e.g. 64-character random string from `openssl rand -hex 32`) used to cryptographically sign HMAC-SHA256 session cookies.

Optional AI variables:
- `AI_API_KEY`: Google Gemini API key for photo analysis.
- `AI_PROVIDER`: `gemini` (default).
- `AI_MODEL`: `gemini-2.0-flash` (default).

### Architecture & Features
- **Stateless Auth**: Sessions use HMAC-SHA256 signed HttpOnly cookies valid for 8 hours, allowing admin authentication across distributed serverless lambda instances.
- **Durable Supabase PostgreSQL & Storage**: All CMS data and media uploads are persisted directly in Supabase PostgreSQL and Supabase Storage via REST APIs without server-side database drivers.
- **Brute-Force Rate Limiting**: The login attempt limiter uses an in-memory `Map` within the active Node process.


## Project structure

- `home.html`, `about.html`, `photography.html`, and `hire.html` are the public pages.
- `Javascript/public-cms.js` loads and renders CMS data on public pages.
- `Javascript/server.js` implements the API and local Node.js server.
- `api/index.js` is the Vercel serverless entry point.
- `admin/admin.html` and `admin/*.html` provide the admin shell and page templates.
- `css/master.css` contains the public site styles.

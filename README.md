# Dear Praa Photography CMS

The public pages use CMS data from `/api/public/site`. Run the Node.js server locally or deploy the project to Vercel; opening the HTML files directly or serving them as a static-only site will not load this data or the admin API.

## Requirements

- Node.js 22.13 or newer
- No npm package installation is required. The server uses Node's built-in SQLite support.

## Run locally

1. Copy `.env.example` to `.env`.
2. Set a unique `ADMIN_USERNAME` and an `ADMIN_PASSWORD` of at least 12 characters.
3. Run `npm start`.
4. Open `http://localhost:3000/` for the site or `http://localhost:3000/admin` for the CMS.

Do not open `home.html` with VS Code Live Server (usually port `5500`). Live Server only serves static files and does not provide `/api/public/site`, so the page's CMS content will be missing. Use the Node.js server above and open `http://localhost:3000/home.html` instead.

The local SQLite database is stored in `data/portfolio.sqlite`, and uploaded images are stored in `uploads/`. Back up both directories together. The first database initialization imports the portfolio images already present in `assets/`.

## Deploy to Vercel

Import this repository into Vercel with the repository root as the project root. Vercel uses `vercel.json` to route public paths and the `/api/*` requests to the serverless handler. The function explicitly includes the seed images from `assets/`, which it needs when initializing its database.

Set `ADMIN_USERNAME` and a unique `ADMIN_PASSWORD` (at least 12 characters) in the Vercel project's environment variables, then deploy. After deployment, check that `https://<your-vercel-domain>/api/public/site` returns JSON containing `content`, `navigation`, and `photos`. The existing Netlify deployment does not run this API, so it will continue to show missing CMS content until the site is deployed to Vercel and visitors use the Vercel domain.

Vercel function storage under `/tmp` is temporary. The seeded public portfolio can be displayed, but CMS database edits and uploaded files are not durable across function restarts; use a persistent database and object storage before relying on admin changes in production.

## Project structure

- `home.html`, `about.html`, `photography.html`, and `hire.html` are the public pages.
- `Javascript/public-cms.js` loads and renders CMS data on public pages.
- `Javascript/server.js` implements the API and local Node.js server.
- `api/index.js` is the Vercel serverless entry point.
- `admin/admin.html` and `admin/*.html` provide the admin shell and page templates.
- `css/master.css` contains the public site styles.

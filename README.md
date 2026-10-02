# Dear Praa Photography CMS

This is a self-hosted site. The static HTML pages alone do not provide a secure admin login or persistent uploads; start the Node.js server for public data and `/admin` routes.

## Requirements

- Node.js 22.13 or newer
- No npm package installation is required. The server uses Node's built-in SQLite support.

## Start locally

1. Copy `.env.example` to `.env`.
2. Set a unique `ADMIN_PASSWORD` of at least 12 characters and choose an `ADMIN_USERNAME`.
3. Run `npm start`.
4. Open `http://localhost:3000/` for the site or `http://localhost:3000/admin` to sign in.

The SQLite database is created at `data/portfolio.sqlite`; uploaded images are stored in `uploads/`. Both paths are ignored by Git. Back up both directories together. Keep the server behind HTTPS when it is reachable beyond localhost. The first database initialization imports the portfolio images and links already present in `assets/`; it does not create demo photos.

Changing the admin credentials requires updating `.env` and restarting the server. Admin sessions are in-memory and expire after eight hours.

## Admin page structure

All `/admin/...` routes use the single complete document `admin/admin.html`, which loads the shared layout and templates from `admin/shared.html`. Route-specific markup is kept in the matching `admin/*.html` template file, and `Javascript/admin.js` loads the page template and handles database data and interactions. Gallery reuses the Portfolio view instead of keeping a second copy of its table markup. The shared admin document uses `css/master.css` plus the admin-specific stylesheet.

Public pages share their visual system in `css/master.css`; `Javascript/public-cms.js` owns CMS data rendering, mobile navigation, and header scroll state. Page scripts contain only page-specific behavior. The About-page contact form opens a prefilled email in the visitor's configured mail application; it does not send messages through the server.

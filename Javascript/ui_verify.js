const fs = require('fs');
const base = 'http://localhost:3000';
const adminJs = fs.readFileSync('Javascript/admin.js', 'utf8');
const css = fs.readFileSync('css/admin.css', 'utf8');

(async () => {
  const results = [];
  const pass = (n) => results.push({ ok: true, n });
  const fail = (n) => results.push({ ok: false, n });
  const has = (s, n) => s.includes(n);

  // Login
  let r = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'adminpassword123' })
  });
  const cookie = r.headers.get('set-cookie');
  const h = { cookie, 'Content-Type': 'application/json' };

  // Load template files
  const shared = await (await fetch(base + '/admin/shared.html', { headers: h })).text();
  const login  = await (await fetch(base + '/admin/login.html',  { headers: h })).text();
  const dash   = await (await fetch(base + '/admin/dashboard.html', { headers: h })).text();
  const port   = await (await fetch(base + '/admin/portfolio.html', { headers: h })).text();
  const gall   = await (await fetch(base + '/admin/gallery.html',   { headers: h })).text();
  const sect   = await (await fetch(base + '/admin/sections.html',  { headers: h })).text();
  const cont   = await (await fetch(base + '/admin/content.html',   { headers: h })).text();
  const soc    = await (await fetch(base + '/admin/social.html',    { headers: h })).text();
  const nav    = await (await fetch(base + '/admin/navigation.html',{ headers: h })).text();
  const med    = await (await fetch(base + '/admin/media.html',     { headers: h })).text();
  const set    = await (await fetch(base + '/admin/settings.html',  { headers: h })).text();

  // SHARED TEMPLATES
  [
    'admin-layout-template', 'admin-pill-template', 'admin-notice-template',
    'admin-dialog-template', 'admin-error-template', 'portfolio-row-template',
    'photo-dialog-form-template', 'section-dialog-form-template',
    'social-dialog-form-template', 'navigation-dialog-form-template',
    'media-edit-form-template', 'media-replace-form-template'
  ].forEach(t => has(shared, 'id="' + t + '"') ? pass('shared: ' + t) : fail('shared MISSING: ' + t));

  // LOGIN
  has(login, 'id="login-form"') ? pass('login: form') : fail('login: form MISSING');
  (has(login, 'name="username"') && has(login, 'name="password"')) ? pass('login: fields') : fail('login: fields MISSING');

  // DASHBOARD
  has(dash, 'data-stat-grid') ? pass('dashboard: stat-grid') : fail('dashboard: stat-grid MISSING');
  has(dash, 'data-action="add-photo"') ? pass('dashboard: add-photo') : fail('dashboard: add-photo MISSING');

  // PORTFOLIO
  has(port, 'id="photo-rows"') ? pass('portfolio: rows') : fail('portfolio: rows MISSING');
  has(port, 'photo-search') ? pass('portfolio: search') : fail('portfolio: search MISSING');
  (has(port,'photo-category') && has(port,'photo-section') && has(port,'photo-status') && has(port,'photo-featured'))
    ? pass('portfolio: all 4 filters') : fail('portfolio: filters incomplete');
  has(port, 'data-action="add-photo"') ? pass('portfolio: add-photo') : fail('portfolio: add-photo MISSING');

  // GALLERY
  has(gall, 'id="gallery-view-template"') ? pass('gallery: template') : fail('gallery: template MISSING');
  has(gall, 'id="photo-rows"') ? pass('gallery: rows') : fail('gallery: rows MISSING');
  has(gall, 'photo-search') ? pass('gallery: search') : fail('gallery: search MISSING');

  // SECTIONS
  has(sect, 'id="section-rows"') ? pass('sections: rows') : fail('sections: rows MISSING');
  has(sect, 'section-search') ? pass('sections: search') : fail('sections: search MISSING');
  has(sect, 'data-action="add-section"') ? pass('sections: add button') : fail('sections: add MISSING');

  // CONTENT - 22 keys
  [
    'home.heroTitle','home.heroSubtitle','home.ctaText','home.introduction',
    'home.portfolioTitle','home.portfolioDescription','about.title','about.description',
    'about.biography','portfolio.title','portfolio.description','contact.title',
    'contact.email','contact.phone','contact.location','contact.description',
    'contact.closingTitle','contact.closingDescription','footer.introduction',
    'footer.officeTitle','footer.socialTitle','footer.copyright'
  ].forEach(k => has(cont, 'name="' + k + '"') ? pass('content: ' + k) : fail('content MISSING: ' + k));
  has(cont, 'id="content-form"') ? pass('content: form') : fail('content: form MISSING');

  // SOCIAL
  has(soc, 'id="social-rows"') ? pass('social: rows') : fail('social: rows MISSING');
  has(soc, 'social-search') ? pass('social: search') : fail('social: search MISSING');
  (has(soc,'social-platform') && has(soc,'social-visible') && has(soc,'social-location'))
    ? pass('social: 3 filters') : fail('social: filters MISSING');
  has(soc, 'data-action="add-social"') ? pass('social: add button') : fail('social: add MISSING');

  // Social dialog locations
  ['header','homepage','about','portfolio','contact','footer'].forEach(loc =>
    has(shared, 'value="' + loc + '"') ? pass('social dialog: ' + loc) : fail('social dialog MISSING: ' + loc));

  // Social dialog platforms
  ['Instagram','Facebook','TikTok','YouTube','Pinterest','LinkedIn'].forEach(p =>
    has(shared, '>' + p + '<') ? pass('social platform: ' + p) : fail('social platform MISSING: ' + p));

  // NAVIGATION
  has(nav, 'id="navigation-rows"') ? pass('navigation: rows') : fail('navigation: rows MISSING');
  has(nav, 'data-action="add-navigation"') ? pass('navigation: add button') : fail('navigation: add MISSING');

  // MEDIA
  has(med, 'id="media-grid"') ? pass('media: grid') : fail('media: grid MISSING');
  has(med, 'media-search') ? pass('media: search') : fail('media: search MISSING');
  has(med, 'id="media-tile-template"') ? pass('media: tile template') : fail('media: tile template MISSING');
  ['edit-media','view-usage','replace-media','delete-media'].forEach(a =>
    has(med, 'data-action="' + a + '"') ? pass('media: ' + a) : fail('media MISSING: ' + a));

  // SETTINGS
  has(set, 'id="settings-view-template"') ? pass('settings: template') : fail('settings: template MISSING');
  has(set, 'ADMIN_USERNAME') ? pass('settings: credential info') : fail('settings: credential info MISSING');

  // PHOTO DIALOG
  [
    'name="photo"','name="title"','name="category"','name="location"',
    'name="photoDate"','name="tags"','name="displayOrder"','name="description"',
    'name="featured"','name="published"','name="hidden"','data-photo-sections','data-submit-label'
  ].forEach(f => has(shared, f) ? pass('photo dialog: ' + f) : fail('photo dialog MISSING: ' + f));

  // SECTION DIALOG
  ['name="name"','name="slug"','name="displayOrder"','name="description"','name="visible"'].forEach(f =>
    has(shared, f) ? pass('section dialog: ' + f) : fail('section dialog MISSING: ' + f));

  // NAV DIALOG
  ['name="label"','name="url"','name="icon"'].forEach(f =>
    has(shared, f) ? pass('nav dialog: ' + f) : fail('nav dialog MISSING: ' + f));

  // MEDIA DIALOGS
  (has(shared,'name="fileName"') && has(shared,'name="altText"')) ? pass('media edit: fields') : fail('media edit: fields MISSING');
  has(shared,'id="replacement-photo"') ? pass('media replace: input') : fail('media replace: input MISSING');

  // SIDEBAR
  ['dashboard','portfolio','gallery','sections','content','social','navigation','media','settings'].forEach(route =>
    has(shared, 'data-route="' + route + '"') ? pass('sidebar: ' + route) : fail('sidebar MISSING: ' + route));
  has(shared, 'data-action="logout"') ? pass('sidebar: logout') : fail('sidebar: logout MISSING');

  // admin.js template refs
  [
    'admin-layout-template','admin-pill-template','admin-notice-template','admin-dialog-template',
    'admin-error-template','portfolio-row-template','photo-dialog-form-template',
    'section-dialog-form-template','social-dialog-form-template','navigation-dialog-form-template',
    'media-edit-form-template','media-replace-form-template','admin-login-template',
    'dashboard-view-template','admin-stat-template','portfolio-view-template','gallery-view-template',
    'sections-view-template','section-row-template','content-view-template','social-view-template',
    'social-row-template','navigation-view-template','navigation-row-template',
    'media-view-template','media-tile-template','settings-view-template'
  ].forEach(t => has(adminJs, t) ? pass('admin.js ref: ' + t) : fail('admin.js MISSING ref: ' + t));

  // admin.js actions
  [
    'logout','add-photo','edit-photo','delete-photo','toggle-publish','toggle-featured','toggle-hidden',
    'add-section','edit-section','toggle-section','delete-section','add-social','edit-social','toggle-social',
    'delete-social','add-navigation','edit-navigation','toggle-navigation','delete-navigation',
    'view-usage','edit-media','replace-media','delete-media'
  ].forEach(a => has(adminJs, '"' + a + '"') ? pass('admin.js action: ' + a) : fail('admin.js MISSING action: ' + a));

  // admin.js functions
  [
    'loginView','dashboard','portfolioPage','galleryOnly','sectionPage','contentPage',
    'socialPage','navigationPage','mediaPage','settingsPage','showDialog','setupDragSort',
    'filterPhotoRows','filterSocialRows','toggleRecord','deleteRecord','api','render','navigate'
  ].forEach(f => has(adminJs, f) ? pass('admin.js fn: ' + f) : fail('admin.js MISSING fn: ' + f));

  // CSS
  [
    '.admin-layout','.admin-sidebar','.admin-nav','.admin-main','.admin-topbar',
    '.admin-card','.stat-grid','.stat-value','.stat-label','.quick-actions',
    '.admin-button','.admin-button-secondary','.admin-toolbar','.admin-form',
    '.admin-form-grid','.admin-field','.admin-field.full','.admin-table','.admin-thumb',
    '.admin-actions','.status-pill','.status-pill.draft','.media-grid','.media-tile',
    '.drag-row','.drag-row.dragging','.drag-handle','.admin-notice','.admin-notice.error',
    '.admin-empty','.admin-dialog-backdrop','.admin-dialog','.admin-dialog-head',
    '.admin-dialog-actions','.admin-preview','.check-grid','.admin-check','.login-shell',
    '.login-card','.admin-login-logo','.admin-logout','.icon-button'
  ].forEach(c => has(css, c) ? pass('css: ' + c) : fail('css MISSING: ' + c));
  (has(css,'@media (max-width: 960px)') && has(css,'@media (max-width: 680px)'))
    ? pass('css: responsive breakpoints') : fail('css: breakpoints MISSING');

  // Print
  const passes = results.filter(x => x.ok);
  const fails  = results.filter(x => !x.ok);
  if (fails.length) {
    console.log('FAILURES:');
    fails.forEach(x => console.log('  FAIL:', x.n));
  }
  console.log('\nSUMMARY:', passes.length, 'PASS,', fails.length, 'FAIL');
  process.exit(fails.length > 0 ? 1 : 0);
})();

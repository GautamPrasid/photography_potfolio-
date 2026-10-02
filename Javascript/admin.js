(() => {
  const app = document.getElementById("admin-app");
  const routeNames = [
    ["dashboard", "Dashboard", "ri-dashboard-line"],
    ["portfolio", "Portfolio", "ri-image-2-line"],
    ["gallery", "Gallery", "ri-gallery-line"],
    ["sections", "Sections", "ri-layout-grid-line"],
    ["content", "Content", "ri-file-text-line"],
    ["social", "Social", "ri-share-line"],
    ["navigation", "Navigation", "ri-menu-line"],
    ["media", "Media", "ri-folder-image-line"],
    ["settings", "Settings", "ri-settings-3-line"],
  ];
  const socialLocations = [
    ["header", "Header"], ["homepage", "Homepage"], ["about", "About"],
    ["portfolio", "Portfolio"], ["contact", "Contact"], ["footer", "Footer"],
  ];
  let currentUser = "";
  let flashMessage = "";
  let flashIsError = false;
  let draggedRow = null;

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...options.headers,
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `Request failed (${response.status}).`);
    return body;
  }

  function message(text, error = false) {
    flashMessage = text;
    flashIsError = error;
    const existing = document.querySelector(".admin-notice");
    if (existing) {
      existing.textContent = text;
      existing.classList.toggle("error", error);
    } else {
      const host = document.querySelector(".admin-main, .login-card");
      if (host) {
        const notice = document.createElement("div");
        notice.className = `admin-notice${error ? " error" : ""}`;
        notice.setAttribute("role", error ? "alert" : "status");
        notice.textContent = text;
        host.prepend(notice);
      }
    }
  }

  function clearMessage() {
    flashMessage = "";
    flashIsError = false;
  }

  function noticeMarkup() {
    return flashMessage
      ? `<div class="admin-notice${flashIsError ? " error" : ""}" role="status">${esc(flashMessage)}</div>`
      : "";
  }

  function currentRoute() {
    const name = location.pathname.replace(/^\/admin\/?/, "").split("/")[0] || "login";
    return routeNames.some(([route]) => route === name) ? name : "dashboard";
  }

  function navigate(route) {
    const target = route === "login" ? "/admin/login" : `/admin/${route}`;
    history.pushState({}, "", target);
    clearMessage();
    render();
  }

  function field(label, name, value = "", type = "text", options = {}) {
    const cls = options.full ? "admin-field full" : "admin-field";
    const input = type === "textarea"
      ? `<textarea id="${esc(name)}" name="${esc(name)}" ${options.required ? "required" : ""}>${esc(value)}</textarea>`
      : `<input id="${esc(name)}" name="${esc(name)}" type="${esc(type)}" value="${esc(value)}" ${options.required ? "required" : ""} ${options.accept ? `accept="${esc(options.accept)}"` : ""} ${options.required ? "" : ""}>`;
    return `<label class="${cls}" for="${esc(name)}">${esc(label)}${input}</label>`;
  }

  function check(name, label, checked = false, value = "true") {
    return `<label class="admin-check"><input type="checkbox" name="${esc(name)}" value="${esc(value)}" ${checked ? "checked" : ""}>${esc(label)}</label>`;
  }

  function checkOptions(name, options, selected = [], valueKey = "slug", labelKey = "title") {
    const selectedSet = new Set(selected);
    return `<div class="check-grid">${options.map((option) => (
      check(name, option[labelKey] || option.name, selectedSet.has(option[valueKey]), option[valueKey])
    )).join("")}</div>`;
  }

  function formValue(form, name) {
    return form.elements.namedItem(name)?.value?.trim() || "";
  }

  function selectedChecks(form, name) {
    return [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
  }

  function toggleMarkup(visible, visibleName = "visible") {
    return check(visibleName, "Visible", Boolean(visible));
  }

  function pill(visible, yes = "Published", no = "Draft") {
    return `<span class="status-pill${visible ? "" : " draft"}">${visible ? yes : no}</span>`;
  }

  function layout(route, body, title) {
    const nav = routeNames.map(([key, label, icon]) => `
      <a href="/admin/${key}" data-route="${key}" ${route === key ? 'aria-current="page"' : ""}>
        <i class="${icon}" aria-hidden="true"></i><span class="nav-label">${label}</span>
      </a>`).join("");
    app.innerHTML = `
      <div class="admin-layout">
        <aside class="admin-sidebar">
          <a class="admin-brand" href="/admin/dashboard">
            <img src="/assets/logo.png" alt=""><span>Portfolio Admin</span>
          </a>
          <nav class="admin-nav" aria-label="Admin navigation">${nav}</nav>
          <div class="admin-sidebar-bottom">
            <a class="admin-public-link" href="/">View website</a>
            <button class="admin-logout" type="button" data-action="logout"><i class="ri-logout-box-line"></i> Logout</button>
          </div>
        </aside>
        <main class="admin-main">
          <header class="admin-topbar"><div><h1>${esc(title)}</h1><p>Signed in as ${esc(currentUser)}</p></div></header>
          ${noticeMarkup()}
          ${body}
        </main>
      </div>`;
  }

  function loginView() {
    app.innerHTML = `
      <div class="login-shell">
        <form class="login-card admin-form" id="login-form">
          <img src="/assets/logo.png" alt="Dear Praa" style="width:7rem;max-height:4rem;object-fit:contain">
          <div><h1>Admin sign in</h1><p>Sign in to manage the photography portfolio.</p></div>
          ${noticeMarkup()}
          ${field("Username", "username", "", "text", { required: true })}
          ${field("Password", "password", "", "password", { required: true })}
          <button class="admin-button" type="submit">Sign in</button>
        </form>
      </div>`;
    document.getElementById("login-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      try {
        const result = await api("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ username: formValue(form, "username"), password: formValue(form, "password") }),
        });
        currentUser = result.username;
        navigate("dashboard");
      } catch (error) {
        message(error.message, true);
      }
    });
  }

  async function dashboard() {
    const stats = await api("/api/admin/dashboard");
    const tiles = [
      ["Total Photos", stats.totalPhotos], ["Published Photos", stats.publishedPhotos],
      ["Draft Photos", stats.draftPhotos], ["Featured Photos", stats.featuredPhotos],
      ["Portfolio Sections", stats.sections], ["Social Links", stats.socialLinks],
      ["Navigation Items", stats.navigationItems],
    ];
    layout("dashboard", `
      <section class="stat-grid">${tiles.map(([label, value]) => `
        <article class="admin-card"><span class="stat-value">${value}</span><span class="stat-label">${label}</span></article>`).join("")}
      </section>
      <section class="admin-card"><h2>Quick actions</h2>
        <div class="quick-actions">
          <button class="admin-button" data-action="add-photo">+ Upload Photo</button>
          <button class="admin-button-secondary" data-action="add-photo">+ Add Portfolio Item</button>
          <button class="admin-button-secondary" data-route="sections">+ Add Section</button>
          <button class="admin-button-secondary" data-route="social">+ Add Social Link</button>
          <button class="admin-button-secondary" data-route="content">Edit Website Content</button>
          <button class="admin-button-secondary" data-route="navigation">Manage Navigation</button>
        </div>
      </section>
      <section class="admin-card" style="margin-top:1rem"><h2>Data storage</h2>
        <p>Portfolio records and settings are stored in the local SQLite database. Uploaded photos are stored on this server.</p>
      </section>
    `, "Dashboard");
  }

  async function portfolioPage(galleryOnly = false) {
    const [items, sections] = await Promise.all([
      api("/api/admin/portfolio"),
      api("/api/admin/sections"),
    ]);
    const filteredItems = galleryOnly ? items.filter((item) => item.sections.includes("gallery")) : items;
    const categories = sections.filter((section) => !section.system);
    const rows = filteredItems.map((item) => `
      <tr draggable="true" class="drag-row" data-id="${esc(item.id)}">
        <td class="drag-handle" title="Drag to reorder">☰</td>
        <td><img class="admin-thumb" src="${esc(item.imageUrl)}" alt="${esc(item.title)}"></td>
        <td><strong>${esc(item.title)}</strong><br><span>${esc(item.fileName)}</span></td>
        <td>${esc(item.category || "—")}</td>
        <td>${item.sections.map(esc).join(", ") || "—"}</td>
        <td>${item.hidden ? pill(false, "Published", "Hidden") : pill(item.published)}</td>
        <td>${item.featured ? "Featured" : "—"}</td>
        <td>${item.displayOrder}</td>
        <td class="admin-actions">
          <button data-action="edit-photo" data-id="${esc(item.id)}">Edit</button>
          <button data-action="toggle-publish" data-id="${esc(item.id)}">${item.published ? "Unpublish" : "Publish"}</button>
          <button data-action="toggle-hidden" data-id="${esc(item.id)}">${item.hidden ? "Show" : "Hide"}</button>
          <button data-action="toggle-featured" data-id="${esc(item.id)}">${item.featured ? "Unfeature" : "Feature"}</button>
          <button data-action="delete-photo" data-id="${esc(item.id)}">Delete</button>
        </td>
      </tr>`).join("");
    const route = galleryOnly ? "gallery" : "portfolio";
    const title = galleryOnly ? "Gallery" : "Portfolio";
    const sectionChoices = sections.map((section) => `<option value="${esc(section.slug)}">${esc(section.title)}</option>`).join("");
    layout(route, `
      <section class="admin-card">
        <div class="admin-toolbar">
          <input type="search" id="photo-search" placeholder="Search title or filename" aria-label="Search photos">
          <select id="photo-category" aria-label="Filter by category"><option value="">All categories</option>${categories.map((s) => `<option value="${esc(s.slug)}">${esc(s.title)}</option>`).join("")}</select>
          <select id="photo-section" aria-label="Filter by section"><option value="">All sections</option>${sectionChoices}</select>
          <select id="photo-status" aria-label="Filter by status"><option value="">All statuses</option><option value="published">Published</option><option value="draft">Draft</option><option value="hidden">Hidden</option></select>
          <select id="photo-featured" aria-label="Filter featured"><option value="">Featured and regular</option><option value="yes">Featured</option><option value="no">Not featured</option></select>
          <button class="admin-button" data-action="add-photo">+ Add Portfolio Item</button>
        </div>
        <p>Drag rows to reorder. Order is shared with the public portfolio.</p>
        <div class="admin-table-wrap"><table class="admin-table">
          <thead><tr><th>Order</th><th>Image</th><th>Title</th><th>Category</th><th>Sections</th><th>Status</th><th>Featured</th><th>Order #</th><th>Actions</th></tr></thead>
          <tbody id="photo-rows">${rows || '<tr><td colspan="9" class="admin-empty">No portfolio items yet. Add your first photo to get started.</td></tr>'}</tbody>
        </table></div>
      </section>`, title);
    document.getElementById("photo-search").addEventListener("input", filterPhotoRows);
    ["photo-category", "photo-section", "photo-status", "photo-featured"].forEach((id) =>
      document.getElementById(id).addEventListener("change", filterPhotoRows));
    setupDragSort(document.getElementById("photo-rows"), "/api/admin/portfolio", items);
  }

  function filterPhotoRows() {
    const search = document.getElementById("photo-search").value.toLowerCase();
    const category = document.getElementById("photo-category").value;
    const section = document.getElementById("photo-section").value;
    const status = document.getElementById("photo-status").value;
    const featured = document.getElementById("photo-featured").value;
    document.querySelectorAll("#photo-rows tr[data-id]").forEach((row) => {
      const text = row.textContent.toLowerCase();
      const cells = row.querySelectorAll("td");
      const isHidden = cells[5].textContent.includes("Hidden");
      const isPublished = cells[5].textContent.includes("Published") && !isHidden;
      const isFeatured = cells[6].textContent.includes("Featured");
      row.hidden = (search && !text.includes(search))
        || (category && !cells[3].textContent.toLowerCase().includes(category))
        || (section && !cells[4].textContent.toLowerCase().includes(section))
        || (status === "published" && !isPublished)
        || (status === "draft" && isPublished)
        || (status === "hidden" && !isHidden)
        || (featured === "yes" && !isFeatured)
        || (featured === "no" && isFeatured);
    });
  }

  function showDialog(title, body, onSubmit) {
    const backdrop = document.createElement("div");
    backdrop.className = "admin-dialog-backdrop";
    backdrop.innerHTML = `<section class="admin-dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="admin-dialog-head"><h2>${esc(title)}</h2><button class="icon-button" type="button" data-close-dialog aria-label="Close">×</button></header>
      ${body}</section>`;
    document.body.appendChild(backdrop);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop || event.target.closest("[data-close-dialog]")) backdrop.remove();
    });
    const form = backdrop.querySelector("form");
    if (form && onSubmit) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const submit = form.querySelector('[type="submit"]');
        submit.disabled = true;
        try {
          await onSubmit(form);
          backdrop.remove();
        } catch (error) {
          submit.disabled = false;
          message(error.message, true);
        }
      });
    }
    return backdrop;
  }

  async function photoDialog(item = null) {
    const sections = await api("/api/admin/sections");
    const categories = sections.filter((section) => !section.system);
    const sectionOptions = sections.map((section) => ({ ...section, slug: section.slug, title: `${section.title}${section.visible ? "" : " (hidden)"}` }));
    const body = `<form class="admin-form" id="photo-form" enctype="multipart/form-data">
      ${item ? `<img class="admin-preview" src="${esc(item.imageUrl)}" alt="${esc(item.title)}">` : ""}
      <div class="admin-form-grid">
        ${field("Photo", "photo", "", "file", { full: true, accept: "image/jpeg,image/png,image/webp,image/avif", required: !item })}
        ${field("Title", "title", item?.title || "", "text", { required: true })}
        <label class="admin-field" for="category">Category<select id="category" name="category"><option value="">No category</option>${categories.map((section) => `<option value="${esc(section.slug)}" ${item?.category === section.slug ? "selected" : ""}>${esc(section.title)}</option>`).join("")}</select></label>
        ${field("Location", "location", item?.location || "")}
        ${field("Date", "photoDate", item?.photoDate || "", "date")}
        ${field("Tags (comma-separated)", "tags", item?.tags.join(", ") || "")}
        ${field("Display order", "displayOrder", item?.displayOrder ?? 0, "number")}
        ${field("Description / alt text", "description", item?.description || "", "textarea", { full: true })}
      </div>
      <h3>Display locations</h3>
      <div class="check-grid">${checkOptions("sections", sectionOptions, item?.sections || [])}</div>
      <div class="check-grid">${check("featured", "Featured", item?.featured)}${check("published", "Published", item ? item.published : true)}${check("hidden", "Hidden from public site", item?.hidden)}</div>
      <div class="admin-dialog-actions"><button class="admin-button-secondary" type="button" data-close-dialog>Cancel</button><button class="admin-button" type="submit">${item ? "Save changes" : "Upload photo"}</button></div>
    </form>`;
    showDialog(item ? "Edit portfolio item" : "Upload photo", body, async (form) => {
      const data = new FormData();
      for (const key of ["title", "category", "location", "photoDate", "tags", "displayOrder", "description"]) data.set(key, formValue(form, key));
      for (const section of selectedChecks(form, "sections")) data.append("sections", section);
      data.set("featured", form.elements.namedItem("featured").checked ? "true" : "false");
      data.set("published", form.elements.namedItem("published").checked ? "true" : "false");
      data.set("hidden", form.elements.namedItem("hidden").checked ? "true" : "false");
      const photo = form.elements.namedItem("photo").files[0];
      if (photo) {
        if (photo.size > 12 * 1024 * 1024) throw new Error("Image exceeds the 12 MB limit.");
        data.set("photo", photo);
      }
      await api(item ? `/api/admin/portfolio/${encodeURIComponent(item.id)}` : "/api/admin/portfolio", {
        method: item ? "PUT" : "POST", body: data,
      });
      message(item ? "Portfolio item updated." : "Photo uploaded.");
      await render();
    });
  }

  async function sectionPage() {
    const sections = await api("/api/admin/sections");
    const rows = sections.map((section) => `
      <tr draggable="true" class="drag-row" data-id="${esc(section.id)}">
        <td>☰</td><td><strong>${esc(section.title)}</strong></td><td>${esc(section.name)}</td>
        <td>${esc(section.slug)}</td><td>${pill(section.visible, "Visible", "Hidden")}</td><td>${section.display_order}</td>
        <td class="admin-actions">${section.system ? "Built-in display location" : `<button data-action="edit-section" data-id="${esc(section.id)}">Edit</button>
        <button data-action="toggle-section" data-id="${esc(section.id)}">${section.visible ? "Hide" : "Show"}</button>
        <button data-action="delete-section" data-id="${esc(section.id)}">Delete</button>`}</td>
      </tr>`).join("");
    layout("sections", `<section class="admin-card">
      <div class="admin-toolbar"><input type="search" id="section-search" placeholder="Search sections"><button class="admin-button" data-action="add-section">+ Create Section</button></div>
      <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Order</th><th>Title</th><th>Name</th><th>Slug</th><th>Visibility</th><th>Order #</th><th>Actions</th></tr></thead><tbody id="section-rows">${rows}</tbody></table></div>
    </section>`, "Sections");
    document.getElementById("section-search").addEventListener("input", (event) => {
      const q = event.target.value.toLowerCase();
      document.querySelectorAll("#section-rows tr").forEach((row) => { row.hidden = !row.textContent.toLowerCase().includes(q); });
    });
    setupDragSort(document.getElementById("section-rows"), "/api/admin/sections", sections);
  }

  async function sectionDialog(section = null) {
    const body = `<form class="admin-form"><div class="admin-form-grid">
      ${field("Name", "name", section?.name || "", "text", { required: true })}
      ${field("Title", "title", section?.title || "", "text", { required: true })}
      ${field("Slug", "slug", section?.slug || "")}
      ${field("Display order", "displayOrder", section?.display_order ?? 0, "number")}
      ${field("Description", "description", section?.description || "", "textarea", { full: true })}
      ${toggleMarkup(section ? section.visible : true)}
    </div><div class="admin-dialog-actions"><button class="admin-button" type="submit">${section ? "Save section" : "Create section"}</button></div></form>`;
    showDialog(section ? "Edit section" : "Create section", body, async (form) => {
      const payload = {
        name: formValue(form, "name"), title: formValue(form, "title"), slug: formValue(form, "slug"),
        displayOrder: formValue(form, "displayOrder"), description: formValue(form, "description"),
        visible: form.elements.namedItem("visible").checked,
      };
      await api(section ? `/api/admin/sections/${encodeURIComponent(section.id)}` : "/api/admin/sections", {
        method: section ? "PUT" : "POST", body: JSON.stringify(payload),
      });
      message(section ? "Section updated." : "Section created.");
      await render();
    });
  }

  async function contentPage() {
    const content = await api("/api/admin/content");
    const groups = [
      ["Homepage", "home"], ["About", "about"], ["Portfolio", "portfolio"],
      ["Contact", "contact"], ["Footer", "footer"],
    ];
    const fieldType = (key) => /Description|introduction|biography/i.test(key) ? "textarea" : "text";
    const groupMarkup = groups.map(([title, prefix]) => {
      const keys = Object.keys(content).filter((key) => key.startsWith(`${prefix}.`));
      return `<section class="admin-card"><h2>${esc(title)}</h2><div class="admin-form-grid">
        ${keys.map((key) => field(key.slice(prefix.length + 1).replace(/([A-Z])/g, " $1"), key, content[key], fieldType(key), { full: fieldType(key) === "textarea" })).join("")}
      </div></section>`;
    }).join("");
    layout("content", `<form id="content-form" class="admin-form">${groupMarkup}
      <button class="admin-button" type="submit">Save website content</button></form>`, "Website content");
    document.getElementById("content-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries([...event.currentTarget.elements]
        .filter((element) => element.name)
        .map((element) => [element.name, element.value]));
      try {
        await api("/api/admin/content", { method: "PUT", body: JSON.stringify(payload) });
        message("Website content saved.");
      } catch (error) { message(error.message, true); }
    });
  }

  async function socialPage() {
    const links = await api("/api/admin/social");
    const rows = links.map((link) => `<tr draggable="true" class="drag-row" data-id="${esc(link.id)}">
      <td><i class="${esc(link.icon)}"></i></td><td>${esc(link.displayName)}<br>${esc(link.platform)}</td>
      <td><a href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(link.url)}</a></td>
      <td>${link.locations.map(esc).join(", ") || "—"}</td><td>${pill(link.visible, "Visible", "Hidden")}</td>
      <td class="admin-actions"><button data-action="edit-social" data-id="${esc(link.id)}">Edit</button>
      <button data-action="toggle-social" data-id="${esc(link.id)}">${link.visible ? "Hide" : "Show"}</button>
      <button data-action="delete-social" data-id="${esc(link.id)}">Delete</button></td></tr>`).join("");
    layout("social", `<section class="admin-card">
      <div class="admin-toolbar"><input type="search" id="social-search" placeholder="Search name or URL">
        <select id="social-platform"><option value="">All platforms</option>${[...new Set(links.map((link) => link.platform))].map((platform) => `<option>${esc(platform)}</option>`).join("")}</select>
        <select id="social-visible"><option value="">Visible and hidden</option><option value="yes">Visible</option><option value="no">Hidden</option></select>
        <select id="social-location"><option value="">All locations</option>${socialLocations.map(([id, label]) => `<option value="${id}">${label}</option>`).join("")}</select>
        <button class="admin-button" data-action="add-social">+ Add Social Link</button></div>
      <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Icon</th><th>Platform</th><th>URL</th><th>Locations</th><th>Visibility</th><th>Actions</th></tr></thead><tbody id="social-rows">${rows}</tbody></table></div>
    </section>`, "Social links");
    ["social-search", "social-platform", "social-visible", "social-location"].forEach((id) =>
      document.getElementById(id).addEventListener("input", filterSocialRows));
    setupDragSort(document.getElementById("social-rows"), "/api/admin/social", links);
  }

  function filterSocialRows() {
    const search = document.getElementById("social-search").value.toLowerCase();
    const platform = document.getElementById("social-platform").value;
    const visible = document.getElementById("social-visible").value;
    const location = document.getElementById("social-location").value;
    document.querySelectorAll("#social-rows tr").forEach((row) => {
      const text = row.textContent.toLowerCase();
      const isVisible = row.querySelector(".status-pill").textContent === "Visible";
      row.hidden = (search && !text.includes(search))
        || (platform && !row.cells[1].textContent.includes(platform))
        || (visible === "yes" && !isVisible) || (visible === "no" && isVisible)
        || (location && !row.cells[3].textContent.includes(location));
    });
  }

  async function socialDialog(link = null) {
    const platforms = ["Instagram", "Facebook", "TikTok", "YouTube", "Pinterest", "LinkedIn", "X/Twitter", "Threads", "Behance", "Dribbble", "WhatsApp", "Email", "Website", "Custom"];
    const body = `<form class="admin-form"><div class="admin-form-grid">
      <label class="admin-field" for="platform">Platform<select id="platform" name="platform">${platforms.map((p) => `<option ${link?.platform === p ? "selected" : ""}>${esc(p)}</option>`).join("")}</select></label>
      ${field("Display name", "displayName", link?.displayName || "", "text", { required: true })}
      ${field("URL", "url", link?.url || "", "url", { required: true })}
      ${field("Icon class (Remix Icon)", "icon", link?.icon || "ri-link", "text", { required: true })}
      ${field("Display order", "displayOrder", link?.displayOrder ?? 0, "number")}
      ${toggleMarkup(link ? link.visible : true)}
      <div class="admin-field full"><span>Display locations</span>${checkOptions("locations", socialLocations.map(([slug, title]) => ({ slug, title })), link?.locations || [])}</div>
      </div><div class="admin-dialog-actions"><button class="admin-button" type="submit">${link ? "Save social link" : "Add social link"}</button></div></form>`;
    showDialog(link ? "Edit social link" : "Add social link", body, async (form) => {
      const payload = {
        platform: formValue(form, "platform"), displayName: formValue(form, "displayName"),
        url: formValue(form, "url"), icon: formValue(form, "icon"),
        displayOrder: formValue(form, "displayOrder"),
        visible: form.elements.namedItem("visible").checked,
        locations: selectedChecks(form, "locations"),
      };
      await api(link ? `/api/admin/social/${encodeURIComponent(link.id)}` : "/api/admin/social", {
        method: link ? "PUT" : "POST", body: JSON.stringify(payload),
      });
      message(link ? "Social link updated." : "Social link added.");
      await render();
    });
  }

  async function navigationPage() {
    const items = await api("/api/admin/navigation");
    const rows = items.map((item) => `<tr draggable="true" class="drag-row" data-id="${esc(item.id)}">
      <td>☰</td><td>${esc(item.label)}</td><td>${esc(item.url)}</td><td>${esc(item.icon || "—")}</td>
      <td>${pill(item.visible, "Visible", "Hidden")}</td><td>${item.displayOrder}</td>
      <td class="admin-actions"><button data-action="edit-navigation" data-id="${esc(item.id)}">Edit</button>
      <button data-action="toggle-navigation" data-id="${esc(item.id)}">${item.visible ? "Hide" : "Show"}</button>
      <button data-action="delete-navigation" data-id="${esc(item.id)}">Delete</button></td></tr>`).join("");
    layout("navigation", `<section class="admin-card">
      <div class="admin-toolbar"><button class="admin-button" data-action="add-navigation">+ Add navigation item</button></div>
      <p>Drag rows to change the order in the shared public navigation.</p>
      <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Order</th><th>Label</th><th>URL</th><th>Icon</th><th>Visibility</th><th>Order #</th><th>Actions</th></tr></thead><tbody id="navigation-rows">${rows}</tbody></table></div>
    </section>`, "Navigation");
    setupDragSort(document.getElementById("navigation-rows"), "/api/admin/navigation", items);
  }

  async function navigationDialog(item = null) {
    const body = `<form class="admin-form"><div class="admin-form-grid">
      ${field("Label", "label", item?.label || "", "text", { required: true })}
      ${field("URL (site path, #anchor, or HTTPS URL)", "url", item?.url || "", "text", { required: true })}
      ${field("Icon class", "icon", item?.icon || "")}
      ${field("Display order", "displayOrder", item?.displayOrder ?? 0, "number")}
      ${toggleMarkup(item ? item.visible : true)}
      </div><div class="admin-dialog-actions"><button class="admin-button" type="submit">${item ? "Save item" : "Add item"}</button></div></form>`;
    showDialog(item ? "Edit navigation item" : "Add navigation item", body, async (form) => {
      const payload = {
        label: formValue(form, "label"), url: formValue(form, "url"), icon: formValue(form, "icon"),
        displayOrder: formValue(form, "displayOrder"), visible: form.elements.namedItem("visible").checked,
      };
      await api(item ? `/api/admin/navigation/${encodeURIComponent(item.id)}` : "/api/admin/navigation", {
        method: item ? "PUT" : "POST", body: JSON.stringify(payload),
      });
      message(item ? "Navigation updated." : "Navigation item added.");
      await render();
    });
  }

  async function mediaPage() {
    const media = await api("/api/admin/media");
    layout("media", `<section class="admin-card">
      <div class="admin-toolbar"><input type="search" id="media-search" placeholder="Search filename or title"></div>
      <div class="media-grid" id="media-grid">${media.map((item) => `
        <article class="media-tile" data-search="${esc(`${item.file_name} ${item.usage.map((usage) => usage.title).join(" ")}`.toLowerCase())}">
          <img src="${esc(item.file_url)}" alt="${esc(item.alt_text)}" loading="lazy">
          <div class="media-tile-body"><strong>${esc(item.file_name)}</strong>
            <span>${item.item_count} portfolio use${item.item_count === 1 ? "" : "s"}</span>
            <div class="admin-actions"><button data-action="edit-media" data-id="${esc(item.id)}">Edit</button>
              <button data-action="view-usage" data-id="${esc(item.id)}">View Usage</button>
              <button data-action="replace-media" data-id="${esc(item.id)}">Replace</button>
              <button data-action="delete-media" data-id="${esc(item.id)}">Delete</button></div>
          </div>
        </article>`).join("") || '<p class="admin-empty">No media stored.</p>'}</div>
    </section>`, "Media library");
    document.getElementById("media-search").addEventListener("input", (event) => {
      const value = event.target.value.toLowerCase();
      document.querySelectorAll(".media-tile").forEach((tile) => { tile.hidden = !tile.dataset.search.includes(value); });
    });
  }

  async function settingsPage() {
    layout("settings", `<section class="admin-card">
      <h2>Server settings</h2>
      <p>Media uploads accept JPEG, PNG, WebP, or AVIF files up to 12 MB. The CMS database is stored in <code>data/portfolio.sqlite</code>; image uploads are stored in <code>uploads/</code>.</p>
      <p>Admin credentials are read from the server's <code>.env</code> file. To change them, update <code>ADMIN_USERNAME</code> or <code>ADMIN_PASSWORD</code> there, then restart the server. Passwords are never stored in the database or sent back to this page.</p>
      <p>Use HTTPS before exposing this server publicly. Back up the database and uploads together.</p>
      <a class="admin-button-secondary" href="/">Open public website</a>
    </section>`, "Settings");
  }

  function setupDragSort(tbody, endpoint, values) {
    if (!tbody) return;
    tbody.addEventListener("dragstart", (event) => {
      const row = event.target.closest("tr[draggable=true]");
      if (!row) return;
      draggedRow = row;
      row.classList.add("dragging");
      event.dataTransfer.effectAllowed = "move";
    });
    tbody.addEventListener("dragend", async () => {
      if (!draggedRow) return;
      draggedRow.classList.remove("dragging");
      draggedRow = null;
      const rows = [...tbody.querySelectorAll("tr[data-id]")];
      try {
        await Promise.all(rows.map((row, index) => {
          const record = values.find((value) => value.id === row.dataset.id);
          if (!record) return Promise.resolve();
          const payload = { ...record, displayOrder: index };
          return api(`${endpoint}/${encodeURIComponent(record.id)}`, {
            method: "PUT", body: JSON.stringify(payload),
          });
        }));
        message("Display order saved.");
      } catch (error) { message(error.message, true); }
    });
    tbody.addEventListener("dragover", (event) => {
      event.preventDefault();
      const target = event.target.closest("tr[draggable=true]");
      if (target && draggedRow && target !== draggedRow) {
        const box = target.getBoundingClientRect();
        tbody.insertBefore(draggedRow, event.clientY < box.top + box.height / 2 ? target : target.nextSibling);
      }
    });
  }

  async function findById(endpoint, id) {
    const values = await api(endpoint);
    return values.find((value) => value.id === id);
  }

  async function confirmDelete(messageText) {
    return window.confirm(messageText);
  }

  async function action(event) {
    const target = event.target.closest("[data-action]");
    if (!target) return false;
    const actionName = target.dataset.action;
    const id = target.dataset.id;
    try {
      if (actionName === "logout") {
        await api("/api/auth/logout", { method: "POST", body: "{}" });
        currentUser = "";
        navigate("login");
      } else if (actionName === "add-photo") {
        await photoDialog();
      } else if (actionName === "edit-photo") {
        await photoDialog(await findById("/api/admin/portfolio", id));
      } else if (actionName === "delete-photo") {
        const item = await findById("/api/admin/portfolio", id);
        if (await confirmDelete(`Delete "${item.title}" from the portfolio? Its image is removed only if nothing else uses it.`)) {
          await api(`/api/admin/portfolio/${encodeURIComponent(id)}`, { method: "DELETE" });
          message("Portfolio item deleted.");
          await render();
        }
      } else if (actionName === "toggle-publish" || actionName === "toggle-featured" || actionName === "toggle-hidden") {
        const item = await findById("/api/admin/portfolio", id);
        const featured = actionName === "toggle-featured" ? !item.featured : item.featured;
        const sections = new Set(item.sections);
        if (actionName === "toggle-publish") {
          item.published = !item.published;
          if (!item.published) item.hidden = false;
        }
        if (actionName === "toggle-featured") item.featured = featured;
        if (actionName === "toggle-hidden") item.hidden = !item.hidden;
        if (featured) sections.add("featured"); else sections.delete("featured");
        await api(`/api/admin/portfolio/${encodeURIComponent(id)}`, {
          method: "PUT", body: JSON.stringify({ ...item, sections: [...sections] }),
        });
        message(actionName === "toggle-publish" ? "Publication status updated." : actionName === "toggle-hidden" ? "Visibility updated." : "Featured status updated.");
        await render();
      } else if (actionName === "add-section") {
        await sectionDialog();
      } else if (actionName === "edit-section" || actionName === "toggle-section") {
        const section = await findById("/api/admin/sections", id);
        if (actionName === "toggle-section") {
          await api(`/api/admin/sections/${encodeURIComponent(id)}`, {
            method: "PUT", body: JSON.stringify({ ...section, visible: !section.visible }),
          });
          message("Section visibility updated.");
          await render();
        } else await sectionDialog(section);
      } else if (actionName === "delete-section") {
        const section = await findById("/api/admin/sections", id);
        if (await confirmDelete(`Delete section "${section.title}"? Photos remain in the database but lose this section assignment.`)) {
          await api(`/api/admin/sections/${encodeURIComponent(id)}`, { method: "DELETE" });
          message("Section deleted.");
          await render();
        }
      } else if (actionName === "add-social") {
        await socialDialog();
      } else if (actionName === "edit-social" || actionName === "toggle-social") {
        const link = await findById("/api/admin/social", id);
        if (actionName === "toggle-social") {
          await api(`/api/admin/social/${encodeURIComponent(id)}`, {
            method: "PUT", body: JSON.stringify({ ...link, visible: !link.visible }),
          });
          message("Social link visibility updated.");
          await render();
        } else await socialDialog(link);
      } else if (actionName === "delete-social") {
        const link = await findById("/api/admin/social", id);
        if (await confirmDelete(`Delete ${link.displayName}? It will disappear from every selected public location.`)) {
          await api(`/api/admin/social/${encodeURIComponent(id)}`, { method: "DELETE" });
          message("Social link deleted.");
          await render();
        }
      } else if (actionName === "add-navigation") {
        await navigationDialog();
      } else if (actionName === "edit-navigation" || actionName === "toggle-navigation") {
        const item = await findById("/api/admin/navigation", id);
        if (actionName === "toggle-navigation") {
          await api(`/api/admin/navigation/${encodeURIComponent(id)}`, {
            method: "PUT", body: JSON.stringify({ ...item, visible: !item.visible }),
          });
          message("Navigation visibility updated.");
          await render();
        } else await navigationDialog(item);
      } else if (actionName === "delete-navigation") {
        const item = await findById("/api/admin/navigation", id);
        if (await confirmDelete(`Delete navigation item "${item.label}"?`)) {
          await api(`/api/admin/navigation/${encodeURIComponent(id)}`, { method: "DELETE" });
          message("Navigation item deleted.");
          await render();
        }
      } else if (actionName === "view-usage") {
        const items = await api("/api/admin/media");
        const media = items.find((entry) => entry.id === id);
        const usage = media.usage.map((entry) => `${entry.title}: ${entry.slug || "unassigned"}${entry.is_published ? " (published)" : " (draft)"}`).join("\n");
        window.alert(usage || "This image is not used by any portfolio item.");
      } else if (actionName === "edit-media") {
        const media = (await api("/api/admin/media")).find((entry) => entry.id === id);
        const body = `<form class="admin-form"><div class="admin-form-grid">
          ${field("Display filename", "fileName", media.file_name, "text", { required: true })}
          ${field("Alt text", "altText", media.alt_text, "text")}
        </div><div class="admin-dialog-actions"><button class="admin-button" type="submit">Save details</button></div></form>`;
        showDialog("Edit media details", body, async (form) => {
          await api(`/api/admin/media/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: JSON.stringify({ fileName: formValue(form, "fileName"), altText: formValue(form, "altText") }),
          });
          message("Media details updated.");
          await render();
        });
      } else if (actionName === "delete-media") {
        const result = await fetch(`/api/admin/media/${encodeURIComponent(id)}`, { credentials: "same-origin" });
        const media = await result.json();
        if (!result.ok && result.status !== 409) throw new Error(media.error || "Could not inspect media.");
        if (media.usage?.length) {
          const usages = [...new Set(media.usage.map((entry) => entry.slug).filter(Boolean))].join(", ");
          const choice = window.prompt(`Image currently used in: ${usages || "portfolio items"}\nType REMOVE to unpublish and remove section assignments, or DELETE to permanently delete the image and portfolio records. Cancel to keep it.`);
          if (choice === "REMOVE") {
            await api(`/api/admin/media/${encodeURIComponent(id)}?mode=remove-from-sections`, { method: "DELETE" });
            message("Image removed from sections and affected items unpublished.");
          } else if (choice === "DELETE") {
            await api(`/api/admin/media/${encodeURIComponent(id)}?mode=permanent`, { method: "DELETE" });
            message("Image and its portfolio records permanently deleted.");
          } else return true;
        } else if (await confirmDelete("Delete this unused image permanently?")) {
          await api(`/api/admin/media/${encodeURIComponent(id)}?mode=permanent`, { method: "DELETE" });
          message("Image deleted.");
        } else return true;
        await render();
      } else if (actionName === "replace-media") {
        const formMarkup = `<form class="admin-form"><label class="admin-field">Replacement photo<input type="file" name="photo" accept="image/jpeg,image/png,image/webp,image/avif" required></label><div class="admin-dialog-actions"><button class="admin-button" type="submit">Replace image</button></div></form>`;
        showDialog("Replace media file", formMarkup, async (form) => {
          const data = new FormData();
          data.set("photo", form.elements.namedItem("photo").files[0]);
          await api(`/api/admin/media/${encodeURIComponent(id)}`, { method: "PUT", body: data });
          message("Image replaced; all references now use the new file.");
          await render();
        });
      }
    } catch (error) {
      message(error.message, true);
    }
    return true;
  }

  async function render() {
    try {
      const session = await api("/api/auth/session");
      if (!session.authenticated && currentRoute() !== "login") {
        history.replaceState({}, "", "/admin/login");
        currentUser = "";
        return loginView();
      }
      if (!session.authenticated) {
        currentUser = "";
        return loginView();
      }
      currentUser = session.username;
      const route = currentRoute();
      const pages = {
        dashboard,
        portfolio: () => portfolioPage(false),
        gallery: () => portfolioPage(true),
        sections: sectionPage,
        content: contentPage,
        social: socialPage,
        navigation: navigationPage,
        media: mediaPage,
        settings: settingsPage,
      };
      await pages[route]();
    } catch (error) {
      app.innerHTML = `<div class="login-shell"><section class="login-card"><h1>Admin unavailable</h1><p>${esc(error.message)}</p><a href="/admin/login">Return to sign in</a></section></div>`;
    }
  }

  document.addEventListener("click", async (event) => {
    const routeLink = event.target.closest("[data-route]");
    if (routeLink) {
      event.preventDefault();
      navigate(routeLink.dataset.route);
      return;
    }
    await action(event);
  });

  window.addEventListener("popstate", () => { clearMessage(); render(); });
  render();
})();

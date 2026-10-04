try {
  if (typeof process.loadEnvFile === "function") process.loadEnvFile();
} catch { }

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { analyzePhoto } = require("./ai-photo-service.js");

const ROOT = path.resolve(__dirname, "..");
const IS_VERCEL = Boolean(process.env.VERCEL);
const PORT = Number(process.env.PORT || 3000);
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const SESSION_TTL = 8 * 60 * 60 * 1000;
const RESERVED_SLUGS = new Set([
  "homepage", "portfolio", "gallery", "featured", "about", "contact",
]);
const SESSION_COOKIE = "photography_admin";
const ALLOWED_IMAGE_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/avif", ".avif"],
]);

// ── Supabase configuration ────────────────────────────────────────────────────
const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  "";
const SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "portfolio";

function supabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SECRET_KEY);
}

function sbHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SECRET_KEY,
    Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
    ...extra,
  };
}

async function sbSelect(table, query = "") {
  if (!supabaseConfigured()) throw new Error("Supabase is not configured.");
  const url = `${SUPABASE_URL}/rest/v1/${table}${query ? "?" + query : ""}`;
  const res = await fetch(url, { headers: sbHeaders({ Accept: "application/json" }) });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(`Supabase SELECT ${table} failed (${res.status}): ${detail.message || JSON.stringify(detail)}`);
  }
  return res.json();
}

async function sbInsert(table, data, { onConflict = null, returning = "representation" } = {}) {
  if (!supabaseConfigured()) throw new Error("Supabase is not configured.");
  const prefer = [`return=${returning}`, onConflict ? "resolution=merge-duplicates" : null].filter(Boolean).join(",");
  const url = `${SUPABASE_URL}/rest/v1/${table}${onConflict ? "?on_conflict=" + onConflict : ""}`;
  const res = await fetch(url, {
    method: "POST",
    headers: sbHeaders({ "Content-Type": "application/json", Prefer: prefer }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(`Supabase INSERT ${table} failed (${res.status}): ${detail.message || JSON.stringify(detail)}`);
  }
  if (returning === "representation") return res.json();
  return null;
}

async function sbUpdate(table, filter, data) {
  if (!supabaseConfigured()) throw new Error("Supabase is not configured.");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: sbHeaders({ "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(`Supabase UPDATE ${table} failed (${res.status}): ${detail.message || JSON.stringify(detail)}`);
  }
  return res.json();
}

async function sbUpsert(table, data, onConflict) {
  if (!supabaseConfigured()) throw new Error("Supabase is not configured.");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: sbHeaders({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(`Supabase UPSERT ${table} failed (${res.status}): ${detail.message || JSON.stringify(detail)}`);
  }
  return res.json();
}

async function sbDelete(table, filter) {
  if (!supabaseConfigured()) throw new Error("Supabase is not configured.");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: "DELETE",
    headers: sbHeaders({ Prefer: "return=minimal" }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error(`Supabase DELETE ${table} failed (${res.status}): ${detail.message || JSON.stringify(detail)}`);
  }
}

function formatStoragePath(storagePath) {
  return String(storagePath).split("/").map(encodeURIComponent).join("/");
}

async function storageUpload(storagePath, buffer, mimeType) {
  if (!supabaseConfigured()) throw new Error("Supabase is not configured.");
  const pathPart = formatStoragePath(storagePath);
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${pathPart}`,
    {
      method: "POST",
      headers: sbHeaders({ "Content-Type": mimeType, "x-upsert": "true" }),
      body: buffer,
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Supabase Storage upload failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${pathPart}`;
}

async function storageDelete(storagePath) {
  if (!supabaseConfigured() || !storagePath) return;
  const pathPart = formatStoragePath(storagePath);
  await fetch(
    `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${pathPart}`,
    { method: "DELETE", headers: sbHeaders() },
  ).catch(() => { });
}

function storagePathFromUrl(fileUrl) {
  if (!fileUrl) return null;
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/`;
  if (fileUrl.startsWith(prefix)) {
    return decodeURI(fileUrl.slice(prefix.length));
  }
  return null;
}

// ── Production startup checks ─────────────────────────────────────────────────
const IS_PROD = IS_VERCEL || process.env.NODE_ENV === "production";

if (IS_PROD) {
  // Public pages only need Supabase. Do not crash the entire Vercel function
  // because an admin-only secret is missing; admin routes validate their own
  // configuration when they are used.
  const missing = [
    !SUPABASE_URL && "SUPABASE_URL",
    !SUPABASE_SECRET_KEY && "SUPABASE_SECRET_KEY",
  ].filter(Boolean);
  if (missing.length > 0) {
    console.error(`Supabase configuration is incomplete: ${missing.join(", ")}`);
  }

  const adminMissing = [
    !process.env.SESSION_SECRET && "SESSION_SECRET",
    !process.env.ADMIN_USERNAME && "ADMIN_USERNAME",
    !process.env.ADMIN_PASSWORD && "ADMIN_PASSWORD",
  ].filter(Boolean);
  if (adminMissing.length > 0) {
    console.error(`Admin configuration is incomplete: ${adminMissing.join(", ")}`);
  } else if (process.env.ADMIN_PASSWORD.length < 8) {
    console.error("ADMIN_PASSWORD must be at least 8 characters in production.");
  }
} else {
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
    console.error("Set ADMIN_USERNAME and ADMIN_PASSWORD in .env before starting the CMS.");
    process.exit(1);
  }
  if (process.env.ADMIN_PASSWORD.length < 8) {
    console.error("ADMIN_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }
  if (!supabaseConfigured()) {
    console.warn("Warning: SUPABASE_URL or SUPABASE_SECRET_KEY is not set. Database operations will fail.");
  }
}

const SESSION_SECRET = process.env.SESSION_SECRET || "dev-insecure-session-secret-local-only";

const loginAttempts = new Map();
const aiAnalysisCooldowns = new Map();
const MIME_BY_EXTENSION = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".avif", "image/avif"],
  [".ico", "image/x-icon"],
]);

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  return res.end(JSON.stringify(payload));
}

function readBody(req, limit = MAX_UPLOAD_BYTES + 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error("Request body is too large."), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function readJson(req) {
  const raw = await readBody(req, 1024 * 1024);
  try {
    return JSON.parse(raw.toString("utf8") || "{}");
  } catch {
    throw Object.assign(new Error("Request body must be valid JSON."), { status: 400 });
  }
}

function parseMultipart(buffer, contentType) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw Object.assign(new Error("Missing multipart boundary."), { status: 400 });
  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  const fields = {};
  const files = [];
  let cursor = buffer.indexOf(boundary);
  while (cursor !== -1) {
    cursor += boundary.length;
    if (buffer.subarray(cursor, cursor + 2).equals(Buffer.from("--"))) break;
    if (buffer.subarray(cursor, cursor + 2).equals(Buffer.from("\r\n"))) cursor += 2;
    const headerEnd = buffer.indexOf(Buffer.from("\r\n\r\n"), cursor);
    if (headerEnd === -1) break;
    const headerText = buffer.subarray(cursor, headerEnd).toString("utf8");
    const contentStart = headerEnd + 4;
    const nextBoundary = buffer.indexOf(Buffer.concat([Buffer.from("\r\n"), boundary]), contentStart);
    if (nextBoundary === -1) break;
    const disposition = headerText.match(/content-disposition:\s*form-data;([^\r\n]+)/i)?.[1] || "";
    const nameMatch = disposition.match(/(?:^|;)\s*name=(?:"([^"]*)"|([^;]*))/i);
    const filenameMatch = disposition.match(/(?:^|;)\s*filename=(?:"([^"]*)"|([^;]*))/i);
    const name = (nameMatch?.[1] ?? nameMatch?.[2])?.trim();
    const filename = (filenameMatch?.[1] ?? filenameMatch?.[2])?.trim();
    const data = buffer.subarray(contentStart, nextBoundary);
    if (name && filename !== undefined && filename !== "") {
      const rawType = headerText.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim().toLowerCase() || "";
      let type = rawType.split(";")[0].trim();
      if (type === "image/jpg" || type === "image/pjpeg") type = "image/jpeg";
      files.push({ name, filename: path.basename(filename), type, data });
    } else if (name) {
      const value = data.toString("utf8");
      if (Object.hasOwn(fields, name)) {
        fields[name] = Array.isArray(fields[name]) ? [...fields[name], value] : [fields[name], value];
      } else {
        fields[name] = value;
      }
    }
    cursor = nextBoundary + 2;
  }
  return { fields, files };
}

// ── Data serializers ──────────────────────────────────────────────────────────
function serializePortfolioItem(row) {
  return {
    id: row.id,
    mediaId: row.media_id,
    imageUrl: row.file_url,
    fileName: row.file_name,
    mimeType: row.mime_type,
    altText: row.alt_text || "",
    aiMetadata: row.ai_metadata || null,
    title: row.title,
    description: row.description,
    category: row.category,
    location: row.location,
    photoDate: row.photo_date,
    tags: row.tags
      ? (Array.isArray(row.tags) ? row.tags : row.tags.split(",").map((t) => t.trim())).filter(Boolean)
      : [],
    featured: Boolean(row.is_featured),
    published: Boolean(row.is_published),
    hidden: Boolean(row.is_hidden),
    displayOrder: row.display_order,
    sections: row.sections
      ? (Array.isArray(row.sections) ? row.sections : row.sections.split(",")).filter(Boolean)
      : [],
  };
}

// ── Database read functions ───────────────────────────────────────────────────
async function getPortfolioItems({ publicOnly = false } = {}) {
  let query = "select=*,media(id,file_name,file_url,mime_type,alt_text,ai_metadata),portfolio_item_sections(section_id,sections(slug))&order=display_order,created_at";
  if (publicOnly) query += "&is_published=eq.true&is_hidden=eq.false";
  const rows = await sbSelect("portfolio_items", query);
  return rows.map((row) => {
    const media = row.media || {};
    const sections = (row.portfolio_item_sections || [])
      .map((pis) => pis.sections?.slug)
      .filter(Boolean);
    return serializePortfolioItem({
      ...row,
      file_url: media.file_url,
      file_name: media.file_name,
      mime_type: media.mime_type,
      alt_text: media.alt_text,
      ai_metadata: media.ai_metadata,
      sections: sections.join(","),
    });
  });
}

async function getPortfolioItem(id) {
  const rows = await sbSelect(
    "portfolio_items",
    `select=*,media(id,file_name,file_url,mime_type,alt_text,ai_metadata),portfolio_item_sections(section_id,sections(slug))&id=eq.${encodeURIComponent(id)}`,
  );
  if (!rows.length) return null;
  const row = rows[0];
  const media = row.media || {};
  const sections = (row.portfolio_item_sections || [])
    .map((pis) => pis.sections?.slug)
    .filter(Boolean);
  return serializePortfolioItem({
    ...row,
    file_url: media.file_url,
    file_name: media.file_name,
    mime_type: media.mime_type,
    alt_text: media.alt_text,
    ai_metadata: media.ai_metadata,
    sections: sections.join(","),
  });
}

async function getSections() {
  const rows = await sbSelect("sections", "order=display_order,name");
  return rows.map((s) => ({
    ...s,
    visible: Boolean(s.is_visible),
    system: Boolean(s.is_system),
  }));
}

async function getSocialLinks() {
  const rows = await sbSelect(
    "social_links",
    "select=*,social_link_locations(location,display_order)&order=display_order,display_name",
  );
  return rows.map((link) => ({
    id: link.id,
    platform: link.platform,
    displayName: link.display_name,
    url: link.url,
    icon: link.icon,
    visible: Boolean(link.is_visible),
    displayOrder: link.display_order,
    locations: (link.social_link_locations || [])
      .sort((a, b) => a.display_order - b.display_order)
      .map((l) => l.location),
  }));
}

async function getNavigation() {
  const rows = await sbSelect("navigation_items", "order=display_order,label");
  return rows.map((item) => ({
    id: item.id,
    label: item.label,
    url: item.url,
    icon: item.icon,
    visible: Boolean(item.is_visible),
    displayOrder: item.display_order,
  }));
}

async function getContent() {
  const rows = await sbSelect("site_content", "select=content_key,content_value");
  return Object.fromEntries(rows.map((r) => [r.content_key, r.content_value]));
}

async function getSkills({ visibleOnly = false } = {}) {
  const filter = visibleOnly ? "&is_visible=eq.true" : "";
  const rows = await sbSelect("skills", `order=display_order,name${filter}`);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    percent: r.percent,
    icon: r.icon,
    displayOrder: r.display_order,
    visible: Boolean(r.is_visible),
  }));
}

async function getMediaItem(id) {
  const rows = await sbSelect("media", `id=eq.${encodeURIComponent(id)}`);
  return rows[0] || null;
}

async function mediaUsage(mediaId) {
  const rows = await sbSelect(
    "portfolio_items",
    `select=id,title,is_published,portfolio_item_sections(sections(slug))&media_id=eq.${encodeURIComponent(mediaId)}&order=display_order`,
  );
  return rows.map((p) => ({
    id: p.id,
    title: p.title,
    is_published: p.is_published,
    slug: (p.portfolio_item_sections || [])[0]?.sections?.slug || null,
  }));
}

// ── Section location helpers ──────────────────────────────────────────────────
async function parseLocations(body) {
  const selected = Array.isArray(body.sections) ? body.sections : [];
  const allSections = await getSections();
  const known = new Set(allSections.map((s) => s.slug));
  const unique = [...new Set(selected.map(String))];
  if (unique.some((slug) => !known.has(slug))) {
    throw Object.assign(new Error("One or more selected display locations do not exist."), { status: 400 });
  }
  return unique;
}

async function saveLocations(itemId, slugs) {
  await sbDelete("portfolio_item_sections", `portfolio_item_id=eq.${encodeURIComponent(itemId)}`);
  if (!slugs.length) return;
  const sections = await sbSelect("sections", `slug=in.(${slugs.map(encodeURIComponent).join(",")})&select=id,slug`);
  const sectionMap = Object.fromEntries(sections.map((s) => [s.slug, s.id]));
  const toInsert = slugs
    .map((slug) => ({ portfolio_item_id: itemId, section_id: sectionMap[slug] }))
    .filter((r) => r.section_id);
  if (toInsert.length) await sbInsert("portfolio_item_sections", toInsert, { returning: "minimal" });
}

async function assignSocialLocations(linkId, locations) {
  const aliases = new Map([
    ["home", "homepage"],
    ["main", "homepage"],
    ["index", "homepage"],
    ["about-page", "about"],
    ["portfolio-page", "portfolio"],
    ["contact-page", "contact"],
    ["footer-page", "footer"],
  ]);
  const allowed = new Set(["header", "homepage", "about", "portfolio", "contact", "footer"]);
  const normalized = [...new Set(
    (Array.isArray(locations) ? locations : [])
      .map((location) => String(location || "").trim().toLowerCase())
      .filter(Boolean)
      .map((location) => aliases.get(location) || location),
  )];
  if (normalized.some((location) => !allowed.has(location))) {
    throw Object.assign(new Error("Unknown social display location."), { status: 400 });
  }
  await sbDelete("social_link_locations", `social_link_id=eq.${encodeURIComponent(linkId)}`);
  if (!normalized.length) return;
  await sbInsert(
    "social_link_locations",
    normalized.map((loc, i) => ({ social_link_id: linkId, location: loc, display_order: i })),
    { returning: "minimal" },
  );
}

// ── Session / Auth ────────────────────────────────────────────────────────────
function createSessionToken(username) {
  const expiresAt = Date.now() + SESSION_TTL;
  const payload = Buffer.from(JSON.stringify({ u: username, exp: expiresAt }), "utf8").toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== "string") return null;
  const dotIndex = token.lastIndexOf(".");
  if (dotIndex === -1) return null;
  const payloadB64 = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);
  if (!payloadB64 || !signature) return null;
  const expectedSignature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payloadB64)
    .digest("base64url");
  const sigBuf = Buffer.from(signature, "utf8");
  const expBuf = Buffer.from(expectedSignature, "utf8");
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const data = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    if (!data || typeof data !== "object") return null;
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    if (typeof data.u !== "string" || data.u !== process.env.ADMIN_USERNAME) return null;
    return { username: data.u, expiresAt: data.exp };
  } catch {
    return null;
  }
}

function getSession(req) {
  const cookie = req.headers.cookie || "";
  const rawToken = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`))?.[1];
  if (!rawToken) return null;
  let token;
  try { token = decodeURIComponent(rawToken); } catch { return null; }
  const verified = verifySessionToken(token);
  if (!verified) return null;
  const key = crypto.createHash("sha256").update(token).digest("hex");
  return { key, session: verified };
}

function adminConfigured() {
  return Boolean(
    process.env.SESSION_SECRET &&
    process.env.ADMIN_USERNAME &&
    process.env.ADMIN_PASSWORD &&
    process.env.ADMIN_PASSWORD.length >= 8,
  );
}

function requireAdmin(req, res) {
  if (!adminConfigured()) {
    sendJson(res, 503, { error: "Admin authentication is not configured on the server." });
    return false;
  }
  if (!getSession(req)) {
    sendJson(res, 401, { error: "Authentication required." });
    return false;
  }
  return true;
}

function isSecureRequest(req) {
  if (IS_VERCEL) return req.headers["x-forwarded-proto"]?.split(",")[0].trim() === "https";
  return Boolean(req.socket.encrypted);
}

function checkOrigin(req, res) {
  const origin = req.headers.origin;
  if (origin) {
    const forwardedProto = IS_VERCEL && req.headers["x-forwarded-proto"]
      ? req.headers["x-forwarded-proto"].split(",")[0].trim() : "";
    const forwardedHost = IS_VERCEL && req.headers["x-forwarded-host"]
      ? req.headers["x-forwarded-host"].split(",")[0].trim() : "";
    const scheme = forwardedProto || (isSecureRequest(req) ? "https" : "http");
    const host = forwardedHost || req.headers.host;
    let matchesOrigin = false;
    try {
      const parsedOrigin = new URL(origin);
      const expectedOrigin = new URL(`${scheme}://${host}`);
      matchesOrigin = parsedOrigin.origin === expectedOrigin.origin
        && parsedOrigin.pathname === "/"
        && !parsedOrigin.search && !parsedOrigin.hash;
    } catch { matchesOrigin = false; }
    if (!matchesOrigin) {
      sendJson(res, 403, { error: "Cross-origin write requests are not allowed." });
      return false;
    }
  }
  return true;
}

function validateExternalUrl(value, schemes = ["https:"]) {
  try {
    const parsed = new URL(String(value));
    if (!schemes.includes(parsed.protocol)) throw new Error();
    return parsed.href;
  } catch {
    throw Object.assign(new Error("Enter a valid URL using an allowed protocol."), { status: 400 });
  }
}

function boolValue(value) {
  return value === true || value === "true" || value === "1" || value === 1;
}

function normalizeSlug(value) {
  return String(value || "").trim().toLowerCase()
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function isValidImage(data, type) {
  if (!data || data.length < 12) return false;
  let normType = (type || "").split(";")[0].trim().toLowerCase();
  if (normType === "image/jpg" || normType === "image/pjpeg") normType = "image/jpeg";
  if (normType === "image/jpeg") return data[0] === 0xff && data[1] === 0xd8;
  if (normType === "image/png") return data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (normType === "image/webp") return data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP";
  if (normType === "image/avif") return data.toString("ascii", 4, 8) === "ftyp" && data.subarray(8, 128).toString("ascii").includes("avif");
  return false;
}

// ── Media cleanup ─────────────────────────────────────────────────────────────
async function cleanupUnusedMedia(mediaId) {
  const media = await getMediaItem(mediaId);
  if (!media) return;
  const rows = await sbSelect("portfolio_items", `media_id=eq.${encodeURIComponent(mediaId)}&select=id&limit=1`);
  if (rows.length === 0) {
    await sbDelete("media", `id=eq.${encodeURIComponent(mediaId)}`);
    const storagePath = storagePathFromUrl(media.file_url);
    if (storagePath) await storageDelete(storagePath);
  }
}

// ── Ensure system sections exist ──────────────────────────────────────────────
async function ensureSystemSections() {
  try {
    const existing = await sbSelect("sections", "is_system=eq.true&select=id");
    if (existing.length > 0) return;
    await sbInsert("sections", [
      { id: "home", name: "Homepage", title: "Homepage", description: "", slug: "homepage", display_order: 0, is_system: true, is_visible: true },
      { id: "portfolio", name: "Portfolio", title: "Portfolio", description: "", slug: "portfolio", display_order: 1, is_system: true, is_visible: true },
      { id: "gallery", name: "Gallery", title: "Gallery", description: "", slug: "gallery", display_order: 2, is_system: true, is_visible: true },
      { id: "featured", name: "Featured", title: "Featured", description: "", slug: "featured", display_order: 3, is_system: true, is_visible: true },
      { id: "about", name: "About", title: "About", description: "", slug: "about", display_order: 4, is_system: true, is_visible: true },
      { id: "contact", name: "Contact", title: "Contact", description: "", slug: "contact", display_order: 5, is_system: true, is_visible: true },
    ], { onConflict: "id", returning: "minimal" });
  } catch (e) {
    console.error("ensureSystemSections error:", e.message);
  }
}

// ── Skill write ───────────────────────────────────────────────────────────────
async function handleSkillWrite(req, res, id) {
  try {
    const body = await readJson(req);
    const name = String(body.name || "").trim();
    if (!name || name.length > 60) return sendJson(res, 400, { error: "Skill name must be 1-60 characters." });
    const rawPercent = body.percent ?? 80;
    if (typeof rawPercent === "number" && !Number.isInteger(rawPercent))
      return sendJson(res, 400, { error: "Percent must be an integer from 0 to 100." });
    const percent = Number(String(rawPercent).trim());
    if (!Number.isInteger(percent) || isNaN(percent) || percent < 0 || percent > 100)
      return sendJson(res, 400, { error: "Percent must be an integer from 0 to 100." });
    const icon = String(body.icon || "ri-star-line").trim();
    if (!/^ri-[a-z0-9-]+$/.test(icon))
      return sendJson(res, 400, { error: "Icon must match the pattern ri-<name> (e.g. ri-camera-line)." });
    const displayOrder = parseInt(body.displayOrder ?? 0, 10);
    const isVisible = boolValue(body.visible);
    if (id) {
      const existing = await sbSelect("skills", `id=eq.${encodeURIComponent(id)}&select=id`);
      if (!existing.length) return sendJson(res, 404, { error: "Skill not found." });
      await sbUpdate("skills", `id=eq.${encodeURIComponent(id)}`, { name, percent, icon, display_order: displayOrder, is_visible: isVisible });
    } else {
      const newId = crypto.randomUUID();
      await sbInsert("skills", { id: newId, name, percent, icon, display_order: displayOrder, is_visible: isVisible }, { returning: "minimal" });
    }
    return sendJson(res, 200, await getSkills());
  } catch (error) {
    return sendJson(res, error.status || 500, { error: error.status ? error.message : "Could not save skill." });
  }
}

// ── Portfolio write ───────────────────────────────────────────────────────────
async function handlePortfolioWrite(req, res, id) {
  try {
    const contentType = req.headers["content-type"] || "";
    let body;
    let imageFile = null;
    if (contentType.toLowerCase().startsWith("multipart/form-data")) {
      const parsed = parseMultipart(await readBody(req), contentType);
      body = parsed.fields;
      imageFile = parsed.files.find((f) => f.name === "photo") || null;
    } else {
      body = await readJson(req);
    }

    const existingItems = id ? await sbSelect("portfolio_items", `id=eq.${encodeURIComponent(id)}`) : [];
    const existing = existingItems[0] || null;
    if (id && !existing) return sendJson(res, 404, { error: "Portfolio item not found." });
    if (!existing && !imageFile) return sendJson(res, 400, { error: "Choose an image file to upload." });

    if (imageFile) {
      let mimeType = (imageFile.type || "").split(";")[0].trim().toLowerCase();
      if (mimeType === "image/jpg" || mimeType === "image/pjpeg") mimeType = "image/jpeg";
      imageFile.type = mimeType;
      if (!ALLOWED_IMAGE_TYPES.has(imageFile.type)) return sendJson(res, 415, { error: "Use a JPEG, PNG, WebP, or AVIF image." });
      if (imageFile.data.length > MAX_UPLOAD_BYTES) return sendJson(res, 413, { error: "Image exceeds the 12 MB limit." });
      if (imageFile.data.length < 12 || !isValidImage(imageFile.data, imageFile.type))
        return sendJson(res, 415, { error: "The uploaded file does not match its image type." });
    }

    const title = String(body.title || "").trim();
    if (!title) return sendJson(res, 400, { error: "Photo title is required." });

    const sections = new Set(await parseLocations(body));
    if (boolValue(body.featured)) sections.add("featured");
    else sections.delete("featured");

    const category = String(body.category || "").trim();
    if (category) {
      const catSection = await sbSelect("sections", `slug=eq.${encodeURIComponent(category)}&is_system=eq.false&select=id`);
      if (catSection.length) sections.add(category);
    }
    const oldCategory = existing?.category;
    if (oldCategory && oldCategory !== category && !sections.has(oldCategory)) sections.delete(oldCategory);

    let newMediaId = existing?.media_id || null;
    let newFileUrl = null;
    if (imageFile) {
      newMediaId = crypto.randomUUID();
      const extension = ALLOWED_IMAGE_TYPES.get(imageFile.type);
      const storageName = `${crypto.randomUUID()}${extension}`;
      newFileUrl = await storageUpload(storageName, imageFile.data, imageFile.type);
      await sbInsert("media", {
        id: newMediaId,
        file_name: imageFile.filename,
        file_url: newFileUrl,
        mime_type: imageFile.type,
        alt_text: String(body.description || "").trim(),
      }, { returning: "minimal" });
    }

    const itemId = existing?.id || crypto.randomUUID();
    const order = Number.isFinite(Number(body.displayOrder)) ? Math.max(0, Number(body.displayOrder)) : 0;
    const tagsValue = Array.isArray(body.tags) ? body.tags.join(",") : String(body.tags || "").trim();

    try {
      if (existing) {
        await sbUpdate("portfolio_items", `id=eq.${encodeURIComponent(itemId)}`, {
          media_id: newMediaId, title,
          description: String(body.description || "").trim(),
          category: String(body.category || "").trim(),
          location: String(body.location || "").trim(),
          photo_date: String(body.photoDate || "").trim(),
          tags: tagsValue,
          is_featured: boolValue(body.featured),
          is_published: boolValue(body.published),
          is_hidden: boolValue(body.hidden),
          display_order: order,
        });
      } else {
        await sbInsert("portfolio_items", {
          id: itemId, media_id: newMediaId, title,
          description: String(body.description || "").trim(),
          category: String(body.category || "").trim(),
          location: String(body.location || "").trim(),
          photo_date: String(body.photoDate || "").trim(),
          tags: tagsValue,
          is_featured: boolValue(body.featured),
          is_published: boolValue(body.published),
          is_hidden: boolValue(body.hidden),
          display_order: order,
        }, { returning: "minimal" });
      }

      await saveLocations(itemId, [...sections]);

      if (newMediaId) {
        const altText = typeof body.altText === "string" ? body.altText.trim()
          : (typeof body.alt_text === "string" ? body.alt_text.trim() : undefined);
        let aiMetaStr = undefined;
        if (body.aiMetadata) {
          try {
            const rawObj = typeof body.aiMetadata === "string" ? JSON.parse(body.aiMetadata) : body.aiMetadata;
            aiMetaStr = JSON.stringify({
              subject: String(rawObj.subject || "").trim(),
              scene: String(rawObj.scene || "").trim(),
              mood: String(rawObj.mood || "").trim(),
              lighting: String(rawObj.lighting || "").trim(),
              composition: String(rawObj.composition || "").trim(),
              style: String(rawObj.style || "").trim(),
              analyzedAt: rawObj.analyzedAt || new Date().toISOString(),
            });
          } catch { }
        }
        const mediaUpdate = {};
        if (altText !== undefined) mediaUpdate.alt_text = altText;
        if (aiMetaStr !== undefined) mediaUpdate.ai_metadata = aiMetaStr;
        if (Object.keys(mediaUpdate).length) {
          await sbUpdate("media", `id=eq.${encodeURIComponent(newMediaId)}`, mediaUpdate);
        }
      }
    } catch (error) {
      if (newFileUrl && !existing) {
        const sp = storagePathFromUrl(newFileUrl);
        if (sp) await storageDelete(sp).catch(() => { });
        await sbDelete("media", `id=eq.${encodeURIComponent(newMediaId)}`).catch(() => { });
      }
      throw error;
    }

    if (existing && imageFile && existing.media_id !== newMediaId) {
      await cleanupUnusedMedia(existing.media_id);
    }
    return sendJson(res, existing ? 200 : 201, await getPortfolioItem(itemId));
  } catch (error) {
    return sendJson(res, error.status || 500, { error: error.status ? error.message : "Could not save portfolio item." });
  }
}

async function handlePortfolioDelete(res, id) {
  try {
    const rows = await sbSelect("portfolio_items", `id=eq.${encodeURIComponent(id)}&select=media_id`);
    if (!rows.length) return sendJson(res, 404, { error: "Portfolio item not found." });
    const mediaId = rows[0].media_id;
    await sbDelete("portfolio_items", `id=eq.${encodeURIComponent(id)}`);
    await cleanupUnusedMedia(mediaId);
    return sendJson(res, 200, { deleted: true });
  } catch (error) {
    return sendJson(res, 500, { error: "Could not delete portfolio item." });
  }
}

async function handleSectionWrite(req, res, id) {
  try {
    const body = await readJson(req);
    const existingArr = id ? await sbSelect("sections", `id=eq.${encodeURIComponent(id)}`) : [];
    const existing = existingArr[0] || null;
    if (id && !existing) return sendJson(res, 404, { error: "Section not found." });
    if (existing?.is_system) return sendJson(res, 403, { error: "Built-in display locations cannot be renamed." });
    const name = String(body.name || "").trim();
    const slug = normalizeSlug(body.slug || name);
    if (!name || !slug) return sendJson(res, 400, { error: "Section name and a valid slug are required." });
    if (RESERVED_SLUGS.has(slug)) return sendJson(res, 400, { error: "That slug is reserved for a site display location." });
    const order = Math.max(0, Number(body.displayOrder) || 0);
    if (existing) {
      await sbUpdate("sections", `id=eq.${encodeURIComponent(id)}`, {
        name, title: String(body.title || name), description: String(body.description || ""),
        slug, is_visible: boolValue(body.visible), display_order: order,
      });
    } else {
      const sectionId = crypto.randomUUID();
      await sbInsert("sections", {
        id: sectionId, name, title: String(body.title || name),
        description: String(body.description || ""), slug,
        is_visible: boolValue(body.visible ?? true), display_order: order, is_system: false,
      }, { returning: "minimal" });
      id = sectionId;
    }
    const allSections = await getSections();
    return sendJson(res, existing ? 200 : 201, allSections.find((s) => s.id === id));
  } catch (error) {
    console.error("Could not save section:", error);
    const conflict = String(error.message).includes("duplicate") || String(error.message).includes("unique");
    return sendJson(res, conflict ? 409 : error.status || 500,
      { error: conflict ? "That section slug already exists." : error.status ? error.message : "Could not save section." });
  }
}

async function handleSectionDelete(res, id) {
  try {
    const rows = await sbSelect("sections", `id=eq.${encodeURIComponent(id)}`);
    if (!rows.length) return sendJson(res, 404, { error: "Section not found." });
    if (rows[0].is_system) return sendJson(res, 403, { error: "Built-in display locations cannot be deleted." });
    await sbDelete("sections", `id=eq.${encodeURIComponent(id)}`);
    return sendJson(res, 200, { deleted: true });
  } catch (error) {
    return sendJson(res, 500, { error: "Could not delete section." });
  }
}

async function handleContentWrite(req, res) {
  try {
    const body = await readJson(req);
    const entries = Object.entries(body);
    const allowedContentKeys = new Set([
      "about_text", "about_title", "about.biography", "about.description",
      "about.image", "about.imageAlt", "about.skillsDescription", "about.skillsTitle",
      "about.title", "contact_email", "contact_location", "contact_phone", "contact_text",
      "contact_title", "contact.closingDescription", "contact.closingTitle",
      "contact.description", "contact.email", "contact.location", "contact.phone",
      "contact.profileImage", "contact.profileImageAlt", "contact.title",
      "footer_text", "footer.contactTitle", "footer.copyright", "footer.introduction",
      "footer.officeTitle", "footer.socialTitle", "hero_button_text", "hero_button_url",
      "hero_subtitle", "hero_title", "home.aboutCta", "home.aboutTitle", "home.ctaText",
      "home.heroSubtitle", "home.heroTitle", "home.introduction", "home.portfolioDescription",
      "home.portfolioTitle", "home.profileImage", "home.profileImageAlt",
      "portfolio.description", "portfolio.title", "seo_description", "seo_title",
      "site_name", "site_tagline",
    ]);
    for (const [key, value] of entries) {
      if (!allowedContentKeys.has(key) || typeof value !== "string" || key.length > 120 || value.length > 10000)
        throw Object.assign(new Error(`Invalid content value for ${key}.`), { status: 400 });
    }
    const rows = entries.map(([key, value]) => ({
      content_key: key, content_value: value, updated_at: new Date().toISOString(),
    }));
    await sbUpsert("site_content", rows, "content_key");
    return sendJson(res, 200, await getContent());
  } catch (error) {
    return sendJson(res, error.status || 500, { error: error.status ? error.message : "Could not save site content." });
  }
}

async function handleSiteImageUpload(req, res, key) {
  const allowedKeys = new Set(["home.profileImage", "about.image"]);
  if (!allowedKeys.has(key)) return sendJson(res, 404, { error: "Unknown site image." });

  let newFileUrl = null;
  try {
    const contentType = req.headers["content-type"] || "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
      return sendJson(res, 400, { error: "Upload must use multipart/form-data." });
    }

    const parsed = parseMultipart(await readBody(req), contentType);
    const photo = parsed.files.find((file) => file.name === "photo") || null;
    if (!photo) return sendJson(res, 400, { error: "Choose an image file to upload." });

    let mimeType = (photo.type || "").split(";")[0].trim().toLowerCase();
    if (mimeType === "image/jpg" || mimeType === "image/pjpeg") mimeType = "image/jpeg";
    photo.type = mimeType;

    if (!ALLOWED_IMAGE_TYPES.has(mimeType)) {
      return sendJson(res, 415, { error: "Use a JPEG, PNG, WebP, or AVIF image." });
    }
    if (photo.data.length > MAX_UPLOAD_BYTES) {
      return sendJson(res, 413, { error: "Image exceeds the 12 MB limit." });
    }
    if (photo.data.length < 12 || !isValidImage(photo.data, mimeType)) {
      return sendJson(res, 415, { error: "The uploaded file does not match its image type." });
    }

    const existingRows = await sbSelect(
      "site_content",
      `content_key=eq.${encodeURIComponent(key)}&select=content_value`,
    );
    const oldUrl = existingRows[0]?.content_value || "";

    const extension = ALLOWED_IMAGE_TYPES.get(mimeType);
    const storageName = `site/${key}/${crypto.randomUUID()}${extension}`;
    newFileUrl = await storageUpload(storageName, photo.data, mimeType);

    await sbUpsert("site_content", [{
      content_key: key,
      content_value: newFileUrl,
      updated_at: new Date().toISOString(),
    }], "content_key");

    const oldPath = storagePathFromUrl(oldUrl);
    if (oldPath && oldPath !== storageName) await storageDelete(oldPath);

    return sendJson(res, 200, { key, url: newFileUrl, fileName: photo.filename, mimeType });
  } catch (error) {
    if (newFileUrl) {
      const storagePath = storagePathFromUrl(newFileUrl);
      if (storagePath) await storageDelete(storagePath).catch(() => { });
    }
    console.error("Site image upload failed:", error);
    return sendJson(res, error.status || 500, {
      error: error.status ? error.message : "Could not upload site image.",
    });
  }
}

async function handleSocialWrite(req, res, id) {
  try {
    const body = await readJson(req);
    const existingArr = id ? await sbSelect("social_links", `id=eq.${encodeURIComponent(id)}&select=id`) : [];
    const existing = existingArr[0] || null;
    if (id && !existing) return sendJson(res, 404, { error: "Social link not found." });
    const platform = String(body.platform || "").trim();
    const displayName = String(body.displayName || "").trim();
    const url = validateExternalUrl(body.url, ["https:", "mailto:", "tel:"]);
    const icon = String(body.icon || "").trim();
    if (!platform || !displayName || !icon) return sendJson(res, 400, { error: "Platform, display name, and icon are required." });
    const locations = Array.isArray(body.locations) ? [...new Set(body.locations)] : [];
    const linkId = existing?.id || crypto.randomUUID();
    if (existing) {
      await sbUpdate("social_links", `id=eq.${encodeURIComponent(linkId)}`, {
        platform, display_name: displayName, url, icon,
        is_visible: boolValue(body.visible),
        display_order: Math.max(0, Number(body.displayOrder) || 0),
      });
    } else {
      await sbInsert("social_links", {
        id: linkId, platform, display_name: displayName, url, icon,
        is_visible: boolValue(body.visible ?? true),
        display_order: Math.max(0, Number(body.displayOrder) || 0),
      }, { returning: "minimal" });
    }
    await assignSocialLocations(linkId, locations);
    const allLinks = await getSocialLinks();
    return sendJson(res, existing ? 200 : 201, allLinks.find((l) => l.id === linkId));
  } catch (error) {
    console.error("Social link save failed:", error);
    return sendJson(res, error.status || 500, { error: error.status ? error.message : "Could not save social link." });
  }
}

async function handleNavigationWrite(req, res, id) {
  try {
    const body = await readJson(req);
    const existingArr = id ? await sbSelect("navigation_items", `id=eq.${encodeURIComponent(id)}&select=id`) : [];
    const existing = existingArr[0] || null;
    if (id && !existing) return sendJson(res, 404, { error: "Navigation item not found." });
    const label = String(body.label || "").trim();
    const destination = String(body.url || "").trim();
    if (!label || !destination || destination.startsWith("//") || /[\r\n]/.test(destination))
      return sendJson(res, 400, { error: "Navigation label and a safe URL are required." });
    if (/^(javascript|data|vbscript):/i.test(destination))
      return sendJson(res, 400, { error: "That navigation URL scheme is not allowed." });
    const itemId = existing?.id || crypto.randomUUID();
    if (existing) {
      await sbUpdate("navigation_items", `id=eq.${encodeURIComponent(itemId)}`, {
        label, url: destination, icon: String(body.icon || ""),
        is_visible: boolValue(body.visible ?? true),
        display_order: Math.max(0, Number(body.displayOrder) || 0),
      });
    } else {
      await sbInsert("navigation_items", {
        id: itemId, label, url: destination, icon: String(body.icon || ""),
        is_visible: boolValue(body.visible ?? true),
        display_order: Math.max(0, Number(body.displayOrder) || 0),
      }, { returning: "minimal" });
    }
    const allNav = await getNavigation();
    return sendJson(res, existing ? 200 : 201, allNav.find((item) => item.id === itemId));
  } catch (error) {
    return sendJson(res, error.status || 500, { error: error.status ? error.message : "Could not save navigation item." });
  }
}

async function handleMediaDelete(res, id, mode) {
  try {
    const media = await getMediaItem(id);
    if (!media) return sendJson(res, 404, { error: "Media item not found." });
    const usages = await mediaUsage(id);
    if (mode === "remove-from-sections") {
      const itemIds = [...new Set(usages.map((u) => u.id))];
      for (const itemId of itemIds) {
        await sbDelete("portfolio_item_sections", `portfolio_item_id=eq.${encodeURIComponent(itemId)}`);
        await sbUpdate("portfolio_items", `id=eq.${encodeURIComponent(itemId)}`, { is_published: false });
      }
      return sendJson(res, 200, { removedFromSections: itemIds.length });
    }
    if (mode !== "permanent") return sendJson(res, 409, { error: "Choose remove-from-sections or permanent deletion.", usage: usages });
    const portfolioItemIds = [...new Set(usages.map((u) => u.id))];
    for (const itemId of portfolioItemIds) {
      await sbDelete("portfolio_item_sections", `portfolio_item_id=eq.${encodeURIComponent(itemId)}`);
    }
    await sbDelete("portfolio_items", `media_id=eq.${encodeURIComponent(id)}`);
    await sbDelete("media", `id=eq.${encodeURIComponent(id)}`);
    const storagePath = storagePathFromUrl(media.file_url);
    if (storagePath) await storageDelete(storagePath);
    return sendJson(res, 200, { deleted: true });
  } catch (error) {
    return sendJson(res, 500, { error: "Could not delete media item." });
  }
}

async function handleMediaEdit(req, res, id) {
  try {
    const media = await getMediaItem(id);
    if (!media) return sendJson(res, 404, { error: "Media item not found." });
    const body = await readJson(req);
    const fileName = String(body.fileName || "").trim();
    const altText = String(body.altText || "").trim();
    if (!fileName || fileName.length > 255 || /[\\/\r\n]/.test(fileName) || altText.length > 1000)
      return sendJson(res, 400, { error: "Provide a valid display filename and alt text." });
    const update = { file_name: fileName, alt_text: altText };
    if (typeof body.aiMetadata === "string" || body.aiMetadata === null) update.ai_metadata = body.aiMetadata;
    const updated = await sbUpdate("media", `id=eq.${encodeURIComponent(id)}`, update);
    return sendJson(res, 200, updated[0] || { ...media, ...update });
  } catch (error) {
    return sendJson(res, error.status || 500, { error: error.status ? error.message : "Could not update media details." });
  }
}

async function handleMediaReplace(req, res, id) {
  try {
    const media = await getMediaItem(id);
    if (!media) return sendJson(res, 404, { error: "Media item not found." });
    const parsed = parseMultipart(await readBody(req), req.headers["content-type"] || "");
    const photo = parsed.files.find((f) => f.name === "photo");
    if (photo) {
      let mimeType = (photo.type || "").split(";")[0].trim().toLowerCase();
      if (mimeType === "image/jpg" || mimeType === "image/pjpeg") mimeType = "image/jpeg";
      photo.type = mimeType;
    }
    if (!photo || !ALLOWED_IMAGE_TYPES.has(photo?.type) || !isValidImage(photo.data, photo.type))
      return sendJson(res, 415, { error: "Upload a valid JPEG, PNG, WebP, or AVIF image." });
    if (photo.data.length > MAX_UPLOAD_BYTES) return sendJson(res, 413, { error: "Image exceeds the 12 MB limit." });
    const extension = ALLOWED_IMAGE_TYPES.get(photo.type);
    const storageName = `${crypto.randomUUID()}${extension}`;
    const newFileUrl = await storageUpload(storageName, photo.data, photo.type);
    await sbUpdate("media", `id=eq.${encodeURIComponent(id)}`, {
      file_name: photo.filename, file_url: newFileUrl, mime_type: photo.type,
    });
    const oldPath = storagePathFromUrl(media.file_url);
    if (oldPath) await storageDelete(oldPath);
    return sendJson(res, 200, { id, fileName: photo.filename, fileUrl: newFileUrl, mimeType: photo.type });
  } catch (error) {
    return sendJson(res, error.status || 500, { error: error.status ? error.message : "Could not replace media file." });
  }
}

async function handleAiAnalyze(req, res) {
  try {
    const session = getSession(req);
    if (!session) return sendJson(res, 401, { error: "Authentication required." });
    const lastAnalysis = aiAnalysisCooldowns.get(session.key) || 0;
    const elapsed = Date.now() - lastAnalysis;
    if (elapsed < 5000) {
      const wait = Math.ceil((5000 - elapsed) / 1000);
      return sendJson(res, 429, { error: `Please wait ${wait}s before analyzing again.` });
    }
    const body = await readJson(req);
    const mediaId = String(body.mediaId || "").trim();
    if (!mediaId) return sendJson(res, 400, { error: "mediaId is required." });
    const media = await getMediaItem(mediaId);
    if (!media) return sendJson(res, 404, { error: "Media item not found." });

    let imageBuffer;
    const fileUrl = media.file_url;
    if (fileUrl.startsWith("/assets/")) {
      const fileName = decodeURIComponent(fileUrl.slice("/assets/".length));
      const imagePath = path.join(ROOT, "assets", fileName);
      if (!fs.existsSync(imagePath)) return sendJson(res, 404, { error: "Image file not found on disk." });
      imageBuffer = fs.readFileSync(imagePath);
    } else if (fileUrl.startsWith("http")) {
      const dlRes = await fetch(fileUrl, { headers: sbHeaders() });
      if (!dlRes.ok) return sendJson(res, 404, { error: "Could not download image from storage." });
      imageBuffer = Buffer.from(await dlRes.arrayBuffer());
    } else {
      return sendJson(res, 400, { error: "Cannot resolve the image source." });
    }

    const tmpDir = IS_VERCEL ? "/tmp" : path.join(ROOT, "data");
    const ext = ALLOWED_IMAGE_TYPES.get(media.mime_type) || ".jpg";
    const tmpPath = path.join(tmpDir, `ai-analyze-${crypto.randomUUID()}${ext}`);
    try {
      fs.mkdirSync(tmpDir, { recursive: true });
      fs.writeFileSync(tmpPath, imageBuffer);
      aiAnalysisCooldowns.set(session.key, Date.now());
      const result = await analyzePhoto(tmpPath, media.mime_type);
      return sendJson(res, 200, result);
    } finally {
      fs.rmSync(tmpPath, { force: true });
    }
  } catch (error) {
    return sendJson(res, error.status || 500, {
      error: error.status ? error.message : "AI analysis failed unexpectedly.",
    });
  }
}

// ── Admin API router ──────────────────────────────────────────────────────────
async function handleAdminApi(req, res, url) {
  const pathname = url.pathname;

  if (pathname === "/api/auth/session" && req.method === "GET") {
    try {
      const session = getSession(req);
      return sendJson(res, 200, { authenticated: Boolean(session), username: session?.session.username || null });
    } catch (error) {
      console.error("Auth session check failed:", error);
      return sendJson(res, 200, { authenticated: false, username: null });
    }
  }

  if (pathname === "/api/auth/login" && req.method === "POST") {
    if (!adminConfigured()) {
      return sendJson(res, 503, { error: "Admin authentication is not configured on the server." });
    }
    const ip = req.socket.remoteAddress || "unknown";
    const attempts = loginAttempts.get(ip) || { count: 0, until: Date.now() + 15 * 60 * 1000 };
    if (attempts.until < Date.now()) { attempts.count = 0; attempts.until = Date.now() + 15 * 60 * 1000; }
    if (attempts.count >= 8) return sendJson(res, 429, { error: "Too many login attempts. Try again later." });
    return readJson(req).then(({ username, password }) => {
      const providedNormalized = String(username || "").trim().toLowerCase();
      const configuredNormalized = String(process.env.ADMIN_USERNAME || "").trim().toLowerCase();
      const providedUsernameHash = crypto.createHash("sha256").update(providedNormalized).digest();
      const configuredUsernameHash = crypto.createHash("sha256").update(configuredNormalized).digest();
      const altProvidedHash = crypto.createHash("sha256").update(providedNormalized.replace(",", ".")).digest();
      const altConfiguredHash = crypto.createHash("sha256").update(configuredNormalized.replace(",", ".")).digest();
      const validUser = (providedUsernameHash.length === configuredUsernameHash.length && crypto.timingSafeEqual(providedUsernameHash, configuredUsernameHash))
        || (altProvidedHash.length === altConfiguredHash.length && crypto.timingSafeEqual(altProvidedHash, altConfiguredHash));
      const salt = process.env.ADMIN_PASSWORD_SALT || "local-cms-install";
      const expectedHash = crypto.scryptSync(process.env.ADMIN_PASSWORD, salt, 64);
      const actualHash = crypto.scryptSync(String(password || ""), salt, 64);
      const validPassword = crypto.timingSafeEqual(expectedHash, actualHash);
      if (!validUser || !validPassword) {
        attempts.count += 1;
        loginAttempts.set(ip, attempts);
        return sendJson(res, 401, { error: "Username or password is incorrect." });
      }
      loginAttempts.delete(ip);
      const adminUser = process.env.ADMIN_USERNAME;
      const token = createSessionToken(adminUser);
      return sendJson(res, 200, { authenticated: true, username: adminUser }, {
        "Set-Cookie": `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL / 1000}${isSecureRequest(req) ? "; Secure" : ""}`,
      });
    }).catch((error) => sendJson(res, error.status || 400, { error: error.message }));
  }

  if (pathname === "/api/auth/logout" && req.method === "POST") {
    return sendJson(res, 200, { authenticated: false }, {
      "Set-Cookie": `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${isSecureRequest(req) ? "; Secure" : ""}`,
    });
  }

  if (!pathname.startsWith("/api/admin/")) return null;
  if (!requireAdmin(req, res)) return true;

  // Dashboard
  if (pathname === "/api/admin/dashboard" && req.method === "GET") {
    try {
      const countTable = async (table, filter = "") => {
        const qs = `select=id${filter ? "&" + filter : ""}`;
        const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${qs}`, {
          headers: sbHeaders({ Prefer: "count=exact" }),
        });
        const range = r.headers.get("content-range") || "*/0";
        return parseInt(range.split("/")[1]) || 0;
      };
      const [totalPhotos, publishedPhotos, draftPhotos, featuredPhotos, skills, socialLinks, navigationItems] = await Promise.all([
        countTable("portfolio_items"),
        countTable("portfolio_items", "is_published=eq.true&is_hidden=eq.false"),
        countTable("portfolio_items", "is_published=eq.false"),
        countTable("portfolio_items", "is_featured=eq.true"),
        countTable("skills"),
        countTable("social_links"),
        countTable("navigation_items"),
      ]);
      return sendJson(res, 200, { totalPhotos, publishedPhotos, draftPhotos, featuredPhotos, skills, socialLinks, navigationItems });
    } catch (error) {
      return sendJson(res, 500, { error: "Could not load dashboard statistics." });
    }
  }

  // Portfolio
  if (pathname === "/api/admin/portfolio" && req.method === "GET") {
    try {
      return sendJson(res, 200, await getPortfolioItems());
    } catch (error) {
      console.error("Admin portfolio load failed:", error);
      return sendJson(res, error.status || 500, { error: "Could not load portfolio items." });
    }
  }
  if (pathname === "/api/admin/portfolio" && req.method === "POST") return handlePortfolioWrite(req, res, null);
  const portfolioMatch = pathname.match(/^\/api\/admin\/portfolio\/([a-f0-9-]+)$/i);
  if (portfolioMatch && req.method === "PUT") return handlePortfolioWrite(req, res, portfolioMatch[1]);
  if (portfolioMatch && req.method === "DELETE") return handlePortfolioDelete(res, portfolioMatch[1]);

  // Sections
  if (pathname === "/api/admin/sections" && req.method === "GET") { try { return sendJson(res, 200, await getSections()); } catch (error) { console.error("Admin sections load failed:", error); return sendJson(res, 500, { error: "Could not load sections." }); } }
  if (pathname === "/api/admin/sections" && req.method === "POST") return handleSectionWrite(req, res, null);
  const sectionMatch = pathname.match(/^\/api\/admin\/sections\/([a-z0-9-]+)$/i);
  if (sectionMatch && req.method === "PUT") return handleSectionWrite(req, res, sectionMatch[1]);
  if (sectionMatch && req.method === "DELETE") return handleSectionDelete(res, sectionMatch[1]);

  // Content
  if (pathname === "/api/admin/content" && req.method === "GET") {
    try {
      return sendJson(res, 200, await getContent());
    } catch (error) {
      console.error("Admin content load failed:", error);
      return sendJson(res, error.status || 500, { error: "Could not load site content." });
    }
  }
  if (pathname === "/api/admin/content" && req.method === "PUT") return handleContentWrite(req, res);

  // Site images
  const siteImageMatch = pathname.match(/^\/api\/admin\/site-image\/(home\.profileImage|about\.image)$/);
  if (siteImageMatch && req.method === "PUT") return handleSiteImageUpload(req, res, siteImageMatch[1]);

  // Social
  if (pathname === "/api/admin/social" && req.method === "GET") { try { return sendJson(res, 200, await getSocialLinks()); } catch (error) { console.error("Admin social load failed:", error); return sendJson(res, 500, { error: "Could not load social links." }); } }
  if (pathname === "/api/admin/social" && req.method === "POST") return handleSocialWrite(req, res, null);
  const socialMatch = pathname.match(/^\/api\/admin\/social\/([^/]+)$/i);
  if (socialMatch && req.method === "PUT") return handleSocialWrite(req, res, socialMatch[1]);
  if (socialMatch && req.method === "DELETE") {
    try {
      await sbDelete("social_links", `id=eq.${encodeURIComponent(socialMatch[1])}`);
      return sendJson(res, 200, { deleted: true });
    } catch (error) { return sendJson(res, 500, { error: "Could not delete social link." }); }
  }

  // Navigation
  if (pathname === "/api/admin/navigation" && req.method === "GET") { try { return sendJson(res, 200, await getNavigation()); } catch (error) { console.error("Admin navigation load failed:", error); return sendJson(res, 500, { error: "Could not load navigation." }); } }
  if (pathname === "/api/admin/navigation" && req.method === "POST") return handleNavigationWrite(req, res, null);
  const navigationMatch = pathname.match(/^\/api\/admin\/navigation\/([a-z0-9-]+)$/i);
  if (navigationMatch && req.method === "PUT") return handleNavigationWrite(req, res, navigationMatch[1]);
  if (navigationMatch && req.method === "DELETE") {
    try {
      await sbDelete("navigation_items", `id=eq.${encodeURIComponent(navigationMatch[1])}`);
      return sendJson(res, 200, { deleted: true });
    } catch (error) { return sendJson(res, 500, { error: "Could not delete navigation item." }); }
  }

  // Media
  if (pathname === "/api/admin/media" && req.method === "GET") {
    try {
      const items = await sbSelect("media", "select=*&order=created_at.desc");
      const withUsage = await Promise.all(items.map(async (m) => ({ ...m, usage: await mediaUsage(m.id) })));
      return sendJson(res, 200, withUsage);
    } catch (error) { return sendJson(res, 500, { error: "Could not load media." }); }
  }
  const mediaMatch = pathname.match(/^\/api\/admin\/media\/([a-f0-9-]+)$/i);
  if (mediaMatch && req.method === "GET") {
    try {
      const media = await getMediaItem(mediaMatch[1]);
      if (!media) return sendJson(res, 404, { error: "Media item not found." });
      return sendJson(res, 200, { ...media, usage: await mediaUsage(mediaMatch[1]) });
    } catch (error) { return sendJson(res, 500, { error: "Could not load media item." }); }
  }
  if (mediaMatch && req.method === "DELETE") return handleMediaDelete(res, mediaMatch[1], url.searchParams.get("mode"));
  if (mediaMatch && req.method === "PATCH") return handleMediaEdit(req, res, mediaMatch[1]);
  if (mediaMatch && req.method === "PUT") return handleMediaReplace(req, res, mediaMatch[1]);

  // AI
  if (pathname === "/api/admin/ai/analyze-photo" && req.method === "POST") return handleAiAnalyze(req, res);

  // Skills
  if (pathname === "/api/admin/skills" && req.method === "GET") { try { return sendJson(res, 200, await getSkills()); } catch (error) { console.error("Admin skills load failed:", error); return sendJson(res, 500, { error: "Could not load skills." }); } }
  if (pathname === "/api/admin/skills" && req.method === "POST") return handleSkillWrite(req, res, null);
  const skillMatch = pathname.match(/^\/api\/admin\/skills\/([a-z0-9-]+)$/i);
  if (skillMatch && req.method === "PUT") return handleSkillWrite(req, res, skillMatch[1]);
  if (skillMatch && req.method === "DELETE") {
    try {
      const existing = await sbSelect("skills", `id=eq.${encodeURIComponent(skillMatch[1])}&select=id`);
      if (!existing.length) return sendJson(res, 404, { error: "Skill not found." });
      await sbDelete("skills", `id=eq.${encodeURIComponent(skillMatch[1])}`);
      return sendJson(res, 200, { deleted: true });
    } catch (error) { return sendJson(res, 500, { error: "Could not delete skill." }); }
  }

  return sendJson(res, 404, { error: "Admin API route not found." });
}

// ── Static file serving ───────────────────────────────────────────────────────
function serveStatic(req, res, url) {
  const pathname = decodeURIComponent(url.pathname);
  if (pathname === "/favicon.ico") {
    const favicon = path.join(ROOT, "assets", "logo.png");
    if (fs.existsSync(favicon) && fs.statSync(favicon).isFile()) {
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      });
      return fs.createReadStream(favicon).pipe(res);
    }
  }
  const cleanPath = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const adminRoutes = new Set([
    "/admin", "/admin/login", "/admin/dashboard", "/admin/portfolio",
    "/admin/content", "/admin/skills", "/admin/social",
    "/admin/navigation", "/admin/media", "/admin/settings",
  ]);
  if (adminRoutes.has(cleanPath)) {
    const file = fs.readFileSync(path.join(ROOT, "admin", "admin.html"));
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'self'; img-src 'self' data: blob: https://xdhusmmqkgzflxixrbis.supabase.co; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com; script-src 'self'; connect-src 'self' https://xdhusmmqkgzflxixrbis.supabase.co; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    });
    return res.end(file);
  }
  const aliases = { "/about": "about.html", "/portfolio": "photography.html", "/contact": "hire.html" };
  const relative = pathname === "/" ? "home.html" : aliases[pathname] || pathname.slice(1);
  const firstPathSegment = relative.split(/[\\/]/, 1)[0].toLowerCase();
  if (
    firstPathSegment === ".git" || firstPathSegment === "data" || firstPathSegment === "node_modules" ||
    relative.toLowerCase() === ".env" || relative.toLowerCase() === "javascript/server.js"
  ) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Not found");
  }
  const target = path.resolve(ROOT, relative);
  if (!target.startsWith(`${ROOT}${path.sep}`) && target !== ROOT) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Not found");
  }
  const type = MIME_BY_EXTENSION.get(path.extname(target).toLowerCase()) || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": type,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": type.startsWith("image/") ? "public, max-age=86400" : "no-cache",
  });
  return fs.createReadStream(target).pipe(res);
}

// ── Main request handler ──────────────────────────────────────────────────────
async function requestHandler(req, res) {
  // Vercel may provide rewritten path headers; local Node must always use req.url.
  const rawPath = IS_VERCEL
    ? (req.headers["x-forwarded-uri"] || req.headers["x-matched-path"] || req.url)
    : req.url;
  const url = new URL(rawPath, `http://${req.headers.host || "localhost"}`);

  if (req.method === "GET" && url.pathname === "/api/public/site") {
    try {
      const sections = (await getSections()).filter((s) => s.visible);
      const items = await getPortfolioItems({ publicOnly: true });
      const photos = {};
      for (const section of sections) {
        photos[section.slug] = items.filter((item) => item.sections.includes(section.slug));
      }
      const socialLinks = (await getSocialLinks()).filter((l) => l.visible);
      return sendJson(res, 200, {
        content: await getContent(),
        navigation: (await getNavigation()).filter((item) => item.visible),
        sections,
        photos,
        socialLinks,
        skills: await getSkills({ visibleOnly: true }),
      });
    } catch (error) {
      console.error("Public site API failed:", error);
      return sendJson(res, 500, { error: "Website content could not be loaded." });
    }
  }

  if (url.pathname.startsWith("/api/") && req.method !== "GET" && !checkOrigin(req, res)) return;
  const handled = await handleAdminApi(req, res, url);
  if (handled) return;
  if (url.pathname.startsWith("/api/")) return sendJson(res, 404, { error: "API route not found." });
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" });
    return res.end("Method not allowed");
  }
  return serveStatic(req, res, url);
}

// ── Server startup ────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  requestHandler(req, res).catch((error) => {
    console.error(error);
    if (!res.headersSent) sendJson(res, error.status || 500, { error: "The server could not complete the request." });
    else res.destroy();
  });
});

if (!IS_VERCEL && require.main === module) {
  ensureSystemSections().then(() => {
    server.listen(PORT, () => {
      console.log(`Photography portfolio CMS running at http://localhost:${PORT}`);
      console.log(`Supabase: ${SUPABASE_URL || "(not configured)"}`);
    });
  });
}

function shutdown() {
  server.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

module.exports = { requestHandler, server };

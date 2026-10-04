#!/usr/bin/env node
/**
 * scripts/migrate-sqlite-to-supabase.js
 *
 * One-time migration: reads local SQLite database and upserts everything
 * into Supabase PostgreSQL. Also uploads /assets/ images to Supabase Storage.
 *
 * Usage:
 *   node scripts/migrate-sqlite-to-supabase.js
 *
 * Required env vars (in .env or shell):
 *   SUPABASE_URL=https://xxxxx.supabase.co
 *   SUPABASE_SECRET_KEY=your-service-role-key
 *
 * Optional:
 *   SUPABASE_STORAGE_BUCKET=portfolio  (default: portfolio)
 *   DB_PATH=./data/portfolio.sqlite    (default)
 */

"use strict";

try { if (typeof process.loadEnvFile === "function") process.loadEnvFile(); } catch {}

const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const DB_PATH = process.env.DB_PATH || path.join(ROOT, "data", "portfolio.sqlite");
const ASSET_DIRS = [
  path.join(ROOT, "assets"),
  path.join(ROOT, "uploads"),
  path.join(ROOT, "public", "assets"),
  path.join(ROOT, "public", "uploads"),
];

function findLocalMedia(fileUrl, fileName) {
  const candidates = [];
  const names = [...new Set([
    fileName,
    fileUrl ? decodeURIComponent(String(fileUrl).split("/").pop() || "") : "",
  ].filter(Boolean))];
  for (const dir of ASSET_DIRS) {
    for (const name of names) candidates.push(path.join(dir, path.basename(name)));
  }
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}
const SUPABASE_URL = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
const SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "portfolio";

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("Error: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SECRET_KEY must be set.");
  process.exit(1);
}
if (!fs.existsSync(DB_PATH)) {
  console.error("Error: SQLite database not found at: " + DB_PATH);
  process.exit(1);
}

const db = new DatabaseSync(DB_PATH);
console.log("Reading SQLite: " + DB_PATH);

function sbHeaders(extra = {}) {
  return {
    apikey: SUPABASE_SECRET_KEY,
    Authorization: "Bearer " + SUPABASE_SECRET_KEY,
    ...extra,
  };
}

async function sbUpsert(table, data, onConflict) {
  if (!data || (Array.isArray(data) && !data.length)) return;
  const res = await fetch(
    SUPABASE_URL + "/rest/v1/" + table + "?on_conflict=" + onConflict,
    {
      method: "POST",
      headers: sbHeaders({ "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw new Error("Upsert " + table + " failed (" + res.status + "): " + (detail.message || JSON.stringify(detail)));
  }
}

async function uploadToStorage(storagePath, filePath, mimeType) {
  const buffer = fs.readFileSync(filePath);
  const res = await fetch(
    SUPABASE_URL + "/storage/v1/object/" + SUPABASE_BUCKET + "/" + encodeURIComponent(storagePath),
    {
      method: "POST",
      headers: sbHeaders({ "Content-Type": mimeType, "x-upsert": "true" }),
      body: buffer,
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error("Storage upload failed (" + res.status + "): " + detail.slice(0, 300));
  }
  return SUPABASE_URL + "/storage/v1/object/public/" + SUPABASE_BUCKET + "/" + encodeURIComponent(storagePath);
}

function bool(v) { return v === 1 || v === true; }

async function migrate() {
  console.log("\n== SQLite to Supabase Migration ==\n");

  // sections
  const sections = db.prepare("SELECT * FROM sections").all();
  console.log("Migrating " + sections.length + " sections...");
  await sbUpsert("sections", sections.map((r) => ({
    id: r.id, name: r.name, title: r.title, description: r.description || "",
    slug: r.slug, is_visible: bool(r.is_visible), display_order: r.display_order || 0,
    is_system: bool(r.is_system),
  })), "id");
  console.log("  ✓ sections");

  // media (upload /assets/ files to Supabase Storage)
  const mediaRows = db.prepare("SELECT * FROM media").all();
  console.log("Migrating " + mediaRows.length + " media records...");
  const mediaToUpsert = [];
  for (const row of mediaRows) {
    let fileUrl = row.file_url;
    const localPath = findLocalMedia(fileUrl, row.file_name);
    if (localPath) {
      try {
        const storageName = path.basename(localPath);
        fileUrl = await uploadToStorage(storageName, localPath, row.mime_type);
        console.log("  Uploaded: " + storageName + " from " + path.relative(ROOT, localPath));
      } catch (e) {
        console.warn("  Warning: Could not upload " + row.file_name + ": " + e.message);
      }
    } else if (fileUrl && (fileUrl.startsWith("/assets/") || fileUrl.startsWith("/uploads/"))) {
      console.warn("  Warning: Local image not found for " + row.file_name + ". Searched assets/, uploads/, public/assets/, and public/uploads/.");
    }
    mediaToUpsert.push({
      id: row.id, file_name: row.file_name, file_url: fileUrl,
      mime_type: row.mime_type, alt_text: row.alt_text || "",
      created_at: row.created_at || new Date().toISOString(),
      ai_metadata: row.ai_metadata || null,
    });
  }
  await sbUpsert("media", mediaToUpsert, "id");
  console.log("  ✓ media");

  // portfolio_items
  const items = db.prepare("SELECT * FROM portfolio_items").all();
  console.log("Migrating " + items.length + " portfolio items...");
  await sbUpsert("portfolio_items", items.map((r) => ({
    id: r.id, media_id: r.media_id, title: r.title,
    description: r.description || "", category: r.category || "",
    location: r.location || "", photo_date: r.photo_date || "",
    tags: r.tags || "", is_featured: bool(r.is_featured),
    is_published: bool(r.is_published), is_hidden: bool(r.is_hidden),
    display_order: r.display_order || 0,
    created_at: r.created_at || new Date().toISOString(),
    updated_at: r.updated_at || new Date().toISOString(),
  })), "id");
  console.log("  ✓ portfolio_items");

  // portfolio_item_sections
  const pis = db.prepare("SELECT * FROM portfolio_item_sections").all();
  console.log("Migrating " + pis.length + " section assignments...");
  for (let i = 0; i < pis.length; i += 200) {
    const batch = pis.slice(i, i + 200);
    await sbUpsert("portfolio_item_sections",
      batch.map((r) => ({ portfolio_item_id: r.portfolio_item_id, section_id: r.section_id })),
      "portfolio_item_id,section_id");
  }
  console.log("  ✓ portfolio_item_sections");

  // social_links
  const socialLinks = db.prepare("SELECT * FROM social_links").all();
  console.log("Migrating " + socialLinks.length + " social links...");
  await sbUpsert("social_links", socialLinks.map((r) => ({
    id: r.id, platform: r.platform, display_name: r.display_name,
    url: r.url, icon: r.icon, is_visible: bool(r.is_visible),
    display_order: r.display_order || 0,
  })), "id");
  console.log("  ✓ social_links");

  // social_link_locations
  const sll = db.prepare("SELECT * FROM social_link_locations").all();
  console.log("Migrating " + sll.length + " social link locations...");
  await sbUpsert("social_link_locations", sll.map((r) => ({
    social_link_id: r.social_link_id, location: r.location, display_order: r.display_order || 0,
  })), "social_link_id,location");
  console.log("  ✓ social_link_locations");

  // site_content
  const content = db.prepare("SELECT * FROM site_content").all();
  console.log("Migrating " + content.length + " site content entries...");
  await sbUpsert("site_content", content.map((r) => ({
    content_key: r.content_key, content_value: r.content_value,
    updated_at: r.updated_at || new Date().toISOString(),
  })), "content_key");
  console.log("  ✓ site_content");

  // navigation_items
  const nav = db.prepare("SELECT * FROM navigation_items").all();
  console.log("Migrating " + nav.length + " navigation items...");
  await sbUpsert("navigation_items", nav.map((r) => ({
    id: r.id, label: r.label, url: r.url, icon: r.icon || "",
    is_visible: bool(r.is_visible), display_order: r.display_order || 0,
  })), "id");
  console.log("  ✓ navigation_items");

  // skills
  const skills = db.prepare("SELECT * FROM skills").all();
  console.log("Migrating " + skills.length + " skills...");
  await sbUpsert("skills", skills.map((r) => ({
    id: r.id, name: r.name, percent: r.percent || 80,
    icon: r.icon || "ri-star-line", display_order: r.display_order || 0,
    is_visible: bool(r.is_visible),
  })), "id");
  console.log("  ✓ skills");

  console.log("\n✅ Migration complete! Data upserted into Supabase.");
  console.log("   Existing local media found in assets/, uploads/, public/assets/, or public/uploads/ was uploaded automatically.");
  console.log("   Any missing local files were left unchanged and must be restored separately.");
}

migrate().catch((err) => {
  console.error("\n❌ Migration failed:", err.message);
  process.exit(1);
});

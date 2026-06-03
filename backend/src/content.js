import { isDatabaseConfigured, query } from './database.js';
import { DEFAULT_CONTENT_SECTIONS, normalizeContentSection, normalizeSettings } from './contentDefaults.js';
import { createHttpError } from './http.js';

const CONTENT_SELECT = `
  SELECT
    id,
    slug,
    panel_key,
    nav_label,
    nav_detail,
    eyebrow,
    title,
    body,
    sort_order,
    progress,
    is_nav_item,
    is_published,
    settings,
    updated_at
  FROM content_sections
`;

export async function listPublicContentSections() {
  if (!isDatabaseConfigured()) {
    return DEFAULT_CONTENT_SECTIONS.map(normalizeContentSection);
  }

  const result = await query(
    `${CONTENT_SELECT}
     WHERE is_published = true
     ORDER BY sort_order ASC, progress ASC`,
  );

  return result.rows.length ? result.rows.map(normalizeContentSection) : DEFAULT_CONTENT_SECTIONS.map(normalizeContentSection);
}

export async function listAdminContentSections() {
  ensureDatabase();
  const result = await query(`${CONTENT_SELECT} ORDER BY sort_order ASC, progress ASC`);
  return result.rows.map(normalizeContentSection);
}

export async function updateContentSection(id, payload, userId) {
  ensureDatabase();
  const section = sanitizeContentPayload(payload);

  const result = await query(
    `
      UPDATE content_sections
      SET
        nav_label = $2,
        nav_detail = $3,
        eyebrow = $4,
        title = $5,
        body = $6,
        sort_order = $7,
        progress = $8,
        is_nav_item = $9,
        is_published = $10,
        settings = $11::jsonb,
        updated_by = $12
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      section.navLabel,
      section.navDetail,
      section.eyebrow,
      section.title,
      section.body,
      section.sortOrder,
      section.progress,
      section.isNavItem,
      section.isPublished,
      JSON.stringify(section.settings),
      userId,
    ],
  );

  if (!result.rowCount) {
    throw createHttpError(404, 'content_section_not_found');
  }

  return normalizeContentSection(result.rows[0]);
}

export async function createContentSection(payload, userId) {
  ensureDatabase();
  const section = sanitizeContentPayload(payload, { requireSlug: true });

  const result = await query(
    `
      INSERT INTO content_sections (
        slug,
        panel_key,
        nav_label,
        nav_detail,
        eyebrow,
        title,
        body,
        sort_order,
        progress,
        is_nav_item,
        is_published,
        settings,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13, $13)
      RETURNING *
    `,
    [
      section.slug,
      section.panelKey,
      section.navLabel,
      section.navDetail,
      section.eyebrow,
      section.title,
      section.body,
      section.sortOrder,
      section.progress,
      section.isNavItem,
      section.isPublished,
      JSON.stringify(section.settings),
      userId,
    ],
  );

  return normalizeContentSection(result.rows[0]);
}

export function sanitizeContentPayload(payload, { requireSlug = false } = {}) {
  const slug = sanitizeSlug(payload.slug);
  const panelKey = sanitizeSlug(payload.panelKey || payload.panel_key || slug);

  if (requireSlug && (!slug || !panelKey)) {
    throw createHttpError(400, 'invalid_content_slug');
  }

  const title = cleanText(payload.title, 140);
  const navLabel = cleanText(payload.navLabel || payload.nav_label || title, 40);

  if (!title || !navLabel) {
    throw createHttpError(400, 'content_title_required');
  }

  return {
    slug,
    panelKey,
    navLabel,
    navDetail: cleanText(payload.navDetail || payload.nav_detail, 48),
    eyebrow: cleanText(payload.eyebrow, 80),
    title,
    body: cleanText(payload.body, 1000),
    sortOrder: clampInteger(payload.sortOrder ?? payload.sort_order, 0, 9999, 100),
    progress: clampNumber(payload.progress, 0, 1, 0),
    isNavItem: Boolean(payload.isNavItem ?? payload.is_nav_item),
    isPublished: Boolean(payload.isPublished ?? payload.is_published),
    settings: normalizeSettings(payload.settings),
  };
}

function ensureDatabase() {
  if (!isDatabaseConfigured()) {
    throw createHttpError(503, 'database_not_configured');
  }
}

function cleanText(value, maxLength) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function sanitizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function clampNumber(value, minimum, maximum, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

function clampInteger(value, minimum, maximum, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

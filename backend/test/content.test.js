import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeContentPayload } from '../src/content.js';
import { DEFAULT_CONTENT_SECTIONS, normalizeContentSection } from '../src/contentDefaults.js';

test('default content sections include planned dynamic navigation areas', () => {
  const slugs = DEFAULT_CONTENT_SECTIONS.map((section) => section.slug);

  assert.deepEqual(slugs, ['home', 'grid', 'climb', 'sector', 'social', 'paddock', 'about', 'contact']);
  assert.equal(DEFAULT_CONTENT_SECTIONS[0].progress, 0);
  assert.equal(DEFAULT_CONTENT_SECTIONS.every((section) => section.isNavItem), true);
});

test('content payload sanitization clamps unsafe numeric values', () => {
  const section = sanitizeContentPayload({
    slug: 'New Section!!',
    title: '  New Section  ',
    navLabel: ' New ',
    progress: 3,
    sortOrder: -10,
    isNavItem: true,
    isPublished: true,
    settings: {
      links: [{ label: ' Discord ', text: ' discord.gg/paddockindia ', href: ' https://discord.gg/paddockindia ' }],
    },
  }, { requireSlug: true });

  assert.equal(section.slug, 'new-section');
  assert.equal(section.progress, 1);
  assert.equal(section.sortOrder, 0);
  assert.deepEqual(section.settings.links[0], {
    label: 'Discord',
    text: 'discord.gg/paddockindia',
    href: 'https://discord.gg/paddockindia',
  });
});

test('database content rows normalize to frontend-safe casing', () => {
  const section = normalizeContentSection({
    id: 'section-id',
    slug: 'home',
    panel_key: 'home',
    nav_label: 'Home',
    nav_detail: 'Welcome',
    is_nav_item: true,
    is_published: true,
    progress: '0.25',
    settings: {},
  });

  assert.equal(section.panelKey, 'home');
  assert.equal(section.navLabel, 'Home');
  assert.equal(section.progress, 0.25);
  assert.deepEqual(section.settings.links, []);
});

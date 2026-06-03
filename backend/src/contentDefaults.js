export const DEFAULT_CONTENT_SECTIONS = [
  {
    slug: 'home',
    panelKey: 'home',
    navLabel: 'Home',
    navDetail: 'Welcome',
    eyebrow: 'Paddock India Racing',
    title: 'Spa Track',
    body: 'Race through the Ardennes, from the opening grid to the final chicane.',
    sortOrder: 10,
    progress: 0,
    isNavItem: true,
    isPublished: true,
    settings: { tone: 'hero', links: [] },
  },
  {
    slug: 'grid',
    panelKey: 'grid',
    navLabel: 'Grid',
    navDetail: 'Start',
    eyebrow: 'Start Grid',
    title: 'Lights Out',
    body: 'The paddock clears, the race line opens, and the cars settle into position.',
    sortOrder: 20,
    progress: 0.08,
    isNavItem: true,
    isPublished: true,
    settings: { tone: 'race', links: [] },
  },
  {
    slug: 'climb',
    panelKey: 'climb',
    navLabel: 'Climb',
    navDetail: 'Raidillon',
    eyebrow: 'Climb',
    title: 'Eau Rouge. Raidillon.',
    body: 'A fast uphill charge gives the lap its first dramatic change of rhythm.',
    sortOrder: 30,
    progress: 0.26,
    isNavItem: true,
    isPublished: true,
    settings: { tone: 'race', links: [] },
  },
  {
    slug: 'sector',
    panelKey: 'sector',
    navLabel: 'Sector',
    navDetail: 'Race line',
    eyebrow: 'Sector Run',
    title: 'Hold The Line',
    body: 'Performance, handling, and timing details can live here as the car builds speed.',
    sortOrder: 40,
    progress: 0.42,
    isNavItem: true,
    isPublished: true,
    settings: { tone: 'quiet', links: [] },
  },
  {
    slug: 'social',
    panelKey: 'social',
    navLabel: 'Social',
    navDetail: 'Chicane',
    eyebrow: 'First Chicane',
    title: 'Join The Grid',
    body: '',
    sortOrder: 50,
    progress: 0.58,
    isNavItem: true,
    isPublished: true,
    settings: {
      tone: 'social',
      links: [
        { label: 'Discord', href: 'https://discord.gg/paddockindia', text: 'discord.gg/paddockindia' },
        { label: 'Instagram', href: 'https://instagram.com/paddockindia.racing', text: '@paddockindia.racing' },
        { label: 'YouTube', href: 'https://youtube.com/@paddockindia', text: '@paddockindia' },
      ],
    },
  },
  {
    slug: 'paddock',
    panelKey: 'paddock',
    navLabel: 'Paddock',
    navDetail: 'Events',
    eyebrow: 'Paddock',
    title: 'Community Pit Lane',
    body: 'Use this area for stalls, event notes, sponsors, gallery links, or partner callouts.',
    sortOrder: 60,
    progress: 0.72,
    isNavItem: true,
    isPublished: true,
    settings: { tone: 'quiet', links: [] },
  },
  {
    slug: 'about',
    panelKey: 'about',
    navLabel: 'About',
    navDetail: 'Story',
    eyebrow: 'About',
    title: 'Built For The Grid',
    body: 'Paddock India is a motorsport-first community experience for drivers, builders, and race fans.',
    sortOrder: 70,
    progress: 0.84,
    isNavItem: true,
    isPublished: true,
    settings: { tone: 'contact', links: [] },
  },
  {
    slug: 'contact',
    panelKey: 'contact',
    navLabel: 'Contact',
    navDetail: 'Finish',
    eyebrow: 'Finish',
    title: 'Contact Us',
    body: 'Reach the team after the final sector.',
    sortOrder: 80,
    progress: 0.94,
    isNavItem: true,
    isPublished: true,
    settings: {
      tone: 'contact',
      links: [
        { label: 'Email', href: 'mailto:hello@paddockindia.racing', text: 'hello@paddockindia.racing' },
        { label: 'Phone', href: 'tel:+15550149117', text: '+1 555 014 9117' },
        { label: 'Location', text: 'Francorchamps inspired, globally online' },
      ],
    },
  },
];

export function normalizeContentSection(section) {
  return {
    id: section.id || section.slug,
    slug: section.slug,
    panelKey: section.panel_key || section.panelKey || section.slug,
    navLabel: section.nav_label || section.navLabel || section.title,
    navDetail: section.nav_detail || section.navDetail || '',
    eyebrow: section.eyebrow || '',
    title: section.title || '',
    body: section.body || '',
    sortOrder: Number(section.sort_order ?? section.sortOrder ?? 0),
    progress: Number(section.progress ?? 0),
    isNavItem: Boolean(section.is_nav_item ?? section.isNavItem),
    isPublished: Boolean(section.is_published ?? section.isPublished),
    settings: normalizeSettings(section.settings),
    updatedAt: section.updated_at || section.updatedAt || null,
  };
}

export function normalizeSettings(settings) {
  if (!settings || typeof settings !== 'object') {
    return { links: [] };
  }

  return {
    ...settings,
    links: Array.isArray(settings.links)
      ? settings.links
          .filter((link) => link && typeof link === 'object')
          .map((link) => ({
            label: String(link.label || '').trim(),
            text: String(link.text || '').trim(),
            href: link.href ? String(link.href).trim() : '',
          }))
          .filter((link) => link.label && link.text)
      : [],
  };
}

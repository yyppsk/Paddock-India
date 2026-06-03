export const DEFAULT_GAME_OFFERINGS = [
  {
    id: 'asseto-corsa',
    name: 'Assetto Corsa',
    kicker: 'Sim racing',
    description: 'Track days, community races, and curated server sessions.',
    posterTone: 'scarlet',
    posterImage: '/assets/images/games/assetto-corsa.webp',
  },
  {
    id: 'nfs-server',
    name: 'Need for Speed',
    kicker: 'Arcade racing',
    description: 'Fast lobbies, casual runs, and high-energy weekend rooms.',
    posterTone: 'amber',
    posterImage: '/assets/images/games/need-for-speed-unbound.webp',
  },
  {
    id: 'demo-one',
    name: 'Demo',
    kicker: 'Coming soon',
    description: 'Reserved for the next racing experience on the grid.',
    posterTone: 'green',
  },
  {
    id: 'demo-two',
    name: 'Demo',
    kicker: 'Coming soon',
    description: 'A flexible slot for leagues, events, or partner servers.',
    posterTone: 'blue',
  },
];

export const DEFAULT_CONTENT_SECTIONS = [
  {
    slug: 'home',
    panelKey: 'home',
    navLabel: 'Home',
    navDetail: 'Welcome',
    eyebrow: 'Paddock India Racing',
    title: 'Paddock India',
    body: 'Start your engines',
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
    eyebrow: 'Grid',
    title: 'Gaming Titles',
    body: 'Choose your racing title and join the community for well-organized events.',
    sortOrder: 20,
    progress: 0.08,
    isNavItem: true,
    isPublished: true,
    settings: { tone: 'race', links: [], games: DEFAULT_GAME_OFFERINGS },
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
    settings: normalizeSettings(section.settings, section),
    updatedAt: section.updated_at || section.updatedAt || null,
  };
}

export function normalizeSettings(settings, section = {}) {
  const panelKey = section.panel_key || section.panelKey || section.slug;
  const isGridSection = panelKey === 'grid' || section.slug === 'grid';

  if (!settings || typeof settings !== 'object') {
    return { links: [], games: isGridSection ? DEFAULT_GAME_OFFERINGS : [] };
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
    games: Array.isArray(settings.games) && settings.games.length
      ? settings.games
          .filter((game) => game && typeof game === 'object')
          .map((game, index) => normalizeGameOffering(game, index))
          .filter((game) => game.name)
      : isGridSection
        ? DEFAULT_GAME_OFFERINGS
        : [],
  };
}

function normalizeGameOffering(game, index) {
  const id = String(game.id || `game-${index}`).trim();
  const fallback = DEFAULT_GAME_OFFERINGS.find((offering) => offering.id === id);

  return {
    id,
    name: resolveGameName(game, id, fallback),
    kicker: String(game.kicker || fallback?.kicker || '').trim(),
    description: String(game.description || fallback?.description || '').trim(),
    posterTone: String(game.posterTone || fallback?.posterTone || 'scarlet').trim(),
    posterImage: String(game.posterImage || game.poster_image || fallback?.posterImage || '').trim(),
  };
}

function resolveGameName(game, id, fallback) {
  const name = String(game.name || fallback?.name || '').trim();

  if (id === 'nfs-server' && name === 'NFS Server') {
    return 'Need for Speed';
  }

  return name;
}

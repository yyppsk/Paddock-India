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
    id: 'home',
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
    id: 'grid',
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
    id: 'climb',
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
    id: 'sector',
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
    id: 'social',
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
    id: 'paddock',
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
    id: 'about',
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
    id: 'contact',
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

export function normalizeSections(sections) {
  return (Array.isArray(sections) && sections.length ? sections : DEFAULT_CONTENT_SECTIONS)
    .filter((section) => section?.isPublished !== false)
    .map((section) => {
      const panelKey = section.panelKey || section.slug;
      const isGridSection = panelKey === 'grid' || section.id === 'grid' || section.slug === 'grid';

      return {
        ...section,
        id: section.id || section.slug,
        panelKey,
        navLabel: section.navLabel || section.title,
        navDetail: section.navDetail || '',
        progress: Number(section.progress || 0),
        settings: {
          ...(section.settings || {}),
          links: Array.isArray(section.settings?.links) ? section.settings.links : [],
          games: Array.isArray(section.settings?.games) && section.settings.games.length
            ? normalizeGames(section.settings.games)
            : isGridSection
              ? DEFAULT_GAME_OFFERINGS
              : [],
        },
      };
    })
    .sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0));
}

function normalizeGames(games) {
  return games
    .filter((game) => game && typeof game === 'object')
    .map((game, index) => {
      const id = String(game.id || `game-${index}`).trim();
      const fallback = DEFAULT_GAME_OFFERINGS.find((offering) => offering.id === id);

      return {
        ...game,
        id,
        name: resolveGameName({ ...game, id }, fallback),
        kicker: String(game.kicker || fallback?.kicker || '').trim(),
        description: String(game.description || fallback?.description || '').trim(),
        posterTone: String(game.posterTone || fallback?.posterTone || 'scarlet').trim(),
        posterImage: String(game.posterImage || game.poster_image || fallback?.posterImage || '').trim(),
      };
    })
    .filter((game) => game.name);
}

function resolveGameName(game, fallback) {
  const name = String(game.name || fallback?.name || '').trim();

  if (game.id === 'nfs-server' && name === 'NFS Server') {
    return 'Need for Speed';
  }

  return name;
}

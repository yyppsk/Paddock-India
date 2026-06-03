UPDATE content_sections
SET
  title = 'Paddock India',
  body = 'Start your engines',
  updated_at = NOW()
WHERE slug = 'home'
  AND title = 'Spa Track'
  AND body = 'Race through the Ardennes, from the opening grid to the final chicane.';

UPDATE content_sections
SET
  eyebrow = 'Grid',
  title = 'Gaming Titles',
  body = 'Choose your racing title and join the community for well-organized events.',
  settings = COALESCE(settings, '{}'::jsonb) || '{
    "tone": "race",
    "games": [
      {
        "id": "asseto-corsa",
        "name": "Assetto Corsa",
        "kicker": "Sim racing",
        "description": "Track days, community races, and curated server sessions.",
        "posterTone": "scarlet",
        "posterImage": "/assets/images/games/assetto-corsa.webp"
      },
      {
        "id": "nfs-server",
        "name": "Need for Speed",
        "kicker": "Arcade racing",
        "description": "Fast lobbies, casual runs, and high-energy weekend rooms.",
        "posterTone": "amber",
        "posterImage": "/assets/images/games/need-for-speed-unbound.webp"
      },
      {
        "id": "demo-one",
        "name": "Demo",
        "kicker": "Coming soon",
        "description": "Reserved for the next racing experience on the grid.",
        "posterTone": "green"
      },
      {
        "id": "demo-two",
        "name": "Demo",
        "kicker": "Coming soon",
        "description": "A flexible slot for leagues, events, or partner servers.",
        "posterTone": "blue"
      }
    ]
  }'::jsonb,
  updated_at = NOW()
WHERE slug = 'grid'
  AND title = 'Lights Out'
  AND body = 'The paddock clears, the race line opens, and the cars settle into position.';

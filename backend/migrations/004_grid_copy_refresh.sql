UPDATE content_sections
SET
  title = 'Gaming Titles',
  body = 'Choose your racing title and join the community for well-organized events.',
  updated_at = NOW()
WHERE slug = 'grid'
  AND title IN ('Start Grid', 'Lights Out')
  AND body IN (
    'Choose your racing room, line up with the community, and roll into the opening lap.',
    'The paddock clears, the race line opens, and the cars settle into position.'
  );

UPDATE content_sections
SET
  settings = jsonb_set(
    COALESCE(settings, '{}'::jsonb),
    '{games}',
    (
      SELECT jsonb_agg(
        CASE
          WHEN game->>'id' = 'nfs-server' THEN game || '{"name": "Need for Speed"}'::jsonb
          ELSE game
        END
        ORDER BY ordinal
      )
      FROM jsonb_array_elements(settings->'games') WITH ORDINALITY AS game_entries(game, ordinal)
    )
  ),
  updated_at = NOW()
WHERE slug = 'grid'
  AND jsonb_typeof(settings->'games') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(settings->'games') AS game
    WHERE game->>'id' = 'nfs-server'
      AND game->>'name' = 'NFS Server'
  );

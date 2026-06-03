export function StoryPanels({ sections }) {
  return (
    <main className="scroll-story" aria-label="Paddock India racing story">
      {sections.map((section, index) => (
        <section
          key={section.id || section.slug}
          className={[
            'story-section',
            index === 0 ? 'story-section--intro' : '',
            index === sections.length - 1 ? 'story-section--finish' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          data-panel={section.panelKey}
          data-active={index === 0}
        >
          {index === 0 ? <HomeIntro section={section} /> : <StorySectionContent section={section} />}
        </section>
      ))}
    </main>
  );
}

function HomeIntro({ section }) {
  return (
    <div className="home-intro">
      <div className="home-intro__copy">
        <p className="eyebrow">{section.eyebrow}</p>
        <h1 className="home-intro__brand" aria-label={section.title}>
          <span className="home-intro__title-text">{section.title}</span>
          <img
            className="home-intro__logo home-intro__logo--night"
            src="/assets/images/logos/paddock-india-wide-night.webp"
            alt=""
            aria-hidden="true"
            draggable="false"
            fetchPriority="high"
          />
          <img
            className="home-intro__logo home-intro__logo--day"
            src="/assets/images/logos/paddock-india-wide-day.webp"
            alt=""
            aria-hidden="true"
            draggable="false"
            fetchPriority="high"
          />
        </h1>
        {section.body ? <p className="home-intro__start">{section.body}</p> : null}
      </div>
      <div className="scroll-cue" aria-hidden="true">
        <span></span>
      </div>
    </div>
  );
}

function StorySectionContent({ section }) {
  const isGrid = section.panelKey === 'grid';
  const hasGames = isGrid && section.settings?.games?.length;

  return (
    <div className={['story-section__inner', isGrid ? 'story-section__inner--grid' : ''].filter(Boolean).join(' ')}>
      {hasGames ? <GameOfferings games={section.settings.games} /> : null}
      <div className={getCopyClass(section)}>
        <p className="eyebrow">{section.eyebrow}</p>
        <h2>{section.title}</h2>
        {section.body ? <p>{section.body}</p> : null}
        {section.settings?.links?.length ? <DetailList items={section.settings.links} external={section.panelKey === 'social'} /> : null}
      </div>
    </div>
  );
}

function GameOfferings({ games }) {
  return (
    <aside className="game-offerings" aria-label="Racing games offered">
      {games.map((game, index) => (
        <article
          className="game-card"
          data-has-poster={game.posterImage ? 'true' : 'false'}
          data-tone={game.posterTone || 'scarlet'}
          key={game.id || `${game.name}-${index}`}
          style={{ '--game-index': index }}
        >
          <div className="game-card__poster" aria-hidden="true">
            <img src={game.posterImage || '/assets/images/paddockindia-ui-car-small.png'} alt="" loading="lazy" draggable="false" />
          </div>
          <div className="game-card__copy">
            <span>{game.kicker || 'Racing'}</span>
            <strong>{game.name}</strong>
            {game.description ? <p>{game.description}</p> : null}
          </div>
        </article>
      ))}
    </aside>
  );
}

function DetailList({ items, external = false }) {
  return (
    <ul className="detail-list">
      {items.map((item) => (
        <li key={item.label}>
          <span>{item.label}</span>
          {item.href ? (
            <a href={item.href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
              {item.text}
            </a>
          ) : (
            <strong>{item.text}</strong>
          )}
        </li>
      ))}
    </ul>
  );
}

function getCopyClass(section) {
  const tone = section.settings?.tone;
  return ['copy-block', tone === 'quiet' ? 'copy-block--quiet' : '', tone === 'social' ? 'copy-block--social' : '', tone === 'contact' ? 'copy-block--contact' : '']
    .filter(Boolean)
    .join(' ');
}

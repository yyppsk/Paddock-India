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
          <div className={getCopyClass(section)}>
            <p className="eyebrow">{section.eyebrow}</p>
            {index === 0 ? <h1>{section.title}</h1> : <h2>{section.title}</h2>}
            {section.body ? <p>{section.body}</p> : null}
            {section.settings?.links?.length ? <DetailList items={section.settings.links} external={section.panelKey === 'social'} /> : null}
          </div>
        </section>
      ))}
    </main>
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

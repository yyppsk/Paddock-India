import { Button } from './ui/Button.jsx';

export function RouteNavigation({ sections }) {
  const routeStops = sections.filter((section) => section.isNavItem !== false);

  return (
    <nav className="track-nav" aria-label="Lap navigation">
      <div className="track-nav__header">
        <span>Lap Map</span>
        <strong id="route-progress-value">0%</strong>
      </div>
      <div className="track-nav__road" aria-hidden="true">
        <span className="track-nav__road-progress"></span>
        <span className="track-nav__runner">
          <img src="/assets/images/paddockindia-ui-car-small.png" alt="" />
        </span>
      </div>
      <div className="track-nav__stops">
        {routeStops.map((stop, index) => (
          <Button
            key={stop.id || stop.slug}
            type="button"
            className="track-nav__stop"
            data-route-index={index}
            data-route-stage={stop.panelKey}
            data-route-progress={stop.progress}
            data-route-state={index === 0 ? 'active' : 'upcoming'}
            aria-current={index === 0}
          >
            <span className="track-nav__marker" aria-hidden="true"></span>
            <span className="track-nav__text">
              <strong>{stop.navLabel}</strong>
              <small>{stop.navDetail}</small>
            </span>
          </Button>
        ))}
      </div>
    </nav>
  );
}

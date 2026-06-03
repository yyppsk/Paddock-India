export function LoadingScreen() {
  return (
    <div className="loading-screen" aria-live="polite" aria-label="Loading race scene">
      <div className="loading-screen__road" aria-hidden="true">
        <span className="loading-screen__lane"></span>
        <img
          className="loading-screen__car"
          src="/assets/images/paddockindia-ui-car-small.png"
          alt=""
          draggable="false"
        />
      </div>
    </div>
  );
}

export function Logo() {
  return (
    <div className="brand">
      <img
        className="brand__mark"
        src={`${import.meta.env.BASE_URL}favicon.svg`}
        alt=""
        aria-hidden="true"
      />
      <div><strong className="brand__title">DOTA PULSE</strong><small className="brand__subtitle">LOCAL ANALYTICS</small></div>
    </div>
  );
}

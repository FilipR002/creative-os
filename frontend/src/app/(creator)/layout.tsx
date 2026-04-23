// Creator layout — clean, Canva-like. No observability chrome.

export default function CreatorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="creator-shell">
      <nav className="creator-nav">
        <a href="/app" className="creator-nav-logo">Creative OS</a>
        <ul className="creator-nav-links">
          <li><a href="/app">Projects</a></li>
          <li>
            <a
              href="/dashboard"
              style={{ fontSize: 12, opacity: 0.5 }}
              title="Observability (internal)"
            >
              Observability ↗
            </a>
          </li>
        </ul>
      </nav>
      <div className="creator-content">
        {children}
      </div>
    </div>
  );
}

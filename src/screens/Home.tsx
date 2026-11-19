import { useMemo, useState } from "react";
import { GearIcon, PlayIcon } from "../components/Icons";
import { go } from "../lib/route";
import { loadScripts, loadSettings, sortScripts } from "../lib/storage";

const SEARCH_AFTER = 8;

export function Home() {
  const scripts = useMemo(() => sortScripts(loadScripts()), []);
  const name = loadSettings().learnerName.trim();
  const [query, setQuery] = useState("");
  const showSearch = scripts.length > SEARCH_AFTER;
  const shown = showSearch
    ? scripts.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()))
    : scripts;

  return (
    <div className="screen">
      <div className="topbar">
        <span />
        <button
          type="button"
          className="gear"
          aria-label="Coach settings"
          title="Coach settings"
          onClick={() => go({ name: "coach" })}
        >
          <GearIcon />
        </button>
      </div>

      <h1>{name ? `Hi ${name}! What do you want to practice today?` : "Hi! What do you want to practice today?"}</h1>

      <div className="home-actions">
        {showSearch ? (
          <input
            id="search"
            className="search sk"
            type="search"
            placeholder="Search my scripts"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        ) : (
          <span />
        )}
        <button type="button" className="btn primary" onClick={() => go({ name: "script", id: "new" })}>
          + New script
        </button>
      </div>

      <main className="main">
        {scripts.length === 0 ? (
          <div className="empty sk dashed">
            <p>You have no scripts yet.</p>
            <p>Tap <b>+ New script</b> to write or paste your first one.</p>
          </div>
        ) : (
          <ul className="script-list">
            {shown.map((s) => (
              <li key={s.id} className="script-row sk">
                <span className="script-name">{s.name.trim() || "Untitled script"}</span>
                <button type="button" className="btn small" onClick={() => go({ name: "script", id: s.id })}>
                  Edit
                </button>
                <button type="button" className="btn small primary" onClick={() => go({ name: "practice", id: s.id })}>
                  Practice <PlayIcon />
                </button>
              </li>
            ))}
            {showSearch && shown.length === 0 && <li className="muted">No script has that name.</li>}
          </ul>
        )}
      </main>
    </div>
  );
}

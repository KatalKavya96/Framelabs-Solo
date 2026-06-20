import Icon from "../Icon";

const groups = [
  { label: "Build", items: [["Diagrams", "file"], ["Entities", "grid"], ["Templates", "file"], ["Imports", "download"]] },
  { label: "Document", items: [["Docs", "file"], ["Guides", "book"], ["API Reference", "rocket"], ["Changelog", "history"]] },
  { label: "Collaborate", items: [["Projects", "briefcase"], ["Teams", "users"], ["Comments", "comment"]] },
  { label: "Tools", items: [["Integrations", "diamond"], ["Export", "upload"], ["Version History", "history"]] },
];

type SidebarProps = { open: boolean; onClose: () => void; onNotice: (message: string) => void };

export default function Sidebar({ open, onClose, onNotice }: SidebarProps) {
  return <>
    {open && <button className="sidebar-scrim" onClick={onClose} aria-label="Close menu" />}
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <button className="side-link active" onClick={onClose}><Icon name="home" /><span>Home</span></button>
      {groups.map((group) => (
        <div className="side-group" key={group.label}>
          <p>{group.label}</p>
          {group.items.map(([label, icon]) => <button className="side-link" key={label} onClick={() => onNotice(`${label} selected`)}><Icon name={icon} /><span>{label}</span></button>)}
        </div>
      ))}
      <div className="upgrade-card">
        <div className="upgrade-title"><Icon name="sparkle" /> Pro Plan</div>
        <p>Unlock advanced features and unlimited diagrams.</p>
        <button onClick={() => onNotice("Upgrade options opened")}>Upgrade now</button>
      </div>
      <div className="help-card">
        <div><strong>Need help?</strong><p>Join our community or contact support.</p><button onClick={() => onNotice("Support center opened")}>Get Support</button></div>
        <Icon name="headset" />
      </div>
    </aside>
  </>;
}

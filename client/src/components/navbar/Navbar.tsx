import Icon from "../Icon";

type NavbarProps = {
  onMenu: () => void;
  onNotice: (message: string) => void;
};

export default function Navbar({ onMenu, onNotice }: NavbarProps) {
  return (
    <header className="navbar">
      <button className="mobile-menu icon-button" onClick={onMenu} aria-label="Open menu"><Icon name="menu" /></button>
      <a className="brand" href="#top" aria-label="Framelabs home">
        <span className="brand-mark"><i /><i /><i /></span>
        <span>Framelabs</span>
      </a>

      <label className="search-box">
        <Icon name="search" />
        <input type="search" placeholder="Search docs, diagrams, entities..." aria-label="Search" />
        <kbd>⌘&nbsp; K</kbd>
      </label>

      <nav className="nav-actions" aria-label="Account actions">
        <button className="icon-button" onClick={() => onNotice("No new documents yet")} aria-label="Documents"><Icon name="file" /></button>
        <button className="icon-button notification" onClick={() => onNotice("You're all caught up") } aria-label="Notifications"><Icon name="bell" /><span>1</span></button>
        <button className="icon-button" onClick={() => onNotice("Help center opened") } aria-label="Help"><Icon name="help" /></button>
        <span className="divider" />
        <button className="profile" onClick={() => onNotice("Account menu") }>
          <span className="avatar">AM</span>
          <span className="profile-name">Alex Morgan</span>
          <Icon name="chevron" />
        </button>
      </nav>
    </header>
  );
}

import { useState } from "react";
import Navbar from "../components/navbar/Navbar";
import Sidebar from "../components/sidebar/Sidebar";
import Icon from "../components/Icon";

const quickActions = [
  ["New Diagram", "Create from scratch", "plus", "teal"],
  ["From Template", "Choose a template", "grid", "slate"],
  ["Import File", "CSV, SQL, JSON, etc.", "upload", "slate"],
  ["Start from JSON", "Paste or upload JSON", "code", "slate"],
  ["AI Generate", "Describe & generate", "sparkle", "violet"],
];

const templates = [
  ["Entity Relationship", "Design database ERDs", "blue", "erd"],
  ["Flowchart", "Map processes and flows", "teal", "flow"],
  ["System Architecture", "Visualize systems", "purple", "tree"],
  ["UML Diagram", "Model software systems", "amber", "tree"],
  ["Mindmap", "Brainstorm ideas", "pink", "mind"],
];

function DiagramPreview({ color, type }: { color: string; type: string }) {
  const c = `var(--${color})`;
  if (type === "flow") return <svg className="diagram-preview" viewBox="0 0 150 115"><g stroke={c} fill="none"><path d="M75 19v19M75 49v19M75 78v19M35 58h80M35 58v20M115 58v20"/><rect x="58" y="5" width="34" height="17" rx="8" fill={c}/><path d="m75 32 8 8-8 8-8-8z" fill={c}/><rect x="58" y="49" width="34" height="18" rx="9" fill={c}/><path d="m115 69 16 9-16 9-16-9z" fill={c}/><rect x="19" y="69" width="32" height="18" rx="9" fill={c}/><rect x="60" y="93" width="30" height="18" rx="9" fill={c}/></g></svg>;
  const nodes = type === "mind" ? [[13,63,36,14],[50,20,35,14],[50,50,35,14],[50,80,35,14],[101,8,36,14],[101,38,36,14],[101,68,36,14],[101,98,36,14]] : [[56,8,39,22],[14,52,34,22],[58,52,34,22],[102,52,34,22],[25,91,27,18],[62,91,27,18],[99,91,27,18]];
  return <svg className="diagram-preview" viewBox="0 0 150 115"><g stroke={c} fill="none" strokeWidth="1.4"><path d={type === "mind" ? "M31 70h10V27h9M41 57h9M41 87h9M85 27h9V15h7M94 27v18h7M94 45v30h7M94 75v30h7" : "M75 30v12M31 42h88M31 42v10M75 42v10M119 42v10M75 74v8M38 82h74M38 82v9M75 82v9M112 82v9"}/>{nodes.map(([x,y,w,h],i)=><g key={i}><rect x={x} y={y} width={w} height={h} rx="3" fill={`${c}`} fillOpacity={i === 0 ? ".34" : ".2"}/><path d={`M${x+7} ${y+7}h${Math.max(8,w-14)}M${x+7} ${y+11}h${Math.max(5,w-21)}`} strokeWidth="1.6"/></g>)}</g></svg>;
}

function HeroDiagram() {
  return <div className="hero-art" aria-hidden="true">
    <div className="grid-glow" />
    <svg viewBox="0 0 430 230">
      <g fill="none" stroke="#2ca7ff" strokeWidth="1.3"><path d="M64 149h65c18 0 14-46 40-46h40M141 165h33c17 0 14-28 35-28M281 75h42c10 0 7 21 18 21h19M281 115h42c13 0 14 24 34 24h10M281 148h42c13 0 14 25 34 25h10"/><g fill="#27b2ff" stroke="none"><circle cx="64" cy="149" r="2"/><circle cx="129" cy="149" r="2"/><circle cx="209" cy="103" r="2"/><circle cx="281" cy="75" r="2"/><circle cx="281" cy="148" r="2"/><circle cx="367" cy="139" r="2"/></g></g>
      <g className="hero-node"><rect x="52" y="119" width="92" height="92" rx="11"/><path className="accent teal-line" d="M64 134h19M64 141h12"/><rect className="entity green" x="64" y="154" width="14" height="14" rx="2"/><path d="M85 159h40M85 165h27M64 179h14M85 184h33M64 194h14M85 199h25"/></g>
      <g className="hero-node big"><rect x="207" y="34" width="124" height="155" rx="12"/><path className="accent blue-line" d="M220 50h21M220 57h13"/><rect className="entity blue" x="220" y="78" width="15" height="18" rx="2"/><path d="M243 83h51M243 91h34M220 112h15M243 117h46M243 125h31M220 144h15M243 149h49M243 157h28"/></g>
      <g className="hero-node"><rect x="368" y="76" width="56" height="112" rx="11"/><path className="accent blue-line" d="M380 92h21M380 99h14"/><rect className="entity blue" x="380" y="121" width="14" height="16" rx="2"/><path d="M401 126h16M401 134h10M380 151h14M401 156h16M380 174h14M401 179h14"/></g>
      <path className="cursor" d="m292 150 9 29 7-10 12 11 5-5-12-11 11-6z"/>
      <g className="spark"><path d="m400 47 3 9 8 3-8 3-3 9-3-9-8-3 8-3z"/><circle cx="350" cy="25" r="1.5"/><circle cx="152" cy="36" r="1.5"/></g>
    </svg>
  </div>;
}

export default function Homepage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newMenu, setNewMenu] = useState(false);
  const [toast, setToast] = useState("");
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2200); };

  return <div className="app-shell" id="top">
    <Navbar onMenu={() => setSidebarOpen(true)} onNotice={notify} />
    <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNotice={notify} />
    <main className="main-content">
      <section className="welcome-panel panel">
        <div className="welcome-copy">
          <p className="eyebrow">Your visual workspace</p>
          <h1>Welcome to <span>Framelabs</span> Docs</h1>
          <h2>Design. Document. Collaborate.</h2>
          <p>Everything you need to visualize and document<br/>your systems in one place.</p>
        </div>
        <div className="new-diagram-wrap">
          <button className="primary-button" onClick={() => setNewMenu(!newMenu)}><Icon name="plus" /> New Diagram <Icon name="chevron" /></button>
          {newMenu && <div className="new-menu"><button onClick={() => {notify("Blank diagram created");setNewMenu(false)}}>Blank diagram</button><button onClick={() => {notify("Template gallery opened");setNewMenu(false)}}>Use a template</button></div>}
        </div>
        <HeroDiagram />
        <div className="quick-actions">
          {quickActions.map(([title, subtitle, icon, tone]) => <button key={title} onClick={() => notify(`${title} opened`)}>
            <span className={`quick-icon ${tone}`}><Icon name={icon}/></span><strong>{title}</strong><small>{subtitle}</small>
          </button>)}
        </div>
      </section>

      <section className="templates panel">
        <div className="section-heading"><div><h2>Start Building</h2><p>Choose what you want to design today.</p></div><button onClick={() => notify("Showing all templates")}>View all templates <Icon name="arrow" /></button></div>
        <div className="template-grid">
          {templates.map(([title, subtitle, color, type]) => <button className="template-card" key={title} onClick={() => notify(`${title} template selected`)}><DiagramPreview color={color} type={type}/><strong>{title}</strong><small>{subtitle}</small></button>)}
        </div>
      </section>

      <footer className="footer panel">
        <div className="footer-about"><a className="brand footer-brand" href="#top"><span className="brand-mark"><i/><i/><i/></span><span>Framelabs</span></a><p>The modern platform for designing, documenting and collaborating on system diagrams.</p><div className="socials"><button aria-label="GitHub"><Icon name="github"/></button><button aria-label="X">𝕏</button><button aria-label="LinkedIn">in</button><button aria-label="YouTube">▶</button></div></div>
        {[["Product","Features","Templates","Integrations","Changelog","Roadmap"],["Resources","Docs","Guides","API Reference","Blog","Help Center"],["Community","Discord","GitHub","Forum","Contact Us"],["Legal","Privacy Policy","Terms of Service","Security","Data Processing"]].map(([head,...links])=><div className="footer-column" key={head}><strong>{head}</strong>{links.map(link=><button key={link} onClick={() => notify(link)}>{link}</button>)}</div>)}
        <div className="footer-bottom"><span>© 2026 Framelabs. All rights reserved.</span><span>Made with <b>♥</b> by Framelabs Team</span></div>
      </footer>
    </main>
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}

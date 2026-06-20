import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { name: string };

const paths: Record<string, React.ReactNode> = {
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
  file: <><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 12h6M9 16h6"/></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
  download: <><path d="M12 3v12M7 10l5 5 5-5M4 20h16"/></>,
  book: <><path d="M4 4h7a3 3 0 0 1 3 3v14a3 3 0 0 0-3-3H4z"/><path d="M20 4h-3a3 3 0 0 0-3 3v14a3 3 0 0 1 3-3h3z"/></>,
  rocket: <><path d="M14 5c3-3 6-2 6-2s1 3-2 6l-7 7-4 1 1-4z"/><path d="m15 14 1 5-4 3-1-6M8 13l-5-1 3-4 5 1M6 18l-2 2"/></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M3 12h18M10 12v2h4v-2"/></>,
  users: <><circle cx="9" cy="8" r="4"/><path d="M2 21v-2a6 6 0 0 1 12 0v2M16 4a4 4 0 0 1 0 8M17 15a6 6 0 0 1 5 6"/></>,
  comment: <><path d="M4 4h16v13H9l-5 4z"/><path d="M8 9h8M8 13h5"/></>,
  diamond: <><path d="m12 3 9 9-9 9-9-9zM8 12h8M12 8v8"/></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5M4 14v6h16v-6"/></>,
  plus: <><path d="M12 5v14M5 12h14"/></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></>,
  help: <><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.8 2c-1.2.8-1.6 1.3-1.6 3M12 18h.01"/></>,
  chevron: <path d="m8 10 4 4 4-4"/>,
  command: <><path d="M9 6V4a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v16a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z"/></>,
  code: <><path d="M8 4H5v16h3M16 4h3v16h-3M14 8l-4 8"/></>,
  sparkle: <><path d="m12 2 1.7 5.3L19 9l-5.3 1.7L12 16l-1.7-5.3L5 9l5.3-1.7z"/><path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z"/></>,
  arrow: <><path d="M5 12h14M14 7l5 5-5 5"/></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16"/></>,
  headset: <><path d="M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v6H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 1-2M20 14h-3v6h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-1-2M17 20c-1 2-3 2-5 2"/></>,
  github: <><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.9a3.4 3.4 0 0 0-.9-2.6c3 0 6.1-1.5 6.1-6.8A5.3 5.3 0 0 0 19.8 5 5 5 0 0 0 19.7 1S18.6.6 16 2.5a13.4 13.4 0 0 0-7 0C6.4.6 5.3 1 5.3 1A5 5 0 0 0 5.2 5a5.3 5.3 0 0 0-1.4 3.7c0 5.3 3.1 6.8 6.1 6.8A3.4 3.4 0 0 0 9 18.1V22"/></>,
};

export default function Icon({ name, ...props }: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] ?? paths.file}</svg>;
}

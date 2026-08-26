"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BriefcaseBusiness, CalendarDays, CheckSquare2, LayoutDashboard, Megaphone, Settings2, UsersRound } from "lucide-react";
import { AppStoreProvider } from "@/components/app-store";

const mobileNav = [
  { href: "/dashboard", label: "Aujourd’hui", icon: CalendarDays },
  { href: "/prospects", label: "Prospects", icon: UsersRound },
  { href: "/campaigns", label: "Campagnes", icon: Megaphone },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/settings", label: "Réglages", icon: Settings2 },
];

const desktopNav = [
  ...mobileNav,
  { href: "/approval", label: "Validation", icon: CheckSquare2 },
  { href: "/pipeline", label: "Pipeline", icon: BriefcaseBusiness },
];

function NavLink({ href, label, icon: Icon, mobile = false }: { href: string; label: string; icon: typeof LayoutDashboard; mobile?: boolean }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return <Link href={href} className={`${mobile ? "mobile-nav-link" : "side-nav-link"} ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
    <Icon size={mobile ? 21 : 19} strokeWidth={active ? 2.4 : 1.8} /><span>{label}</span>
  </Link>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return <AppStoreProvider>
    <div className="app-frame">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard"><span className="brand-mark">B</span><span><strong>Bien En Ligne</strong><small>Prospection</small></span></Link>
        <nav className="side-nav" aria-label="Navigation principale">{desktopNav.map((item) => <NavLink key={item.href} {...item} />)}</nav>
        <div className="demo-note"><span className="status-dot" />Mode local actif<small>Vos données restent sur cet appareil.</small></div>
      </aside>
      <main className="main-content">{children}</main>
      <nav className="mobile-nav" aria-label="Navigation mobile">{mobileNav.map((item) => <NavLink key={item.href} {...item} mobile />)}</nav>
    </div>
  </AppStoreProvider>;
}

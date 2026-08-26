"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BriefcaseBusiness, CalendarDays, CheckSquare2, LayoutDashboard, LogOut, Megaphone, Settings2, UsersRound, X } from "lucide-react";
import { AppStoreProvider, useAppStore } from "@/components/app-store";
import type { AppState, DataMode } from "@/lib/types";

const mobileNav = [
  { href: "/dashboard", label: "Aujourd’hui", icon: CalendarDays },
  { href: "/approval", label: "Validation", icon: CheckSquare2 },
  { href: "/prospects", label: "Prospects", icon: UsersRound },
  { href: "/campaigns", label: "Campagnes", icon: Megaphone },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/settings", label: "Réglages", icon: Settings2 },
];

const desktopNav = [
  { href: "/approval", label: "Validation", icon: CheckSquare2 },
  { href: "/dashboard", label: "Aujourd’hui", icon: CalendarDays },
  { href: "/prospects", label: "Prospects", icon: UsersRound },
  { href: "/campaigns", label: "Campagnes", icon: Megaphone },
  { href: "/pipeline", label: "Pipeline", icon: BriefcaseBusiness },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/settings", label: "Réglages", icon: Settings2 },
];

function NavLink({ href, label, icon: Icon, mobile = false }: { href: string; label: string; icon: typeof LayoutDashboard; mobile?: boolean }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return <Link href={href} className={`${mobile ? "mobile-nav-link" : "side-nav-link"} ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
    <Icon size={mobile ? 21 : 19} strokeWidth={active ? 2.4 : 1.8} /><span>{label}</span>
  </Link>;
}

function ShellFrame({ children }: { children: React.ReactNode }) {
  const { mode, error, clearError, busy, state } = useAppStore();
  return <>
    <div className="app-frame">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard"><span className="brand-mark">B</span><span><strong>Bien En Ligne</strong><small>Prospection</small></span></Link>
        <nav className="side-nav" aria-label="Navigation principale">{desktopNav.map((item) => <NavLink key={item.href} {...item} />)}</nav>
        <div className="demo-note"><span className="status-dot" />{mode === "supabase" ? "Supabase connecté" : "Mode démo local"}<small>{mode === "supabase" ? state.profile.companyName : "Données sur cet appareil."}</small></div>
        {mode === "supabase" ? <form action="/auth/logout" method="post"><button className="button ghost logout-button" type="submit"><LogOut size={16} />Déconnexion</button></form> : null}
      </aside>
      <main className="main-content">{children}</main>
      <nav className="mobile-nav" aria-label="Navigation mobile">{mobileNav.map((item) => <NavLink key={item.href} {...item} mobile />)}</nav>
    </div>
    {busy ? <div className="sync-indicator" role="status">Synchronisation…</div> : null}
    {error ? <div className="error-banner" role="alert"><span>{error}</span><button className="icon-button" onClick={clearError} aria-label="Fermer"><X size={16} /></button></div> : null}
  </>;
}

export function AppShell({ children, initialData, mode, userId }: { children: React.ReactNode; initialData: AppState; mode: DataMode; userId?: string }) {
  return <AppStoreProvider initialData={initialData} mode={mode} userId={userId}><ShellFrame>{children}</ShellFrame></AppStoreProvider>;
}

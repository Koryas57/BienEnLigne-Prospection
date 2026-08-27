"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BarChart3, BriefcaseBusiness, CalendarDays, CheckSquare2, LayoutDashboard, LogOut, Megaphone, Menu, Settings2, UsersRound, X } from "lucide-react";
import { AppStoreProvider, useAppStore } from "@/components/app-store";
import type { AppState, DataMode } from "@/lib/types";

const mobileNav = [
  { href: "/dashboard", label: "Aujourd’hui", icon: CalendarDays },
  { href: "/approval", label: "Validation", icon: CheckSquare2 },
  { href: "/prospects", label: "Prospects", icon: UsersRound },
  { href: "/campaigns", label: "Campagnes", icon: Megaphone },
];

const mobileMoreNav = [
  { href: "/pipeline", label: "Pipeline", icon: BriefcaseBusiness },
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

function MobileNavigation({ mode, companyName }: { mode: DataMode; companyName?: string }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const moreActive = mobileMoreNav.some(({ href }) => pathname === href || pathname.startsWith(`${href}/`));

  useEffect(() => {
    if (!moreOpen) return;

    const previousOverflow = document.body.style.overflow;
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function closeAndRestoreFocus() {
      setMoreOpen(false);
      requestAnimationFrame(() => triggerRef.current?.focus());
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAndRestoreFocus();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = sheetRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function handleDesktopChange(event: MediaQueryListEvent) {
      if (event.matches) closeAndRestoreFocus();
    }

    document.addEventListener("keydown", handleKeyDown);
    desktopQuery.addEventListener("change", handleDesktopChange);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      desktopQuery.removeEventListener("change", handleDesktopChange);
    };
  }, [moreOpen]);

  function closeSheet(restoreFocus = true) {
    setMoreOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return <>
    <nav className="mobile-nav" aria-label="Navigation mobile">
      {mobileNav.map((item) => <NavLink key={item.href} {...item} mobile />)}
      <button
        ref={triggerRef}
        className={`mobile-nav-link mobile-more-trigger ${moreActive ? "active" : ""}`}
        type="button"
        aria-expanded={moreOpen}
        aria-controls="mobile-more-sheet"
        aria-haspopup="dialog"
        aria-current={moreActive ? "page" : undefined}
        onClick={() => setMoreOpen(true)}
      >
        <Menu size={21} strokeWidth={moreActive ? 2.4 : 1.8} /><span>Plus</span>
      </button>
    </nav>
    {moreOpen ? <div className="mobile-more-layer">
      <button className="mobile-more-overlay" type="button" aria-label="Fermer le menu Plus" tabIndex={-1} onClick={() => closeSheet()} />
      <section ref={sheetRef} className="mobile-more-sheet" id="mobile-more-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-more-title">
        <div className="mobile-more-header">
          <div><p className="eyebrow">Navigation</p><h2 id="mobile-more-title">Plus</h2></div>
          <button ref={closeRef} className="icon-button" type="button" aria-label="Fermer le menu Plus" onClick={() => closeSheet()}><X size={20} /></button>
        </div>
        <nav className="mobile-more-links" aria-label="Navigation complémentaire">
          {mobileMoreNav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return <Link key={href} href={href} className={`mobile-more-link ${active ? "active" : ""}`} aria-current={active ? "page" : undefined} onClick={() => closeSheet(false)}>
              <Icon size={21} strokeWidth={active ? 2.4 : 1.8} /><span>{label}</span>
            </Link>;
          })}
        </nav>
        <div className="mobile-connection-status">
          <span className="status-dot" aria-hidden="true" />
          <div><strong>{mode === "supabase" ? "Supabase connecté" : "Mode démo local"}</strong>{companyName ? <small>{companyName}</small> : null}</div>
        </div>
        <form action="/auth/logout" method="post">
          <button className="button mobile-logout-button" type="submit"><LogOut size={18} />Déconnexion</button>
        </form>
      </section>
    </div> : null}
  </>;
}

function ShellFrame({ children }: { children: React.ReactNode }) {
  const { mode, error, clearError, busy, state } = useAppStore();
  return <>
    <div className="app-frame">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard"><span className="brand-mark">B</span><span><strong>Bien En Ligne</strong><small>Prospection</small></span></Link>
        <nav className="side-nav" aria-label="Navigation principale">{desktopNav.map((item) => <NavLink key={item.href} {...item} />)}</nav>
        <div className="demo-note"><span className="status-dot" />{mode === "supabase" ? "Supabase connecté" : "Mode démo local"}<small>{mode === "supabase" ? state.profile.companyName : "Données sur cet appareil."}</small></div>
        <form action="/auth/logout" method="post"><button className="button ghost logout-button" type="submit"><LogOut size={16} />Déconnexion</button></form>
      </aside>
      <main className="main-content">{children}</main>
      <MobileNavigation mode={mode} companyName={state.profile.companyName || undefined} />
    </div>
    {busy ? <div className="sync-indicator" role="status">Synchronisation…</div> : null}
    {error ? <div className="error-banner" role="alert"><span>{error}</span><button className="icon-button" onClick={clearError} aria-label="Fermer"><X size={16} /></button></div> : null}
  </>;
}

export function AppShell({ children, initialData, mode, userId }: { children: React.ReactNode; initialData: AppState; mode: DataMode; userId?: string }) {
  return <AppStoreProvider initialData={initialData} mode={mode} userId={userId}><ShellFrame>{children}</ShellFrame></AppStoreProvider>;
}

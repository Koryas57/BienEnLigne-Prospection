"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { Home, Layers3, LogOut, Map, ScanLine, Settings2, Trophy, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AppStoreProvider, useAppStore } from "@/components/app-store";
import { GameAsset, type GameAssetName } from "@/components/game-asset";
import { AchievementCelebration, PlayerLevel } from "@/components/game-ui";
import { deriveGameProgress } from "@/lib/gameplay";
import type { AppState, DataMode } from "@/lib/types";

type GameNavItem = { href: string; label: string; icon: LucideIcon; asset?: GameAssetName; featured?: boolean };

const gameNav = [
  { href: "/dashboard", label: "Accueil", icon: Home },
  { href: "/prospects", label: "Deck", icon: Layers3, asset: "deck" },
  { href: "/scan", label: "Scanner", icon: ScanLine, asset: "scanner", featured: true },
  { href: "/campaigns", label: "Missions", icon: Map, asset: "mission-map" },
  { href: "/collection", label: "Collection", icon: Trophy, asset: "trophy" },
] satisfies GameNavItem[];

function GameNavLink({ href, label, icon: Icon, asset, featured = false, mobile = false }: GameNavItem & { mobile?: boolean }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return <Link href={href} className={`${mobile ? "mobile-nav-link" : "side-nav-link"} ${featured ? "featured" : ""} ${active ? "active" : ""}`} aria-current={active ? "page" : undefined} aria-label={featured ? "Scanner de nouvelles entreprises" : undefined}>
    <span className="nav-icon">{asset && (featured || active) ? <GameAsset name={asset} size={featured ? (mobile ? 68 : 48) : mobile ? 38 : 34} decorative priority={featured} /> : <Icon size={featured ? 24 : mobile ? 21 : 20} strokeWidth={active ? 2.5 : 2} />}</span><span>{label}</span>
  </Link>;
}

function PlayerTopbar() {
  const { state } = useAppStore();
  const game = useMemo(() => deriveGameProgress(state), [state]);
  const initial = state.profile.displayName.trim().charAt(0).toLocaleUpperCase("fr") || "B";
  return <header className="player-topbar">
    <Link className="player-avatar" href="/settings" aria-label="Ouvrir les paramètres"><span>{initial}</span><i aria-hidden="true" /></Link>
    <div className="topbar-level"><div><strong>{state.profile.displayName}</strong><span>Niveau {game.level} · {game.title}</span></div><div className="topbar-xp"><GameAsset name="xp-crystal" size={28} decorative /><span className="topbar-xp-fill" style={{ width: `${game.levelXp / game.xpPerLevel * 100}%` }} /><small>{game.levelXp}/{game.xpPerLevel} XP</small></div></div>
    <Link className="topbar-reward" href="/collection" aria-label={`Série actuelle : ${game.streak} jour${game.streak > 1 ? "s" : ""}. Ouvrir la collection.`}><GameAsset name="streak-flame" size={42} decorative /><span>{game.streak}</span></Link>
  </header>;
}

function ShellFrame({ children }: { children: React.ReactNode }) {
  const { error, clearError, busy, state } = useAppStore();
  const game = useMemo(() => deriveGameProgress(state), [state]);
  return <>
    <div className="app-frame">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard"><span className="brand-mark">B</span><span><strong>Bien En Ligne</strong><small>Prospection</small></span></Link>
        <PlayerLevel level={game.level} title={game.title} xp={game.levelXp} max={game.xpPerLevel} streak={game.streak} compact />
        <nav className="side-nav" aria-label="Navigation principale">{gameNav.map((item) => <GameNavLink key={item.href} {...item} />)}</nav>
        <div className="sidebar-footer">
          <Link className="side-utility-link" href="/settings"><Settings2 size={18} />Paramètres</Link>
          <form action="/auth/logout" method="post"><button className="side-utility-link logout-button" type="submit"><LogOut size={18} />Déconnexion</button></form>
        </div>
      </aside>
      <main className="main-content"><PlayerTopbar />{children}</main>
      <nav className="mobile-nav" aria-label="Navigation mobile">{gameNav.map((item) => <GameNavLink key={item.href} {...item} mobile />)}</nav>
    </div>
    {busy ? <div className="sync-indicator" role="status">En cours…</div> : null}
    {error ? <div className="error-banner" role="alert"><span>{error}</span><button className="icon-button" onClick={clearError} aria-label="Fermer"><X size={16} /></button></div> : null}
    <AchievementCelebration achievements={game.achievements} />
  </>;
}

export function AppShell({ children, initialData, mode, userId }: { children: React.ReactNode; initialData: AppState; mode: DataMode; userId?: string }) {
  return <AppStoreProvider initialData={initialData} mode={mode} userId={userId}><ShellFrame>{children}</ShellFrame></AppStoreProvider>;
}

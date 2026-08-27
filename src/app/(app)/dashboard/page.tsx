"use client";

import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { useAppStore } from "@/components/app-store";
import { GameAsset } from "@/components/game-asset";
import { AchievementCard, ObjectiveCard } from "@/components/game-ui";
import { deriveGameProgress } from "@/lib/gameplay";

export default function DashboardPage() {
  const { state } = useAppStore();
  const game = deriveGameProgress(state);
  const active = state.campaigns.find((campaign) => campaign.status === "ACTIVE") ?? state.campaigns[0];
  const prospects = state.prospects.filter((prospect) => prospect.campaignId === active?.id && prospect.status !== "DO_NOT_CONTACT");
  const treated = prospects.filter((prospect) => prospect.status !== "NEW").length;
  const remaining = prospects.filter((prospect) => prospect.status === "NEW").length;
  const max = Math.max(active?.maxProspects ?? prospects.length, 1);
  const progress = Math.min(100, Math.round(treated / max * 100));
  const recentAchievements = game.achievements.filter((achievement) => achievement.unlocked).toSorted((a, b) => (b.unlockedAt ?? "").localeCompare(a.unlockedAt ?? "")).slice(0, 2);
  const collectionPreview = recentAchievements.length ? recentAchievements : game.achievements.slice(0, 2);

  return <div className="game-home">
    <section className="home-welcome"><div><span>Bonjour {state.profile.displayName}</span><h1>Prêt pour une nouvelle partie ?</h1></div>{game.streak ? <div className="home-streak"><GameAsset name="streak-flame" size={52} decorative />{game.streak} jour{game.streak > 1 ? "s" : ""}</div> : null}</section>

    <section className="active-mission-card">
      <div className="mission-card-art"><GameAsset name="mission-map" size={330} className="mission-hero-asset" priority alt="Carte 3D de la mission active" /></div>
      <div className="active-mission-copy">
        <span className="soft-label">Mission active</span>
        <h2>{active?.city ?? "Choisissez une ville"}</h2>
        <p>{active?.sector ?? "Créez votre première mission"}</p>
        <div className="mission-count"><strong>{treated}</strong><span>/ {max} cartes</span></div>
        <div className="soft-progress" role="progressbar" aria-label="Progression de la mission" aria-valuemin={0} aria-valuemax={max} aria-valuenow={treated}><span style={{ width: `${progress}%` }} /></div>
        <div className="mission-place"><MapPin size={16} />{active ? `${active.city}, ${active.state}` : "Aucune zone"}<span>{remaining} à trier</span></div>
        <Link className="game-primary-button" href={prospects.length ? "/prospects" : "/scan"}>{prospects.length ? "Continuer" : "Lancer un scan"}<ArrowRight size={20} /></Link>
      </div>
    </section>

    <section className="home-panels">
      <article className="home-panel daily-panel">
        <div className="home-panel-title"><div><span className="panel-orb"><GameAsset name="streak-flame" size={48} decorative /></span><div><h2>Missions du jour</h2><p>{game.objectives.filter((objective) => objective.current >= objective.target).length}/{game.objectives.length} terminées</p></div></div><Link href="/campaigns">Tout voir</Link></div>
        <div className="objective-list">{game.objectives.slice(0, 3).map((objective) => <ObjectiveCard key={objective.id} objective={objective} />)}</div>
      </article>
      <article className="home-panel collection-panel">
        <div className="home-panel-title"><div><span className="panel-orb reward"><GameAsset name="trophy" size={50} decorative /></span><div><h2>Collection</h2><p>{game.achievements.filter((achievement) => achievement.unlocked).length}/{game.achievements.length} succès</p></div></div><Link href="/collection">Ouvrir</Link></div>
        <div className="home-achievements">{collectionPreview.map((achievement) => <AchievementCard key={achievement.id} achievement={achievement} />)}</div>
      </article>
    </section>
  </div>;
}

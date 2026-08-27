"use client";

import Link from "next/link";
import { BarChart3, LockKeyhole } from "lucide-react";
import { useAppStore } from "@/components/app-store";
import { GameAsset } from "@/components/game-asset";
import { AchievementCard } from "@/components/game-ui";
import { deriveGameProgress } from "@/lib/gameplay";

export default function CollectionPage() {
  const { state } = useAppStore();
  const game = deriveGameProgress(state);
  const unlocked = game.achievements.filter((achievement) => achievement.unlocked).length;
  const collectionPercent = Math.round(unlocked / game.achievements.length * 100);

  return <div className="collection-page">
    <header className="collection-hero">
      <div className="collection-crown"><span aria-hidden="true" /><GameAsset name="trophy" size={280} className="collection-trophy-asset" priority alt="Trophée de votre collection" /></div>
      <span>Votre collection</span><h1>{unlocked} succès débloqué{unlocked > 1 ? "s" : ""}</h1><p>Chaque insigne raconte une étape réelle de votre progression.</p>
      <div className="collection-progress"><div><span style={{ width: `${collectionPercent}%` }} /></div><strong>{collectionPercent}%</strong></div>
    </header>

    <section className="badge-album"><div className="album-heading"><div><span className="album-tab active">Insignes</span><span className="album-tab"><LockKeyhole size={14} />{game.achievements.length - unlocked} à découvrir</span></div><Link href="/stats"><BarChart3 size={17} />Performances</Link></div><div className="collection-grid">{game.achievements.map((achievement) => <AchievementCard key={achievement.id} achievement={achievement} />)}</div></section>

    <section className="xp-recap"><GameAsset name="xp-crystal" size={92} decorative /><div><span>XP de collection</span><strong>+{game.achievementXp}</strong><p>Inclus dans votre niveau actuel.</p></div></section>
  </div>;
}

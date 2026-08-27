"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Building2, Camera, Check, Coffee, Crosshair, HandHeart, Mail, Phone, Scissors, ShoppingBag, Sparkles, Stethoscope, Store, Wrench } from "lucide-react";
import { GameAsset } from "@/components/game-asset";
import type { Achievement, DailyObjective } from "@/lib/gameplay";
import { getLeadRank, getProspectSignals } from "@/lib/gameplay";
import type { Prospect } from "@/lib/types";

type ProgressStyle = CSSProperties & { "--progress": string };
type ScoreStyle = CSSProperties & { "--score": number };

export function ProgressBar({ value, max, label, compact = false }: { value: number; max: number; label: string; compact?: boolean }) {
  const percent = max > 0 ? Math.min(100, Math.round(value / max * 100)) : 0;
  return <div className={`game-progress ${compact ? "compact" : ""}`}>
    <div className="game-progress-label"><span>{label}</span><strong>{value}/{max}</strong></div>
    <div className="game-progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)}>
      <span style={{ "--progress": `${percent}%` } as ProgressStyle} />
    </div>
  </div>;
}

export function PlayerLevel({ level, title, xp, max, streak, compact = false }: { level: number; title: string; xp: number; max: number; streak: number; compact?: boolean }) {
  return <div className={`player-level ${compact ? "compact" : ""}`}>
    <GameAsset name="xp-crystal" size={compact ? 38 : 48} className="level-emblem-asset" decorative />
    <div className="player-level-main"><div><strong>Niveau {level}</strong><span>{title}</span></div><ProgressBar value={xp} max={max} label={`${xp} XP vers le niveau ${level + 1}`} compact /></div>
    <div className="streak-chip" title="Série de jours avec activité"><GameAsset name="streak-flame" size={32} decorative />{streak}</div>
  </div>;
}

export function LeadScore({ score, large = false }: { score: number; large?: boolean }) {
  const rank = getLeadRank(score);
  return <div className={`lead-score-wrap rank-${rank.tone} ${large ? "large" : ""}`}>
    <div className="lead-score-ring" style={{ "--score": Math.max(0, Math.min(100, score)) } as ScoreStyle} role="img" aria-label={`Score ${score} sur 100, rang ${rank.label}`}>
      <strong>{score}</strong><small>/100</small>
    </div>
    <span className="lead-rank">{rank.label === "Cible premium" ? <GameAsset name="rank-premium" size={28} decorative /> : <Sparkles size={12} />}{rank.label}</span>
  </div>;
}

export function ObjectiveCard({ objective }: { objective: DailyObjective }) {
  const complete = objective.current >= objective.target;
  return <article className={`objective-card ${complete ? "complete" : ""}`}>
    <div className="objective-icon" aria-hidden="true">{complete ? <Check size={18} /> : <Crosshair size={18} />}</div>
    <div className="objective-main"><div><strong>{objective.label}</strong><span className="objective-xp"><GameAsset name="xp-crystal" size={25} decorative />+{objective.xp} XP</span></div><ProgressBar value={objective.current} max={objective.target} label={`Progression : ${objective.label}`} compact /></div>
  </article>;
}

export function AchievementCard({ achievement }: { achievement: Achievement }) {
  return <article className={`achievement-card ${achievement.unlocked ? "unlocked" : "locked"}`} aria-label={`${achievement.label}, ${achievement.unlocked ? "débloqué" : "verrouillé"}`}>
    <div className="achievement-emblem"><GameAsset name={achievement.unlocked ? "achievement-unlocked" : "achievement-locked"} size={92} decorative /></div>
    <div className="achievement-copy"><strong>{achievement.label}</strong><span>{achievement.description}</span><ProgressBar value={achievement.current} max={achievement.target} label={`Progression de ${achievement.label}`} compact /><small>{achievement.unlocked && achievement.unlockedAt ? `Débloqué le ${new Date(achievement.unlockedAt).toLocaleDateString("fr-FR")}` : `+${achievement.xp} XP`}</small></div>
  </article>;
}

export function CategoryVisual({ category }: { category: string }) {
  const normalized = category.toLocaleLowerCase("fr");
  let kind = "business";
  let icon: ReactNode = <Building2 size={34} />;
  let asset: ReactNode;
  if (normalized.includes("restaurant") || normalized.includes("food")) { kind = "restaurant"; asset = <GameAsset name="restaurant" size={210} className="category-game-asset" decorative />; }
  else if (normalized.includes("caf") || normalized.includes("coffee")) { kind = "cafe"; icon = <Coffee size={38} />; }
  else if (normalized.includes("salon") || normalized.includes("hair")) { kind = "salon"; icon = <Scissors size={38} />; }
  else if (normalized.includes("dent") || normalized.includes("clinic")) { kind = "health"; icon = <Stethoscope size={38} />; }
  else if (normalized.includes("hvac") || normalized.includes("repair") || normalized.includes("service")) { kind = "service"; icon = <Wrench size={38} />; }
  else if (normalized.includes("boutique") || normalized.includes("shop") || normalized.includes("store")) { kind = "shop"; icon = <ShoppingBag size={38} />; }
  else if (normalized.includes("photo")) { kind = "creative"; icon = <Camera size={38} />; }
  else if (normalized.includes("association") || normalized.includes("nonprofit")) { kind = "community"; icon = <HandHeart size={38} />; }
  return <div className={`category-visual category-${kind} ${asset ? "has-game-asset" : ""}`} role="img" aria-label={`Illustration générique du secteur ${category}`}><span className="scene-orb scene-orb-one" aria-hidden="true" /><span className="scene-orb scene-orb-two" aria-hidden="true" /><span className="scene-platform" aria-hidden="true" />{asset ?? <span className="scene-icon" aria-hidden="true">{icon}</span>}<small>{category}</small></div>;
}

export function IntelSignal({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "positive" | "warning" }) {
  return <span className={`intel-signal ${tone}`}><i aria-hidden="true" />{children}</span>;
}

export function ProspectGameCard({ prospect, className = "" }: { prospect: Prospect; className?: string }) {
  const rank = getLeadRank(prospect.leadScore);
  const signals = getProspectSignals(prospect).slice(0, 3);
  return <article className={`prospect-game-card rarity-${rank.tone} ${className}`}>
    <div className="card-rarity"><span>{rank.label}</span>{rank.label === "Cible premium" ? <GameAsset name="rank-premium" size={34} decorative /> : <Sparkles size={14} />}</div>
    <CategoryVisual category={prospect.category} />
    <div className="prospect-game-copy">
      <div className="prospect-game-title"><div><h2>{prospect.businessName}</h2><p>{prospect.category}</p></div><LeadScore score={prospect.leadScore} /></div>
      <p className="prospect-game-signal">{signals[0] ?? prospect.qualificationReason}</p>
      <div className="prospect-game-channels">{prospect.instagramUrl ? <span><Camera size={15} />Instagram</span> : null}{prospect.facebookUrl ? <span><Store size={15} />Facebook</span> : null}{prospect.phone ? <span><Phone size={15} />Téléphone</span> : null}{prospect.email ? <span><Mail size={15} />Email</span> : null}</div>
      <p className="prospect-game-location">{prospect.city}, {prospect.state}</p>
    </div>
  </article>;
}

export function AchievementCelebration({ achievements }: { achievements: Achievement[] }) {
  const initialUnlocked = useRef(new Set(achievements.filter((achievement) => achievement.unlocked).map((achievement) => achievement.id)));
  const [celebrated, setCelebrated] = useState<Achievement>();

  useEffect(() => {
    const newlyUnlocked = achievements.find((achievement) => achievement.unlocked && !initialUnlocked.current.has(achievement.id));
    if (!newlyUnlocked) return;
    initialUnlocked.current.add(newlyUnlocked.id);
    const showTimer = window.setTimeout(() => setCelebrated(newlyUnlocked), 0);
    const hideTimer = window.setTimeout(() => setCelebrated(undefined), 3200);
    return () => { window.clearTimeout(showTimer); window.clearTimeout(hideTimer); };
  }, [achievements]);

  return celebrated ? <div className="achievement-celebration" role="status" aria-live="polite"><div className="celebration-particles" aria-hidden="true" /><GameAsset name="achievement-unlocked" size={190} decorative /><span>Succès débloqué</span><strong>{celebrated.label}</strong><b><GameAsset name="xp-crystal" size={38} decorative />+{celebrated.xp} XP</b></div> : null;
}

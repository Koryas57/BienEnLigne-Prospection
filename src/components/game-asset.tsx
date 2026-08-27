import Image, { type StaticImageData } from "next/image";
import type { CSSProperties } from "react";
import achievementLocked from "../../public/assets/game/achievement-locked.png";
import achievementUnlocked from "../../public/assets/game/achievement-unlocked.png";
import deck from "../../public/assets/game/deck.png";
import missionMap from "../../public/assets/game/mission-map.png";
import rankPremium from "../../public/assets/game/rank-premium.png";
import restaurant from "../../public/assets/game/restaurant.png";
import scanner from "../../public/assets/game/scanner.png";
import streakFlame from "../../public/assets/game/streak-flame.png";
import trophy from "../../public/assets/game/trophy.png";
import xpCrystal from "../../public/assets/game/xp-crystal.png";

const gameAssets = {
  "achievement-locked": { src: achievementLocked, alt: "Insigne de succès verrouillé" },
  "achievement-unlocked": { src: achievementUnlocked, alt: "Médaille de succès débloqué" },
  deck: { src: deck, alt: "Pile de cartes de prospection" },
  "mission-map": { src: missionMap, alt: "Carte de mission avec repère" },
  "rank-premium": { src: rankPremium, alt: "Emblème du rang Cible premium" },
  restaurant: { src: restaurant, alt: "Illustration générique de la catégorie Restaurant" },
  scanner: { src: scanner, alt: "Scanner de prospection" },
  "streak-flame": { src: streakFlame, alt: "Flamme de série quotidienne" },
  trophy: { src: trophy, alt: "Trophée de collection" },
  "xp-crystal": { src: xpCrystal, alt: "Cristal d’expérience" },
} satisfies Record<string, { src: StaticImageData; alt: string }>;

export type GameAssetName = keyof typeof gameAssets;

type GameAssetProps = {
  name: GameAssetName;
  size?: number;
  className?: string;
  alt?: string;
  decorative?: boolean;
  priority?: boolean;
};

export function GameAsset({ name, size = 96, className = "", alt, decorative = false, priority = false }: GameAssetProps) {
  const asset = gameAssets[name];
  const loadingProps = priority ? { preload: true as const } : { loading: "lazy" as const };

  return <span className={`game-asset game-asset-${name} ${className}`.trim()} style={{ "--asset-size": `${size}px` } as CSSProperties}>
    <Image
      src={asset.src}
      alt={decorative ? "" : (alt ?? asset.alt)}
      sizes={`${size}px`}
      draggable={false}
      {...loadingProps}
    />
  </span>;
}

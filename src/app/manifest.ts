import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bien En Ligne — Prospection",
    short_name: "BEL Prospection",
    description: "Cockpit mobile de prospection commerciale.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f4f5f1",
    theme_color: "#0d5c45",
    lang: "fr",
  };
}

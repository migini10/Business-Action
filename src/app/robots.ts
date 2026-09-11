import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/",
        "/demande-devis",
        "/suivi",
        "/confidentialite",
        "/conditions-utilisation",
        "/suppression-donnees",
      ],
      disallow: [
        "/admin",
        "/admin/*",
        "/espace-client",
        "/espace-client/*",
        "/api",
        "/api/*",
        "/mot-de-passe-oublie",
        "/mot-de-passe-oublie/*",
      ],
    },
    sitemap: "https://businessaction.sn/sitemap.xml",
    host: "https://businessaction.sn",
  };
}

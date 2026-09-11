import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Topbar from "@/components/Topbar";
import PwaInit from "@/components/PwaInit";
import { ToastProvider } from "@/components/ui/ToastProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://businessaction.sn"),
  title: {
    default: "Business Action | Devis & Suivi Assurance Auto au Sénégal",
    template: "%s | Business Action",
  },
  description: "Plateforme de demande de devis et de suivi d'assurance auto au Sénégal. Business Action facilite vos demandes de devis, le suivi de vos dossiers et vos démarches d'assurance automobile.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "fr_SN",
    url: "https://businessaction.sn",
    siteName: "Business Action",
    title: "Business Action | Devis & Suivi Assurance Auto au Sénégal",
    description: "Plateforme de demande de devis et de suivi d'assurance auto au Sénégal. Business Action facilite vos demandes de devis, le suivi de vos dossiers et vos démarches d'assurance automobile.",
    images: [
      {
        url: "/hero-car.png",
        width: 1024,
        height: 1024,
        alt: "Business Action Assurance Auto Sénégal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Business Action | Devis & Suivi Assurance Auto au Sénégal",
    description: "Plateforme de demande de devis et de suivi d'assurance auto au Sénégal. Business Action facilite vos demandes de devis, le suivi de vos dossiers et vos démarches d'assurance automobile.",
    images: ["/hero-car.png"],
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0ea5e9",
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", margin: 0 }}>
        <ToastProvider>
          <Topbar />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            {children}
          </div>
          <PwaInit />
        </ToastProvider>
      </body>
    </html>
  );
}

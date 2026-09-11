import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Demande de Devis Assurance Auto en Ligne",
  description: "Faites votre demande de devis assurance auto au Sénégal en ligne. Scannez ou téléchargez votre carte grise ou CMC et recevez votre offre rapidement.",
  alternates: {
    canonical: "/demande-devis",
  },
  openGraph: {
    title: "Demande de Devis Assurance Auto | Business Action",
    description: "Demandez votre devis assurance auto en ligne au Sénégal en transmettant votre carte grise ou CMC.",
    url: "https://businessaction.sn/demande-devis",
  },
};

export default function DemandeDevisLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

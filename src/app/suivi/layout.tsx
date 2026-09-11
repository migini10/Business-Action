import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Suivi de Dossier Assurance Auto",
  description: "Suivez l'état d'avancement de votre dossier d'assurance automobile, vos devis et vos documents avec Business Action.",
  alternates: {
    canonical: "/suivi",
  },
  openGraph: {
    title: "Suivi de Dossier Assurance Auto | Business Action",
    description: "Consultez l'avancement de votre demande de devis et vos documents d'assurance en ligne.",
    url: "https://businessaction.sn/suivi",
  },
};

export default function SuiviLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

import type { Metadata } from "next";
import { siteContent } from '@/lib/content';

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation",
  description: "Consultez les conditions générales d'utilisation des services Business Action pour les devis et la gestion d'assurance.",
  alternates: {
    canonical: "/conditions-utilisation",
  },
};

export default function ConditionsUtilisationPage() {
  const { company, terms } = siteContent;

  return (
    <main style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', lineHeight: '1.6' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '20px' }}>Conditions Générales d'Utilisation</h1>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>1. Objet du service</h2>
        <p>
          L&apos;application {company.commercialName} est une plateforme destinée à faciliter la gestion et le suivi des demandes de devis d&apos;assurance. {company.commercialName}, exploité par <strong>{company.legalName}</strong>, agit exclusivement en qualité d&apos;{terms.role.toLowerCase()}.
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>2. Limites de responsabilité</h2>
        <p>
          <strong>{terms.notAnInsurer}.</strong><br />
          {terms.pricingAuthority}.
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>3. Engagements de l'utilisateur</h2>
        <p>
          Votre compte utilisateur est strictement personnel. En utilisant notre service, vous vous engagez à {terms.userObligations.toLowerCase()}.
        </p>
      </section>
    </main>
  );
}

import type { Metadata } from "next";
import { siteContent } from '@/lib/content';

export const metadata: Metadata = {
  title: "Mentions Légales",
  description: "Consultez les mentions légales officielles du site Business Action.",
  alternates: {
    canonical: "/mentions-legales",
  },
};

export default function MentionsLegalesPage() {
  const { company } = siteContent;

  return (
    <main style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', lineHeight: '1.6' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '20px' }}>Mentions Légales</h1>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>1. Éditeur du site</h2>
        <p>
          Le site <strong>{company.commercialName}</strong> ({company.publicUrl}) est édité par :
        </p>
        <ul style={{ marginLeft: '20px', marginTop: '10px', marginBottom: '10px' }}>
          <li><strong>Nom légal :</strong> {company.publicationDirector}</li>
          <li><strong>Nom commercial :</strong> {company.commercialName}</li>
          <li><strong>Forme juridique :</strong> {company.legalForm}</li>
          <li><strong>NINEA :</strong> {company.ninea}</li>
          <li><strong>RCCM :</strong> {company.rccm}</li>
          <li><strong>Adresse :</strong> {company.address}</li>
          <li><strong>Téléphone :</strong> {company.phone}</li>
          <li><strong>Email :</strong> <a href={`mailto:${company.privacyEmail}`} style={{ color: '#0070f3' }}>{company.privacyEmail}</a></li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>2. Directeur de la publication</h2>
        <p>
          <strong>{company.publicationDirector}</strong>
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>3. Hébergement technique</h2>
        <p>
          L&apos;hébergement technique du site est assuré par :
        </p>
        <ul style={{ marginLeft: '20px', marginTop: '10px', marginBottom: '10px' }}>
          {company.hostingProviders.map((provider) => (
            <li key={provider}><strong>{provider}</strong></li>
          ))}
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>4. Contact</h2>
        <p>
          Pour toute demande concernant le site, vous pouvez nous contacter par email à <a href={`mailto:${company.privacyEmail}`} style={{ color: '#0070f3' }}>{company.privacyEmail}</a> ou par téléphone au <strong>{company.phone}</strong>.
        </p>
      </section>
    </main>
  );
}

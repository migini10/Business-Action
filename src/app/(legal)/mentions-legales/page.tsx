import type { Metadata } from "next";
import { companyConfig } from '@/lib/company-config';

export const metadata: Metadata = {
  title: "Mentions Légales",
  description: "Consultez les mentions légales officielles du site Business Action.",
  alternates: {
    canonical: "/mentions-legales",
  },
};

export default function MentionsLegalesPage() {
  return (
    <main style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', lineHeight: '1.6' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '20px' }}>Mentions Légales</h1>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>1. Éditeur du site</h2>
        <p>
          Le site <strong>{companyConfig.commercialName}</strong> ({companyConfig.publicUrl}) est édité par :
        </p>
        <ul style={{ marginLeft: '20px', marginTop: '10px', marginBottom: '10px' }}>
          <li><strong>Nom légal :</strong> NIANE ABDOU BAKHE</li>
          <li><strong>Nom commercial :</strong> {companyConfig.commercialName}</li>
          <li><strong>Forme juridique :</strong> Entrepreneur individuel</li>
          <li><strong>NINEA :</strong> 004931566</li>
          <li><strong>RCCM :</strong> SN.DKR.2013.A.18600</li>
          <li><strong>Adresse :</strong> {companyConfig.address}</li>
          <li><strong>Téléphone :</strong> {companyConfig.phone}</li>
          <li><strong>Email :</strong> <a href={`mailto:${companyConfig.privacyEmail}`} style={{ color: '#0070f3' }}>{companyConfig.privacyEmail}</a></li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>2. Directeur de la publication</h2>
        <p>
          <strong>NIANE ABDOU BAKHE</strong>
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>3. Hébergement technique</h2>
        <p>
          L&apos;hébergement technique du site est assuré par :
        </p>
        <ul style={{ marginLeft: '20px', marginTop: '10px', marginBottom: '10px' }}>
          <li><strong>Vercel</strong></li>
          <li><strong>DigitalOcean</strong></li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>4. Contact</h2>
        <p>
          Pour toute demande concernant le site, vous pouvez nous contacter par email à <a href={`mailto:${companyConfig.privacyEmail}`} style={{ color: '#0070f3' }}>{companyConfig.privacyEmail}</a> ou par téléphone au <strong>{companyConfig.phone}</strong>.
        </p>
      </section>
    </main>
  );
}

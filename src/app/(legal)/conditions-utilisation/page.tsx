import { companyConfig } from '@/lib/company-config';

export default function ConditionsUtilisationPage() {
  return (
    <main style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', lineHeight: '1.6' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '20px' }}>Conditions Générales d'Utilisation</h1>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>1. Objet du service</h2>
        <p>
          L'application {companyConfig.commercialName} est une plateforme destinée à faciliter la gestion et le suivi des demandes de devis d'assurance. {companyConfig.commercialName}, exploité par <strong>{companyConfig.legalName}</strong>, agit exclusivement en qualité d'intermédiaire et d'apporteur d'affaires.
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>2. Limites de responsabilité</h2>
        <p>
          <strong>{companyConfig.commercialName} n'est pas un assureur et n'émet pas directement les contrats d'assurance.</strong><br />
          Les tarifs proposés, les garanties offertes, ainsi que les décisions d'acceptation ou de refus d'un dossier relèvent de la seule et unique compétence du partenaire assureur concerné.
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>3. Engagements de l'utilisateur</h2>
        <p>
          Votre compte utilisateur est strictement personnel. En utilisant notre service, vous vous engagez à fournir des informations exactes et des documents authentiques et lisibles. Toute fausse déclaration ou transmission de documents falsifiés pourra entraîner la suspension de votre compte et l'annulation de vos démarches.
        </p>
      </section>
    </main>
  );
}

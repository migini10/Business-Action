import { companyConfig } from '@/lib/company-config';

export default function SuppressionDonneesPage() {
  return (
    <main style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', lineHeight: '1.6' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '20px' }}>Procédure de suppression de vos données</h1>

      <p style={{ marginBottom: '20px' }}>
        {companyConfig.commercialName} vous permet de demander la suppression de vos données personnelles. Cette procédure s'effectue manuellement pour des raisons de sécurité et de conformité légale. Il n'existe pas de bouton de suppression automatique instantanée.
      </p>

      <p style={{ marginBottom: '20px' }}>Pour procéder à la suppression, voici les étapes :</p>

      <ol style={{ marginLeft: '20px', marginBottom: '30px' }}>
        <li style={{ marginBottom: '10px' }}>
          <strong>Faire la demande :</strong> Envoyez un email depuis votre adresse de contact à <a href={`mailto:${companyConfig.privacyEmail}`} style={{ color: '#0070f3' }}>{companyConfig.privacyEmail}</a> en précisant le numéro de téléphone associé à votre compte.
        </li>
        <li style={{ marginBottom: '10px' }}>
          <strong>Vérification d'identité :</strong> À réception de votre demande, nous procéderons à une vérification de votre identité pour nous assurer que vous êtes bien le titulaire légitime du compte.
        </li>
        <li style={{ marginBottom: '10px' }}>
          <strong>Analyse et traitement :</strong> Nous analyserons les données pouvant être supprimées ou anonymisées de manière irréversible dans nos systèmes primaires. Notez que l'effacement dans les sauvegardes (backups) peut nécessiter un délai technique.
        </li>
        <li style={{ marginBottom: '10px' }}>
          <strong>Archivage légal :</strong> Nous ne conserverons que les informations qui doivent légalement rester archivées (telles que l'historique de vos transactions financières pour des raisons comptables ou fiscales).
        </li>
        <li style={{ marginBottom: '10px' }}>
          <strong>Confirmation :</strong> Un message de confirmation vous sera envoyé dès que le traitement de votre demande sera achevé.
        </li>
      </ol>
    </main>
  );
}

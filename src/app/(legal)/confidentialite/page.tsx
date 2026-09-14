import type { Metadata } from "next";
import { siteContent } from '@/lib/content';

export const metadata: Metadata = {
  title: "Politique de Confidentialité",
  description: "Consultez la politique de confidentialité et de traitement des données personnelles de Business Action.",
  alternates: {
    canonical: "/confidentialite",
  },
};

export default function ConfidentialitePage() {
  const { company, terms, privacy } = siteContent;

  return (
    <main style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 20px', lineHeight: '1.6' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '20px' }}>Politique de Confidentialité</h1>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>1. Identité du responsable et rôle</h2>
        <p>
          Le service {company.commercialName} est un nom commercial exploité par <strong>{company.legalName}</strong>.
          {company.commercialName} agit exclusivement en tant qu&apos;{terms.role.toLowerCase()} afin de faciliter les demandes de devis, le suivi des dossiers et les échanges avec nos partenaires assureurs. <strong>{terms.notAnInsurer}.</strong>
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>2. Données collectées</h2>
        <p>Dans le cadre de l'utilisation de nos services, nous collectons les informations suivantes :</p>
        <ul style={{ marginLeft: '20px', marginBottom: '10px' }}>
          <li><strong>Coordonnées :</strong> Numéro de téléphone (obligatoire pour le compte) et adresse email (lorsqu'elle est fournie par l'utilisateur).</li>
          <li><strong>Identité :</strong> Nom et prénom.</li>
          <li><strong>Informations métier :</strong> Informations relatives aux véhicules, copies et scans des cartes grises, ainsi que tout autre document transmis pour les demandes de devis.</li>
          <li><strong>Dossiers :</strong> Contenu des dossiers et devis générés.</li>
          <li><strong>Données financières :</strong> Transactions, créances, dettes et échéances.</li>
          <li><strong>Sécurité :</strong> Mots de passe de connexion (stockés uniquement sous forme hachée, de manière illisible).</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>3. Finalités du traitement</h2>
        <p>Vos données sont traitées pour les finalités suivantes :</p>
        <ul style={{ marginLeft: '20px', marginBottom: '10px' }}>
          <li>La création et la gestion de votre compte client.</li>
          <li>Le traitement et le suivi administratif de vos demandes de devis.</li>
          <li>La transmission des informations strictement nécessaires aux partenaires assureurs concernés.</li>
          <li>Le suivi des transactions et de vos échéances de paiement.</li>
          <li>Les communications liées au bon fonctionnement du service.</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>4. Destinataires et sous-traitants</h2>
        <p>Vos données ne sont accessibles qu'aux personnes et entités suivantes :</p>
        <ul style={{ marginLeft: '20px', marginBottom: '10px' }}>
          <li>Le personnel autorisé de {company.commercialName}.</li>
          <li>Les partenaires assureurs concernés par vos demandes de devis spécifiques.</li>
          <li>Nos prestataires techniques, strictement nécessaires au fonctionnement de l'application : <strong>Supabase</strong> (PostgreSQL) et <strong>Supabase Storage</strong> pour l'hébergement sécurisé de la base de données et des fichiers, <strong>Vercel</strong> pour l'hébergement web, <strong>Resend</strong> pour l'envoi d'emails, et l'API <strong>Meta WhatsApp Cloud API</strong> (le service est intégré techniquement, mais nous ne stockons pas l'historique de vos conversations WhatsApp).</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>5. Transferts internationaux</h2>
        <p>
          Certains prestataires techniques peuvent héberger ou traiter des données en dehors du Sénégal. {company.commercialName} informe les utilisateurs de ces transferts et met en œuvre les mesures requises par la réglementation applicable.
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>6. Sécurité</h2>
        <p>
          {company.commercialName} met en œuvre des mesures techniques et organisationnelles destinées à protéger les données personnelles contre les accès non autorisés, pertes, altérations ou divulgations.
        </p>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>7. Durée de conservation</h2>
        <ul style={{ marginLeft: '20px', marginBottom: '10px' }}>
          <li><strong>Documents liés aux devis (ex: cartes grises) :</strong> {privacy.retention.quoteDocuments}.</li>
          <li><strong>Compte client :</strong> {privacy.retention.clientAccount}.</li>
          <li><strong>Transactions et données financières :</strong> {privacy.retention.financialTransactions}.</li>
        </ul>
      </section>

      <section style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>8. Droits des utilisateurs</h2>
        <p>
          Vous disposez d&apos;un droit à l&apos;information, d&apos;accès, de rectification, d&apos;opposition (lorsque applicable), et de suppression de vos données (lorsque la conservation n&apos;est plus juridiquement nécessaire).<br />
          Pour exercer ces droits, vous pouvez nous contacter :
        </p>
        <ul style={{ marginLeft: '20px', marginBottom: '10px' }}>
          <li><strong>Email :</strong> <a href={`mailto:${company.privacyEmail}`} style={{ color: '#0070f3' }}>{company.privacyEmail}</a></li>
          <li><strong>Adresse :</strong> {company.address}</li>
          <li><strong>Téléphone :</strong> {company.phone}</li>
        </ul>
      </section>
    </main>
  );
}

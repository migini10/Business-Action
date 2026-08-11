import Link from 'next/link';
import { companyConfig } from '@/lib/company-config';

export default function Footer() {
  return (
    <footer style={{ marginTop: 'auto', padding: '20px', borderTop: '1px solid #eaeaea', textAlign: 'center', fontSize: '14px', color: '#666' }}>
      <div style={{ marginBottom: '10px' }}>
        &copy; {new Date().getFullYear()} {companyConfig.commercialName}. Tous droits réservés.
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
        <Link href="/confidentialite" style={{ color: '#0070f3', textDecoration: 'none' }}>Politique de Confidentialité</Link>
        <Link href="/conditions-utilisation" style={{ color: '#0070f3', textDecoration: 'none' }}>Conditions d&apos;utilisation</Link>
        <Link href="/suppression-donnees" style={{ color: '#0070f3', textDecoration: 'none' }}>Suppression des données</Link>
      </div>
    </footer>
  );
}

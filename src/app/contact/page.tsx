import type { Metadata } from 'next';
import React from 'react';
import { companyConfig } from '@/lib/company-config';
import ContactClient from './ContactClient';

export const metadata: Metadata = {
  title: 'Contact & Service Client',
  description: "Contactez le service client officiel de Business Action au Sénégal. Assistance en ligne multilingue, WhatsApp officiel, téléphone, email et informations pratiques.",
  alternates: {
    canonical: '/contact',
  },
};

export default function ContactPage() {
  return (
    <main style={{ minHeight: '80vh' }}>
      <ContactClient companyConfig={companyConfig} />
    </main>
  );
}

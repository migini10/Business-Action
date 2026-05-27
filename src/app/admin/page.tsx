import React from 'react';
import { getDossiers } from '@/app/actions/admin';
import AdminDashboard from './AdminDashboard';

export const metadata = {
  title: 'Espace Admin | Business Action',
  description: 'Gérer les demandes de devis et dossiers',
};

export default async function AdminPage() {
  const result = await getDossiers();
  
  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
      <AdminDashboard initialDossiers={result.dossiers || []} />
    </main>
  );
}

export const dynamic = 'force-dynamic';

import React from 'react';
import { getDossiers, getClients } from '@/app/actions/admin';
import AdminDashboard from './AdminDashboard';

export const metadata = {
  title: 'Espace Admin | Business Action',
  description: 'Gérer les demandes de devis et dossiers',
};

export default async function AdminPage() {
  const [dossiersResult, clientsResult] = await Promise.all([
    getDossiers(),
    getClients()
  ]);
  
  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
      <AdminDashboard 
        initialDossiers={dossiersResult.dossiers || []} 
        initialClients={clientsResult.clients || []} 
      />
    </main>
  );
}

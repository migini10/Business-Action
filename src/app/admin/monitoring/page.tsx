export const dynamic = 'force-dynamic';

import React from 'react';
import { requireAdmin } from '@/lib/admin-auth';
import { redirect } from 'next/navigation';
import AdminMonitoringClient from './AdminMonitoringClient';

export const metadata = {
  title: 'Monitoring Système | Business Action Admin',
  description: 'Supervision en temps réel du serveur et des conteneurs',
};

export default async function AdminMonitoringPage() {
  try {
    await requireAdmin();
  } catch {
    redirect('/admin/login');
  }

  return <AdminMonitoringClient />;
}

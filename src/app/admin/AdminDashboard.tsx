'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Echeance, StatutDossier, StatutPaiement, TypeVehicule } from '@prisma/client';
import PushSettings from '@/components/PushSettings';
import { updateDossierStatus, uploadAndSendDevis, addTransaction, getClientTransactions, updateTransaction } from '@/app/actions/admin';
import { calculateClientBalance, getTransactionSign } from '@/lib/finance';
import { registerClient } from '@/app/actions/auth';
import { logoutAdmin } from '@/app/actions/admin-auth-actions';
import { getWhatsAppConversations, getWhatsAppMessages, sendWhatsAppMessage, resumeBot, markConversationAsRead, claimConversation, resolveConversation, reopenConversation } from '@/app/actions/whatsapp';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getSidebarClasses, getWhatsappGridClasses, shouldAutoScroll } from '@/lib/mobile-ui';
import { getMessageDayKey, formatMessageDate, formatMessageTime } from '@/lib/date-utils';
import { InboxFilter, filterWhatsAppConversations, sortWhatsAppConversations, getActionCount, getAdvisorActions } from '@/lib/whatsapp-inbox';
import AdminEnhanceModal from './AdminEnhanceModal';
import DocumentViewerModal from '@/components/ui/DocumentViewerModal';
import { useToast } from '@/components/ui/ToastProvider';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PhoneInput } from '@/components/ui/PhoneInput';

export default function AdminDashboard({ initialDossiers, initialClients }: { initialDossiers: any[], initialClients: any[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pendingStatusChange, setPendingStatusChange] = useState<{ dossierId: string, oldStatut: string, newStatut: string } | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      const res = await logoutAdmin();
      if (res?.success) {
        router.replace('/admin/login');
        router.refresh();
      } else {
        toast({ type: 'error', message: 'Erreur lors de la déconnexion' });
        setIsLoggingOut(false);
      }
    } catch (e) {
      console.error(e);
      toast({ type: 'error', message: 'Erreur lors de la déconnexion' });
      setIsLoggingOut(false);
    }
  };

  const [dossiers, setDossiers] = useState(initialDossiers);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedDossier, setSelectedDossier] = useState<any | null>(null);
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionDesc, setTransactionDesc] = useState('');
  const [transactionCommentaire, setTransactionCommentaire] = useState('');
  const [transactionType, setTransactionType] = useState('paiement');
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [clientTransactions, setClientTransactions] = useState<any[]>([]);
  const [documentVersion, setDocumentVersion] = useState<'enhanced' | 'original'>('enhanced');
  const [enhancingDoc, setEnhancingDoc] = useState<any | null>(null);
  const [viewerDoc, setViewerDoc] = useState<{ url: string, title: string, mimeType?: string } | null>(null);

  const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | 'month' | 'year' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const [clients, setClients] = useState(initialClients);
  const [showAddClientForm, setShowAddClientForm] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', phone: '', email: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // WhatsApp State
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [waConversations, setWaConversations] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selectedWaConv, setSelectedWaConv] = useState<any | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [waMessages, setWaMessages] = useState<any[]>([]);
  const [waReplyText, setWaReplyText] = useState('');
  const [isSendingWa, setIsSendingWa] = useState(false);
  const [waError, setWaError] = useState('');
  const [waFilter, setWaFilter] = useState<InboxFilter>('ALL');

  // Search & Notifications State
  const [searchQuery, setSearchQuery] = useState('');
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const renderSearch = () => (
    <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
      <input type="text" value={searchQuery} onChange={handleSearchChange} placeholder="Rechercher un dossier..." style={{ width: '100%', padding: '0.6rem 1rem 0.6rem 2.5rem', borderRadius: '999px', border: '1px solid #E2E8F0', outline: 'none', fontSize: '0.875rem', backgroundColor: '#F8FAFC' }} />
    </div>
  );

  const waActionCount = getActionCount(waConversations);

  const renderNotifications = (isMobile: boolean = false) => (
    <button onClick={() => { setActiveTab('whatsapp'); setSelectedWaConv(null); initialScrolledConversationIdRef.current = null; setWaFilter('ACTION_REQUIRED'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', color: '#64748B', display: 'flex', alignItems: 'center', gap: isMobile ? '0.75rem' : '0', padding: 0 }}>
      <div style={{ position: 'relative' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
        {waActionCount > 0 && (
          <span style={{ position: 'absolute', top: '-6px', right: '-6px', minWidth: '18px', height: '18px', backgroundColor: '#EF4444', color: 'white', borderRadius: '9px', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', border: '2px solid #fff' }}>
            {waActionCount}
          </span>
        )}
      </div>
      {isMobile && <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Notifications {waActionCount > 0 ? `(${waActionCount})` : ''}</span>}
    </button>
  );

  // Mobile UI States
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const waScrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [conversationOpenSequence, setConversationOpenSequence] = useState(0);

  useEffect(() => {
    if (isMobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileDrawerOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileDrawerOpen) {
        setIsMobileDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isMobileDrawerOpen]);



  useEffect(() => {
    if (activeTab === 'whatsapp' && typeof window !== 'undefined' && window.innerWidth <= 1024) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.body.style.overscrollBehavior = 'none';
      document.documentElement.style.overscrollBehavior = 'none';
      document.body.style.height = '100dvh';
      document.body.style.maxHeight = '100dvh';
      document.documentElement.style.height = '100dvh';
      document.documentElement.style.maxHeight = '100dvh';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.overscrollBehavior = '';
      document.documentElement.style.overscrollBehavior = '';
      document.body.style.height = '';
      document.body.style.maxHeight = '';
      document.documentElement.style.height = '';
      document.documentElement.style.maxHeight = '';
    }

    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.overscrollBehavior = '';
      document.documentElement.style.overscrollBehavior = '';
      document.body.style.height = '';
      document.body.style.maxHeight = '';
      document.documentElement.style.height = '';
      document.documentElement.style.maxHeight = '';
    };
  }, [activeTab]);

  // First open auto-scroll
  const initialScrolledConversationIdRef = React.useRef<string | null>(null);
  const isNearBottomRef = React.useRef<boolean>(true);
  const waTextareaRef = React.useRef<HTMLTextAreaElement>(null);

  const lastMessageId = waMessages.length > 0 ? waMessages[waMessages.length - 1].id : null;

  const prevSequenceRef = React.useRef(0);

  React.useLayoutEffect(() => {
    if (selectedWaConv && waMessages.length > 0) {
      const isNewOpen = prevSequenceRef.current !== conversationOpenSequence;
      if (isNewOpen || isNearBottomRef.current) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (waScrollContainerRef.current) {
              waScrollContainerRef.current.scrollTop = waScrollContainerRef.current.scrollHeight;
              if (isNewOpen) {
                prevSequenceRef.current = conversationOpenSequence;
                initialScrolledConversationIdRef.current = selectedWaConv.id;
                isNearBottomRef.current = true;
              }
            }
          });
        });
      }
    }
  }, [selectedWaConv?.id, conversationOpenSequence, lastMessageId]);

  const handleWaScroll = () => {
    if (waScrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = waScrollContainerRef.current;
      isNearBottomRef.current = shouldAutoScroll(scrollTop, scrollHeight, clientHeight);
    }
  };

  const loadConversations = async () => {
    const res = await getWhatsAppConversations();
    if (res.success && res.conversations) {
      setWaConversations(prev => {
        const sortedNew = sortWhatsAppConversations(res.conversations!);
        if (JSON.stringify(prev) === JSON.stringify(sortedNew)) return prev;
        return sortedNew;
      });
    }
  };

  const isWaPollingRef = React.useRef(false);
  const selectedWaConvIdRef = React.useRef<string | null>(null);
  const waMessagesTrackerRef = React.useRef<{ convId: string | null; ids: Set<number> }>({
    convId: null,
    ids: new Set()
  });

  useEffect(() => {
    selectedWaConvIdRef.current = selectedWaConv?.id || null;
  }, [selectedWaConv?.id]);

  useEffect(() => {
    if (activeTab === 'whatsapp') {
      loadConversations();

      const poll = async () => {
        if (document.visibilityState !== 'visible') return;
        if (isWaPollingRef.current) return;

        isWaPollingRef.current = true;
        try {
          await loadConversations();

          const currentConvId = selectedWaConvIdRef.current;
          if (currentConvId) {
            const msgRes = await getWhatsAppMessages(currentConvId);

            // Rejet des réponses obsolètes si on a changé de conversation entre temps
            if (selectedWaConvIdRef.current !== currentConvId) return;

            if (msgRes.success && msgRes.messages) {
              const newMessages = msgRes.messages || [];

              const tracker = waMessagesTrackerRef.current;

              if (tracker.convId === currentConvId) {
                // 1. Mark as read UNIQUEMENT pour les nouveaux messages INBOUND
                const newInboundMessages = newMessages.filter((m: any) =>
                  m.direction === 'INBOUND' && !tracker.ids.has(m.id)
                );

                if (newInboundMessages.length > 0) {
                  const lastNewInbound = newInboundMessages[newInboundMessages.length - 1];
                  markConversationAsRead(currentConvId, lastNewInbound.id).catch(() => {});
                }
              }

              // Baseline strictement associée à la conversation dont la réponse vient d'être validée
              waMessagesTrackerRef.current = {
                convId: currentConvId,
                ids: new Set(newMessages.map((m: any) => m.id))
              };

              // 2. Mettre à jour le state UNIQUEMENT si le contenu a changé
              setWaMessages(prev => {
                if (JSON.stringify(prev) === JSON.stringify(newMessages)) return prev;
                return newMessages;
              });
            }
          }
        } catch (err) {
          // Ignorer silencieusement pour la résilience
        } finally {
          isWaPollingRef.current = false;
        }
      };

      const intervalId = setInterval(poll, 5000);
      return () => clearInterval(intervalId);
    }
  }, [activeTab]);

  const loadMessages = async (convId: string) => {
    const res = await getWhatsAppMessages(convId);

    // Ignorer une réponse devenue obsolète après un changement de conversation
    if (selectedWaConvIdRef.current !== convId) return [];

    if (res.success) {
      const messages = res.messages || [];

      waMessagesTrackerRef.current = {
        convId,
        ids: new Set(messages.map((m: any) => m.id))
      };

      setWaMessages(messages);
      return messages;
    }

    return [];
  };

  useEffect(() => {
    if (selectedWaConv) {
      loadMessages(selectedWaConv.id).then((messages) => {
        if ((selectedWaConv.unreadCount || 0) > 0 && messages && messages.length > 0) {
          const inboundMessages = messages.filter((m: any) => m.direction === 'INBOUND');
          if (inboundMessages.length > 0) {
            const lastInbound = inboundMessages[inboundMessages.length - 1];
            markConversationAsRead(selectedWaConv.id, lastInbound.id).then((r) => {
              if (r.success) {
                // Update local state to 0 unread
                setWaConversations(prev => sortWhatsAppConversations(prev.map(c => c.id === selectedWaConv.id ? { ...c, unreadCount: 0 } : c)));
                setSelectedWaConv((prev: any) => prev ? { ...prev, unreadCount: 0 } : prev);
              }
            });
          }
        }
      });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWaMessages([]);
    }
  }, [selectedWaConv?.id]); // Note: only depend on ID to avoid infinite re-renders if object updates

  const handleSendWaReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWaConv || !waReplyText.trim()) return;
    setIsSendingWa(true);
    setWaError('');
    const res = await sendWhatsAppMessage(selectedWaConv.id, waReplyText);
    setIsSendingWa(false);
    if (res.success) {
      setWaReplyText('');
      if (waTextareaRef.current) {
        waTextareaRef.current.style.height = 'auto';
        waTextareaRef.current.style.overflowY = 'hidden';
      }
      // Reload messages
      const msgsRes = await getWhatsAppMessages(selectedWaConv.id);
      if (msgsRes.success) setWaMessages(msgsRes.messages || []);
    } else {
      setWaError(res.error || 'Erreur lors de l\'envoi');
    }
  };

  useEffect(() => {
    if (selectedClient) {
      getClientTransactions(selectedClient.id).then(res => {
        if (res.success) setClientTransactions(res.transactions || []);
      });
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setClientTransactions([]);
    }
  }, [selectedClient]);

  useEffect(() => {
    const savedTab = localStorage.getItem('adminActiveTab');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (savedTab) setActiveTab(savedTab);
  }, []);

  useEffect(() => {
    localStorage.setItem('adminActiveTab', activeTab);
  }, [activeTab]);

  const filteredClientTransactions = useMemo(() => {
    return clientTransactions.filter(item => {
      if (filterPeriod === 'all') return true;
      const date = new Date(item.date);
      const today = new Date();
      if (filterPeriod === 'today') {
        return date.toDateString() === today.toDateString();
      }
      if (filterPeriod === 'month') {
        return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
      }
      if (filterPeriod === 'year') {
        return date.getFullYear() === today.getFullYear();
      }
      if (filterPeriod === 'custom') {
        if (!customStartDate && !customEndDate) return true;
        const itemTime = date.getTime();
        if (customStartDate && customEndDate) {
          return itemTime >= new Date(customStartDate).getTime() && itemTime <= new Date(customEndDate).setHours(23,59,59,999);
        }
        if (customStartDate) {
          return itemTime >= new Date(customStartDate).getTime();
        }
        if (customEndDate) {
          return itemTime <= new Date(customEndDate).setHours(23,59,59,999);
        }
      }
      return true;
    });
  }, [clientTransactions, filterPeriod, customStartDate, customEndDate]);

  const [devisFile, setDevisFile] = useState<File | null>(null);
  const [isUploadingDevis, setIsUploadingDevis] = useState(false);

  const handleDevisSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!devisFile || !selectedDossier) return;

    setIsUploadingDevis(true);
    const formData = new FormData();
    formData.append('dossierId', selectedDossier.id);
    formData.append('devis', devisFile);

    const result = await uploadAndSendDevis(formData);
    setIsUploadingDevis(false);

    if (result.success) {
      toast({ type: 'success', message: result.message || 'Succès' });
      setDevisFile(null);
      // Update local state to reflect the new status
      setDossiers(dossiers.map(d => d.id === selectedDossier.id ? { ...d, statut: 'OFFRE_ENVOYEE', devisUrl: result.devisUrl } : d));
      setSelectedDossier({ ...selectedDossier, statut: 'OFFRE_ENVOYEE', devisUrl: result.devisUrl });
    } else {
      toast({ type: 'error', message: result.error || "Erreur lors de l'upload du devis." });
    }
  };

  const handleStatusChange = (id: string, newStatut: string) => {
    const oldStatut = dossiers.find(d => d.id === id)?.statut || '';
    setPendingStatusChange({ dossierId: id, oldStatut, newStatut });
  };

  const confirmStatusChange = async () => {
    if (!pendingStatusChange) return;
    const { dossierId, newStatut } = pendingStatusChange;

    setIsUpdating(dossierId);
    const result = await updateDossierStatus(dossierId, newStatut);

    if (result.success) {
      setDossiers(dossiers.map(d => d.id === dossierId ? { ...d, statut: newStatut } : d));
      if (selectedDossier?.id === dossierId) {
        setSelectedDossier({ ...selectedDossier, statut: newStatut });
      }
      toast({ type: 'success', message: 'Statut mis à jour' });
    } else {
      toast({ type: 'error', message: "Erreur lors de la mise à jour" });
    }

    setIsUpdating(null);
    setPendingStatusChange(null);
  };

  const cancelStatusChange = () => {
    setPendingStatusChange(null);
  };

  const getStatusColor = (statut: string) => {
    switch(statut) {
      case 'EN_ATTENTE': return { bg: '#FEF3C7', color: '#D97706', label: 'En Attente' };
      case 'EN_TRAITEMENT': return { bg: '#DBEAFE', color: '#2563EB', label: 'En Traitement' };
      case 'OFFRE_ENVOYEE': return { bg: '#E0E7FF', color: '#4F46E5', label: 'Offre Envoyée' };
      case 'VALIDE': return { bg: '#D1FAE5', color: '#059669', label: 'Validé' };
      case 'REJETE': return { bg: '#FEE2E2', color: '#DC2626', label: 'Rejeté' };
      default: return { bg: '#F3F4F6', color: '#4B5563', label: statut };
    }
  }

  // Stats calculation
  const totalDossiers = dossiers.length;
  const pendingDossiers = dossiers.filter(d => d.statut === 'EN_ATTENTE').length;
  const validatedDossiers = dossiers.filter(d => d.statut === 'VALIDE').length;
  const rejectedDossiers = dossiers.filter(d => d.statut === 'REJETE').length;

  return (
    <div className="admin-container" style={{ display: 'flex', minHeight: 'var(--app-height, 100dvh)', ...(activeTab === 'whatsapp' ? { height: 'var(--app-height, 100dvh)', overflow: 'hidden' } : { overflowX: 'hidden' }), backgroundColor: 'var(--color-gray-light)' }}>
      {/* Sidebar */}
      {/* Mobile Backdrop */}
      <div
        className={`admin-backdrop ${isMobileDrawerOpen ? 'open' : ''}`}
        onClick={() => setIsMobileDrawerOpen(false)}
      />
      <aside
        id="admin-mobile-drawer"
        className={getSidebarClasses(isMobileDrawerOpen)}
        style={{
        backgroundColor: '#ffffff',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div className="drawer-header" style={{ padding: '2rem 1.5rem', borderBottom: '1px solid #E2E8F0', flexShrink: 0 }}>
          <Link href="/admin" onClick={() => setIsMobileDrawerOpen(false)} style={{ textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Image
                src="/Logo Business Action.png"
                alt="Business Action"
                width={180}
                height={50}
                style={{ width: 'auto', height: '40px', maxWidth: '100%' }}
                priority
              />
            </div>
          </Link>
          <button
            className="mobile-only"
            onClick={() => setIsMobileDrawerOpen(false)}
            aria-label="Fermer le menu"
            style={{ background: 'none', border: 'none', padding: '0.5rem', marginLeft: 'auto', cursor: 'pointer', color: '#64748B' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className="drawer-scroll-content" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
          <nav style={{ flex: 1, padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <button onClick={() => { setActiveTab('dashboard'); setIsMobileDrawerOpen(false); }} style={{ ...navItemStyle, ...(activeTab === 'dashboard' ? activeNavItemStyle : {}) }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
            Tableau de bord
          </button>
          <button onClick={() => { setActiveTab('demandes'); setIsMobileDrawerOpen(false); }} style={{ ...navItemStyle, ...(activeTab === 'demandes' ? activeNavItemStyle : {}) }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Demandes
          </button>
          <button onClick={() => { setActiveTab('utilisateurs'); setIsMobileDrawerOpen(false); }} style={{ ...navItemStyle, ...(activeTab === 'utilisateurs' ? activeNavItemStyle : {}) }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            Utilisateurs
          </button>
          <button onClick={() => { setActiveTab('parametres'); setIsMobileDrawerOpen(false); }} style={{ ...navItemStyle, ...(activeTab === 'parametres' ? activeNavItemStyle : {}) }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            Paramètres
          </button>
          <button onClick={() => { setActiveTab('whatsapp'); setSelectedWaConv(null); initialScrolledConversationIdRef.current = null; setIsMobileDrawerOpen(false); }} style={{ ...navItemStyle, ...(activeTab === 'whatsapp' ? activeNavItemStyle : {}) }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
            WhatsApp
          </button>
        </nav>

        <div className="mobile-only" style={{ padding: '1.5rem', borderTop: '1px solid #E2E8F0', flexDirection: 'column', gap: '1rem' }}>
          {renderSearch()}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: '0.5rem' }}>
            {renderNotifications(true)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', fontWeight: 'bold' }}>
              A
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#0F172A' }}>Admin</p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748B' }}>admin@business-action.com</p>
            </div>
          </div>
          <button onClick={() => { handleLogout(); setIsMobileDrawerOpen(false); }} style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#FEE2E2', color: '#DC2626', border: 'none', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            Déconnexion
          </button>
        </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main" style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', width: '100%', ...(activeTab === 'whatsapp' ? { minHeight: 0, height: 'auto', overflow: 'hidden', position: 'relative' } : {}) }}>
        {/* Topbar */}
        <header style={{ height: '70px', flexShrink: 0, backgroundColor: '#ffffff', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2rem', position: 'sticky', top: 0, zIndex: 30 }}>
          <div className="mobile-only" style={{ display: 'flex', alignItems: 'center' }}>
            <Image
              src="/Logo Business Action.png"
              alt="Business Action"
              width={180}
              height={50}
              style={{ width: 'auto', height: '40px', maxWidth: '100%' }}
              priority
            />
          </div>
          <button
              className="mobile-only"
              onClick={() => setIsMobileDrawerOpen(true)}
              aria-label="Ouvrir le menu"
              aria-expanded={isMobileDrawerOpen}
              aria-controls="admin-mobile-drawer"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', color: '#0F172A' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>
            <div className="desktop-only" style={{ width: '100%', maxWidth: '300px' }}>{renderSearch()}</div>
          <div className="desktop-only" style={{ alignItems: 'center', gap: '1.5rem' }}>
            {renderNotifications()}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderLeft: '1px solid #E2E8F0', paddingLeft: '1.5rem' }}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#0F172A' }}>Admin</p>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748B' }}>admin@business-action.com</p>
              </div>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', fontWeight: 'bold' }}>
                A
              </div>
            </div>
            <button onClick={handleLogout} title="Déconnexion" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#FEE2E2', color: '#DC2626', transition: 'all 0.2s', marginLeft: '0.5rem', cursor: 'pointer', border: 'none' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div style={{ padding: activeTab === 'whatsapp' ? 0 : '2rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', flex: 1 }}>

            {activeTab === 'dashboard' && (
              <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.5rem 0' }}>Bonjour, Admin 👋</h1>
                <p style={{ color: '#64748B', margin: 0 }}>Voici un aperçu des activités de votre plateforme.</p>
              </div>
            )}

            {/* KPI Cards */}
            {(activeTab === 'dashboard' || activeTab === 'demandes') && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
              <div style={{ ...kpiCardStyle, borderBottom: '4px solid var(--color-primary)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748B', margin: 0 }}>Total Dossiers</p>
                    <h3 style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', margin: '0.5rem 0 0 0' }}>{totalDossiers}</h3>
                  </div>
                  <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-primary-light)', borderRadius: '0.75rem', color: 'var(--color-primary)' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                  </div>
                </div>
              </div>

              <div style={{ ...kpiCardStyle, borderBottom: '4px solid #F59E0B' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748B', margin: 0 }}>En Attente</p>
                    <h3 style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', margin: '0.5rem 0 0 0' }}>{pendingDossiers}</h3>
                  </div>
                  <div style={{ padding: '0.75rem', backgroundColor: '#FEF3C7', borderRadius: '0.75rem', color: '#D97706' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  </div>
                </div>
              </div>

              <div style={{ ...kpiCardStyle, borderBottom: '4px solid #10B981' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748B', margin: 0 }}>Validés</p>
                    <h3 style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', margin: '0.5rem 0 0 0' }}>{validatedDossiers}</h3>
                  </div>
                  <div style={{ padding: '0.75rem', backgroundColor: '#D1FAE5', borderRadius: '0.75rem', color: '#059669' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                  </div>
                </div>
              </div>

              <div style={{ ...kpiCardStyle, borderBottom: '4px solid #EF4444' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748B', margin: 0 }}>Rejetés</p>
                    <h3 style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', margin: '0.5rem 0 0 0' }}>{rejectedDossiers}</h3>
                  </div>
                  <div style={{ padding: '0.75rem', backgroundColor: '#FEE2E2', borderRadius: '0.75rem', color: '#DC2626' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Dossiers Table Section */}
            <div style={{ backgroundColor: '#fff', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>Dossiers Récents</h3>
                <button style={{ padding: '0.5rem 1rem', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
                  Filtrer
                </button>
              </div>
              <div style={{ width: '100%' }}>
                {/* Desktop View */}
                <div className="desktop-only" style={{ overflowX: 'auto', width: '100%' }}>
                  <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                      <tr>
                        <th style={thStyle}>Client & Dossier</th>
                        <th style={thStyle}>Véhicule & Docs</th>
                        <th style={thStyle}>Date</th>
                        <th style={thStyle}>Statut</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dossiers.map((dossier) => {
                        const statusInfo = getStatusColor(dossier.statut);
                        return (
                          <tr key={dossier.id} style={{ borderBottom: '1px solid #E2E8F0', transition: 'background-color 0.2s' }} className="hover:bg-gray-50">
                            <td style={tdStyle}>
                              <p style={{ fontWeight: 700, color: '#0F172A', margin: '0 0 0.25rem 0' }}>{dossier.numeroDossier}</p>
                              <p style={{ fontSize: '0.875rem', color: '#64748B', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                {dossier.phone}
                              </p>
                              {dossier.email && (
                                 <p style={{ fontSize: '0.875rem', color: '#64748B', margin: '0.25rem 0 0 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                   {dossier.email}
                                 </p>
                              )}
                            </td>
                            <td style={tdStyle}>
                              <span style={{ fontSize: '0.875rem', color: '#334155', fontWeight: 600, textTransform: 'capitalize', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', backgroundColor: '#F1F5F9', padding: '0.25rem 0.75rem', borderRadius: '999px' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                {dossier.typeVehicule.toLowerCase().replace('_', ' ')}
                              </span>
                              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                {dossier.documents && dossier.documents.length > 0 ? (
                                  dossier.documents.map((doc: any) => (
                                    doc.deletedAt ? (
                                      <span key={doc.id} style={{...docLinkStyle, color: '#94a3b8', textDecoration: 'line-through', cursor: 'not-allowed'}} title="Document expiré et supprimé">📄 {doc.type} ({doc.side})</span>
                                    ) : (
                                      <button type="button" key={doc.id} onClick={() => setViewerDoc({ url: `/api/documents/${doc.id}?version=${documentVersion}`, title: `${doc.type} (${doc.side})`, mimeType: doc.mimeType })} style={docLinkStyle}>📄 {doc.type} ({doc.side})</button>
                                    )
                                  ))
                                ) : (
                                  <>
                                    {dossier.rectoUrl && <button type="button" onClick={() => setViewerDoc({ url: dossier.rectoUrl, title: 'Carte Grise (Recto)' })} style={docLinkStyle}>📄 Carte Grise (Recto)</button>}
                                    {dossier.versoUrl && <button type="button" onClick={() => setViewerDoc({ url: dossier.versoUrl, title: 'Carte Grise (Verso)' })} style={docLinkStyle}>📄 Carte Grise (Verso)</button>}
                                  </>
                                )}
                              </div>
                            </td>
                            <td style={{ ...tdStyle, color: '#64748B' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                {new Date(dossier.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </div>
                            </td>
                            <td style={tdStyle}>
                              <span style={{
                                backgroundColor: statusInfo.bg,
                                color: statusInfo.color,
                                padding: '0.375rem 0.75rem',
                                borderRadius: '9999px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.375rem'
                              }}>
                                {isUpdating === dossier.id && (
                                  <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
                                )}
                                {statusInfo.label}
                              </span>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                <button
                                  onClick={() => setSelectedDossier(dossier)}
                                  style={{ padding: '0.5rem', backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: '0.5rem', color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                                  title="Voir détails"
                                >
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                </button>
                                <select
                                  value={dossier.statut}
                                  onChange={(e) => handleStatusChange(dossier.id, e.target.value)}
                                  disabled={isUpdating === dossier.id}
                                  style={{
                                    padding: '0.5rem 2rem 0.5rem 0.75rem',
                                    borderRadius: '0.5rem',
                                    border: '1px solid #CBD5E1',
                                    fontSize: '0.875rem',
                                    fontWeight: 600,
                                    outline: 'none',
                                    cursor: isUpdating === dossier.id ? 'not-allowed' : 'pointer',
                                    backgroundColor: isUpdating === dossier.id ? '#F1F5F9' : '#fff',
                                    color: '#334155',
                                    appearance: 'none',
                                    backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23475569%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'right 0.7rem top 50%',
                                    backgroundSize: '0.65rem auto',
                                  }}
                                >
                                  <option value="EN_ATTENTE">Mettre en attente</option>
                                  <option value="EN_TRAITEMENT">Traiter</option>
                                  <option value="OFFRE_ENVOYEE">Offre Envoyée</option>
                                  <option value="VALIDE">Valider</option>
                                  <option value="REJETE">Rejeter</option>
                                </select>
                              </div>
                            </td>
                          </tr>
                        )
                      })}

                      {dossiers.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ padding: '4rem', textAlign: 'center', color: '#64748B' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                              <p style={{ margin: 0, fontSize: '1.125rem', fontWeight: 500 }}>Aucun dossier trouvé.</p>
                              <p style={{ margin: 0, fontSize: '0.875rem' }}>Les nouvelles demandes apparaîtront ici.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View */}
                <div className="mobile-only" style={{ flexDirection: 'column', padding: '1rem', gap: '1rem', width: '100%' }}>
                  {dossiers.map((dossier) => {
                    const statusInfo = getStatusColor(dossier.statut);
                    return (
                      <div key={`mob-${dossier.id}`} style={{ border: '1px solid #E2E8F0', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', backgroundColor: '#fff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ wordBreak: 'break-all' }}>
                            <p style={{ fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem 0', fontSize: '1rem' }}>{dossier.numeroDossier}</p>
                            <p style={{ fontSize: '0.875rem', color: '#64748B', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              📞 {dossier.phone}
                            </p>
                            {dossier.email && (
                              <p style={{ fontSize: '0.875rem', color: '#64748B', margin: '0.25rem 0 0 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                ✉ {dossier.email}
                              </p>
                            )}
                          </div>
                          <span style={{
                            backgroundColor: statusInfo.bg,
                            color: statusInfo.color,
                            padding: '0.25rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            whiteSpace: 'nowrap'
                          }}>
                            {statusInfo.label}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0 }}>Véhicule</p>
                          <span style={{ fontSize: '0.875rem', color: '#334155', fontWeight: 600, textTransform: 'capitalize', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#F1F5F9', padding: '0.25rem 0.75rem', borderRadius: '999px', width: 'fit-content' }}>
                            {dossier.typeVehicule.toLowerCase().replace('_', ' ')}
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                           <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                             {new Date(dossier.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                           </span>
                           <button
                             onClick={() => setSelectedDossier(dossier)}
                             style={{ padding: '0.5rem 1rem', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '0.5rem', color: '#475569', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
                           >
                             Voir le dossier
                           </button>
                        </div>
                      </div>
                    );
                  })}
                  {dossiers.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748B' }}>
                       <p style={{ margin: 0, fontSize: '1rem', fontWeight: 500 }}>Aucun dossier trouvé.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
              </>
            )}

            {activeTab === 'utilisateurs' && (
              <div style={{ backgroundColor: '#fff', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', overflow: 'hidden', border: '1px solid #E2E8F0', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>Gestion des Clients</h2>
                  <button onClick={() => setShowAddClientForm(!showAddClientForm)} className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', borderRadius: '0.75rem', fontWeight: 600, border: 'none', backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {showAddClientForm ? 'Annuler' : '+ Ajouter un client'}
                  </button>
                </div>

                {showAddClientForm && (
                  <div style={{ backgroundColor: '#F8FAFC', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #E2E8F0', marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0F172A', marginBottom: '1rem' }}>Nouveau Client</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                      <input type="text" placeholder="Nom complet" value={newClient.name} onChange={(e) => setNewClient({...newClient, name: e.target.value})} style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1', outline: 'none' }} />
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <PhoneInput 
                          placeholder="Téléphone (ex: +221 77...)" 
                          defaultValue={newClient.phone} 
                          onChange={(val) => setNewClient({...newClient, phone: val})} 
                        />
                      </div>
                      <input type="email" placeholder="Email" value={newClient.email} onChange={(e) => setNewClient({...newClient, email: e.target.value})} style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1', outline: 'none' }} />
                      <button onClick={async () => {
                        if (!newClient.name || !newClient.phone) {
                          toast({ type: 'error', message: "Le nom et le téléphone sont obligatoires." });
                          return;
                        }
                        const formData = new FormData();
                        formData.append('name', newClient.name);
                        formData.append('phone', newClient.phone);
                        formData.append('password', 'Pass1234'); // Mot de passe par défaut
                        if (newClient.email) formData.append('email', newClient.email);

                        const res = await registerClient(formData);
                        if (res.success && res.user) {
                           setClients([{ id: res.user.id, name: res.user.name, phone: res.user.phone, email: newClient.email || 'Non renseigné', dossiers: 0, solde: 0 }, ...clients]);
                           setNewClient({ name: '', phone: '', email: '' });
                           setShowAddClientForm(false);
                        } else {
                           toast({ type: 'error', message: res.error || 'Erreur' });
                        }
                      }} className="btn btn-primary" style={{ border: 'none' }}>
                        Enregistrer
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ width: '100%' }}>
                  <div className="desktop-only" style={{ overflowX: 'auto', width: '100%' }}>
                    <table style={{ width: '100%', minWidth: '800px', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                        <tr>
                          <th style={thStyle}>Client</th>
                          <th style={thStyle}>Contact</th>
                          <th style={thStyle}>Dossiers Actifs</th>
                          <th style={thStyle}>Solde Global</th>
                          <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clients.map((client) => (
                          <tr key={client.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                            <td style={tdStyle}>
                              <p style={{ fontWeight: 700, color: '#0F172A', margin: '0 0 0.25rem 0' }}>{client.name}</p>
                              <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', backgroundColor: '#E2E8F0', color: '#475569', borderRadius: '4px' }}>Client Régulier</span>
                            </td>
                            <td style={tdStyle}>
                              <p style={{ fontSize: '0.875rem', color: '#334155', margin: '0 0 0.25rem 0', fontWeight: 600 }}>{client.phone}</p>
                              <p style={{ fontSize: '0.875rem', color: '#64748B', margin: 0 }}>{client.email}</p>
                            </td>
                            <td style={tdStyle}>
                              <span style={{ fontWeight: 700, color: '#0F172A', backgroundColor: '#F1F5F9', padding: '0.2rem 0.6rem', borderRadius: '1rem' }}>{client.dossiers}</span>
                            </td>
                            <td style={tdStyle}>
                              <span style={{
                                padding: '0.375rem 0.75rem',
                                borderRadius: '2rem',
                                fontSize: '0.875rem',
                                fontWeight: 700,
                                backgroundColor: client.solde === 0 ? '#F1F5F9' : (client.solde < 0 ? '#FEE2E2' : '#DCFCE7'),
                                color: client.solde === 0 ? '#475569' : (client.solde < 0 ? '#DC2626' : '#16A34A')
                              }}>
                                {client.solde === 0 ? 'À jour' : `${client.solde > 0 ? '+' : ''}${client.solde.toLocaleString('fr-FR')} FCFA`}
                              </span>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                              <button
                                onClick={() => setSelectedClient(client)}
                                style={{ padding: '0.5rem 1rem', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '0.5rem', color: '#475569', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, transition: 'all 0.2s' }}
                              >
                                Voir Détails
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mobile-only" style={{ flexDirection: 'column', gap: '1rem', width: '100%' }}>
                    {clients.map((client) => (
                      <div key={`mob-client-${client.id}`} style={{ border: '1px solid #E2E8F0', borderRadius: '0.75rem', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', backgroundColor: '#fff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ wordBreak: 'break-all' }}>
                            <p style={{ fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem 0', fontSize: '1rem' }}>{client.name}</p>
                            <p style={{ fontSize: '0.875rem', color: '#64748B', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              📞 {client.phone}
                            </p>
                            {client.email && (
                              <p style={{ fontSize: '0.875rem', color: '#64748B', margin: '0.25rem 0 0 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                ✉ {client.email}
                              </p>
                            )}
                          </div>
                          <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', backgroundColor: '#E2E8F0', color: '#475569', borderRadius: '4px', whiteSpace: 'nowrap' }}>Client Régulier</span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0 }}>Dossiers Actifs</p>
                            <span style={{ fontWeight: 700, color: '#0F172A', backgroundColor: '#F1F5F9', padding: '0.2rem 0.6rem', borderRadius: '1rem', display: 'inline-block', marginTop: '0.25rem' }}>{client.dossiers}</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontSize: '0.75rem', color: '#64748B', margin: 0 }}>Solde Global</p>
                            <span style={{
                              padding: '0.25rem 0.5rem',
                              borderRadius: '2rem',
                              fontSize: '0.875rem',
                              fontWeight: 700,
                              display: 'inline-block',
                              marginTop: '0.25rem',
                              backgroundColor: client.solde === 0 ? '#F1F5F9' : (client.solde < 0 ? '#FEE2E2' : '#DCFCE7'),
                              color: client.solde === 0 ? '#475569' : (client.solde < 0 ? '#DC2626' : '#16A34A')
                            }}>
                              {client.solde === 0 ? 'À jour' : `${client.solde > 0 ? '+' : ''}${client.solde.toLocaleString('fr-FR')} FCFA`}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', borderTop: '1px solid #E2E8F0', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                           <button
                             onClick={() => setSelectedClient(client)}
                             style={{ padding: '0.5rem 1rem', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '0.5rem', color: '#475569', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}
                           >
                             Voir Détails
                           </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Modal Détails Dossier */}
        {selectedDossier && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 100, padding: '6rem 1rem 2rem 1rem', overflowY: 'auto' }} onClick={() => setSelectedDossier(null)}>
            <div style={{ backgroundColor: '#fff', borderRadius: '1.5rem', width: '100%', maxWidth: '850px', margin: '0 auto', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', position: 'relative' }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem 0' }}>Détails du Dossier</h2>
                  <p style={{ margin: 0, color: '#64748B', fontSize: '0.875rem' }}>{selectedDossier.numeroDossier}</p>
                </div>
                <button onClick={() => setSelectedDossier(null)} style={{ background: '#F1F5F9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>

              <div style={{ padding: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>

                  {/* Informations Client */}
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                      Contact Client
                    </h3>
                    <div style={{ backgroundColor: '#F8FAFC', padding: '1.25rem', borderRadius: '1rem', border: '1px solid #E2E8F0' }}>
                      <p style={{ margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.95rem' }}>
                        <span style={{ color: '#64748B' }}>Tél :</span>
                        <strong style={{ color: '#0F172A' }}>{selectedDossier.phone}</strong>
                      </p>
                      <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.95rem' }}>
                        <span style={{ color: '#64748B' }}>Email :</span>
                        <strong style={{ color: '#0F172A', wordBreak: 'break-all' }}>{selectedDossier.email || 'Non renseigné'}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Informations Véhicule */}
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                      Véhicule
                    </h3>
                    <div style={{ backgroundColor: '#F8FAFC', padding: '1.25rem', borderRadius: '1rem', border: '1px solid #E2E8F0' }}>
                      <p style={{ margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.95rem' }}>
                        <span style={{ color: '#64748B' }}>Type :</span>
                        <span style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700 }}>
                          {selectedDossier.typeVehicule.replace('_', ' ')}
                        </span>
                      </p>
                      <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.95rem' }}>
                        <span style={{ color: '#64748B' }}>Date :</span>
                        <strong style={{ color: '#0F172A' }}>{new Date(selectedDossier.createdAt).toLocaleDateString('fr-FR')}</strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Documents */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    Documents Justificatifs
                  </h3>
                  <div style={{ display: 'flex', backgroundColor: '#F1F5F9', borderRadius: '0.5rem', padding: '0.25rem' }}>
                    <button onClick={() => setDocumentVersion('enhanced')} style={{ padding: '0.25rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer', backgroundColor: documentVersion === 'enhanced' ? '#fff' : 'transparent', color: documentVersion === 'enhanced' ? '#0F172A' : '#64748B', boxShadow: documentVersion === 'enhanced' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>Amélioré</button>
                    <button onClick={() => setDocumentVersion('original')} style={{ padding: '0.25rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 600, border: 'none', cursor: 'pointer', backgroundColor: documentVersion === 'original' ? '#fff' : 'transparent', color: documentVersion === 'original' ? '#0F172A' : '#64748B', boxShadow: documentVersion === 'original' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none' }}>Original</button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  {(() => {
                    const renderFilePreview = (url: string, label: string, docObj?: any) => {
                      if (!url) {
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', backgroundColor: '#F1F5F9', border: '2px dashed #E2E8F0', borderRadius: '1rem', color: '#94A3B8' }}>
                            Aucun {label.toLowerCase()} fourni
                          </div>
                        );
                      }
                      const isPdfDocument = docObj?.mimeType === 'application/pdf' || url.toLowerCase().includes('.pdf');
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>{label}</span>
                            {docObj && !isPdfDocument && (
                              <button onClick={() => setEnhancingDoc(docObj)} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-primary)', backgroundColor: 'var(--color-primary-light)', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                ✨ Améliorer
                              </button>
                            )}
                          </div>
                          <div style={{ position: 'relative', height: '200px', backgroundColor: '#F8FAFC', borderRadius: '1rem', overflow: 'hidden', border: '1px solid #E2E8F0', width: '100%' }}>
                            {isPdfDocument ? (
                              <object data={`${url}#toolbar=0&navpanes=0&scrollbar=0`} type="application/pdf" style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%', gap: '1rem' }}>
                                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                  <span style={{ fontWeight: 600, color: '#0F172A', textAlign: 'center' }}>Document PDF<br /><span style={{ fontSize: '0.875rem', color: '#64748B', fontWeight: 'normal' }}>Cliquer pour ouvrir</span></span>
                                </div>
                              </object>
                            ) : (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt={`Carte Grise ${label}`} style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#F1F5F9' }} />
                                <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.3)'; e.currentTarget.style.opacity = '1'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0)'; e.currentTarget.style.opacity = '0'; }}>
                                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                </div>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => setViewerDoc({ url, title: label, mimeType: docObj?.mimeType })}
                              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', zIndex: 10 }}
                              aria-label={`Ouvrir ${label}`}
                            />
                          </div>
                        </div>
                      );
                    };

                    return (
                      <>
                        {selectedDossier.documents && selectedDossier.documents.length > 0 ? (
                          selectedDossier.documents.map((doc: any) => (
                            doc.deletedAt ? (
                              <div key={doc.id} style={{ flex: 1, minWidth: '300px', backgroundColor: '#F8FAFC', borderRadius: '1rem', padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', border: '1px solid #E2E8F0', height: '100%', minHeight: '300px' }}>
                                <div style={{ width: '4rem', height: '4rem', borderRadius: '50%', backgroundColor: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                </div>
                                <p style={{ color: '#64748B', fontWeight: 600, margin: 0 }}>{doc.type} ({doc.side})</p>
                                <p style={{ color: '#94A3B8', fontSize: '0.875rem', margin: 0 }}>Document supprimé après expiration.</p>
                              </div>
                            ) : (
                              renderFilePreview(`/api/documents/${doc.id}?version=${documentVersion}`, `${doc.type} (${doc.side})`, doc)
                            )
                          ))
                        ) : (
                          <>
                            {renderFilePreview(selectedDossier.rectoUrl, 'Recto')}
                            {renderFilePreview(selectedDossier.versoUrl, 'Verso')}
                          </>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Devis Upload Section */}
                <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #E2E8F0' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2"><path d="M22 2L11 13"></path><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    Envoyer une Offre (Devis)
                  </h3>

                  {selectedDossier.devisUrl ? (
                    <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', padding: '1.5rem', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ backgroundColor: '#22C55E', color: 'white', padding: '0.5rem', borderRadius: '50%' }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                        <div>
                          <p style={{ fontWeight: 700, color: '#166534', margin: 0 }}>Devis envoyé au client</p>
                          <p style={{ fontSize: '0.875rem', color: '#15803D', margin: 0 }}>L'email a été envoyé avec succès.</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <a
                          href={`https://wa.me/${selectedDossier.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Bonjour, suite à votre demande sur Business Action, voici le lien vers votre devis personnalisé: ${selectedDossier.devisUrl === 'uploaded' ? '' : selectedDossier.devisUrl}`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-primary"
                          style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', backgroundColor: '#25D366', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                          WhatsApp
                        </a>
                        <button type="button" onClick={() => { if (selectedDossier.devisUrl !== 'uploaded') setViewerDoc({ url: selectedDossier.devisUrl, title: 'Devis' }) }} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', backgroundColor: 'white', color: '#166534', border: '1px solid #BBF7D0', cursor: selectedDossier.devisUrl === 'uploaded' ? 'not-allowed' : 'pointer' }}>
                          Voir le devis
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleDevisSubmit} style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', padding: '1.5rem', borderRadius: '1rem' }}>
                      <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1rem' }}>
                        Uploadez le PDF du devis. Le client recevra automatiquement un Email et un message WhatsApp avec le lien pour le consulter.
                      </p>

                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', border: '2px dashed #CBD5E1', borderRadius: '0.75rem', padding: '1rem', textAlign: 'center', cursor: 'pointer', backgroundColor: devisFile ? '#EFF6FF' : 'white', borderColor: devisFile ? 'var(--color-primary)' : '#CBD5E1', transition: 'all 0.2s' }}>
                            <input
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg"
                              style={{ display: 'none' }}
                              onChange={(e) => setDevisFile(e.target.files?.[0] || null)}
                              required
                            />
                            {devisFile ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                {devisFile.name}
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#64748B' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                Choisir un fichier PDF
                              </div>
                            )}
                          </label>
                        </div>
                        <button
                          type="submit"
                          disabled={!devisFile || isUploadingDevis}
                          className="btn btn-primary"
                          style={{ padding: '1rem 1.5rem', whiteSpace: 'nowrap', opacity: (!devisFile || isUploadingDevis) ? 0.6 : 1, cursor: (!devisFile || isUploadingDevis) ? 'not-allowed' : 'pointer', border: 'none', borderRadius: '0.75rem', backgroundColor: 'var(--color-primary)', color: 'white', fontWeight: 600 }}
                        >
                          {isUploadingDevis ? 'Envoi en cours...' : 'Envoyer au client'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>

              </div>
            </div>
          </div>
        )}

        {/* Modal Détails Client */}
        {selectedClient && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 100, padding: '6rem 1rem 2rem 1rem', overflowY: 'auto' }} onClick={() => { setSelectedClient(null); setShowTransactionForm(false); }}>
            <div style={{ backgroundColor: '#fff', borderRadius: '1.5rem', width: '100%', maxWidth: '850px', margin: '0 auto', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', position: 'relative' }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0F172A', margin: '0 0 0.25rem 0' }}>Détails Client</h2>
                  <p style={{ margin: 0, color: '#64748B', fontSize: '0.875rem' }}>ID Client: CL-{selectedClient.id}</p>
                </div>
                <button onClick={() => { setSelectedClient(null); setShowTransactionForm(false); }} style={{ background: '#F1F5F9', border: 'none', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>

              <div style={{ padding: '1.5rem' }}>
                <div style={{ backgroundColor: '#F8FAFC', padding: '1.5rem', borderRadius: '1rem', border: '1px solid #E2E8F0', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A', margin: '0 0 1rem 0' }}>{selectedClient.name}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.95rem' }}>
                      <span style={{ color: '#64748B', width: '80px' }}>Téléphone :</span>
                      <strong style={{ color: '#0F172A' }}>{selectedClient.phone}</strong>
                    </p>
                    <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.95rem' }}>
                      <span style={{ color: '#64748B', width: '80px' }}>Email :</span>
                      <strong style={{ color: '#0F172A' }}>{selectedClient.email}</strong>
                    </p>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                  <div style={{ backgroundColor: '#F1F5F9', padding: '1.5rem', borderRadius: '1rem' }}>
                    <p style={{ margin: '0 0 0.5rem 0', color: '#64748B', fontSize: '0.875rem', fontWeight: 600 }}>Dossiers Actifs</p>
                    <p style={{ margin: 0, fontSize: '2rem', fontWeight: 800, color: '#0F172A' }}>{selectedClient.dossiers}</p>
                  </div>
                  <div style={{ backgroundColor: selectedClient.solde < 0 ? '#FEE2E2' : (selectedClient.solde > 0 ? '#DCFCE7' : '#F1F5F9'), padding: '1.5rem', borderRadius: '1rem' }}>
                    <p style={{ margin: '0 0 0.5rem 0', color: selectedClient.solde < 0 ? '#991B1B' : (selectedClient.solde > 0 ? '#166534' : '#64748B'), fontSize: '0.875rem', fontWeight: 600 }}>Position Financière</p>
                    <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: selectedClient.solde < 0 ? '#DC2626' : (selectedClient.solde > 0 ? '#16A34A' : '#0F172A') }}>
                      {selectedClient.solde === 0 ? 'Compte équilibré' : (selectedClient.solde > 0 ? `Le client vous doit : ${selectedClient.solde.toLocaleString('fr-FR')} FCFA` : `Vous devez au client : ${Math.abs(selectedClient.solde).toLocaleString('fr-FR')} FCFA`)}
                    </p>
                  </div>
                </div>

                {showTransactionForm ? (
                  <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#F8FAFC', borderRadius: '1rem', border: '1px solid #E2E8F0' }}>
                    <h4 style={{ margin: '0 0 1rem 0', color: '#0F172A', fontSize: '1rem', fontWeight: 600 }}>Ajouter une transaction</h4>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <select
                        value={transactionType}
                        onChange={(e) => setTransactionType(e.target.value)}
                        style={{ padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1', fontSize: '1rem', backgroundColor: '#fff', flex: '1 1 150px' }}
                      >
                        <option value="paiement">Paiement</option>
                        <option value="dette">Dette</option>
                        <option value="créance">Créance</option>
                        <option value="remboursement">Remboursement</option>
                      </select>
                      <input
                        type="number"
                        placeholder="Montant (FCFA)"
                        value={transactionAmount}
                        onChange={(e) => setTransactionAmount(e.target.value)}
                        style={{ flex: '1 1 150px', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1', fontSize: '1rem' }}
                      />
                      <input
                        type="text"
                        placeholder="Description (ex: Acompte)"
                        value={transactionDesc}
                        onChange={(e) => setTransactionDesc(e.target.value)}
                        style={{ flex: '2 1 200px', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1', fontSize: '1rem' }}
                      />
                      <input
                        type="text"
                        placeholder="Commentaire (optionnel)"
                        value={transactionCommentaire}
                        onChange={(e) => setTransactionCommentaire(e.target.value)}
                        style={{ flex: '2 1 200px', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1', fontSize: '1rem' }}
                      />
                      <button
                        onClick={async () => {
                          const newAmount = parseInt(transactionAmount);
                          if (!transactionAmount || isNaN(newAmount)) return;
                          setIsSubmitting(true);

                          const finalAmount = Math.abs(newAmount);
                          let mappedType: 'PAIEMENT' | 'DETTE' | 'CREANCE' | 'REMBOURSEMENT' = 'PAIEMENT';
                          if (transactionType === 'dette') mappedType = 'DETTE';
                          if (transactionType === 'créance') mappedType = 'CREANCE';
                          if (transactionType === 'remboursement') mappedType = 'REMBOURSEMENT';

                          const desc = transactionDesc.trim() || `Nouvelle transaction (${transactionType})`;

                          const res = await addTransaction({
                            clientId: selectedClient.id,
                            amount: (transactionType === 'dette' || transactionType === 'remboursement') ? -finalAmount : finalAmount,
                            type: mappedType,
                            desc,
                            commentaire: transactionCommentaire.trim() || undefined
                          });

                          if (res.success) {
                            const updatedTransactions = [
                              {
                                id: `T${Date.now()}`,
                                date: new Date().toISOString(),
                                description: desc,
                                montant: (transactionType === 'dette' || transactionType === 'remboursement') ? -finalAmount : finalAmount,
                                type: mappedType,
                                commentaire: transactionCommentaire.trim()
                              },
                              ...clientTransactions
                            ];
                            setClientTransactions(updatedTransactions);

                            const newSolde = calculateClientBalance(updatedTransactions);
                            setClients(clients.map(c => c.id === selectedClient.id ? { ...c, solde: newSolde } : c));
                            setSelectedClient({ ...selectedClient, solde: newSolde });

                            setShowTransactionForm(false);
                            setTransactionAmount('');
                            setTransactionDesc('');
                            setTransactionCommentaire('');
                            setTransactionType('paiement');
                          } else {
                            toast({ type: 'error', message: "Erreur lors de l'ajout de la transaction." });
                          }
                          setIsSubmitting(false);
                        }}
                        disabled={isSubmitting}
                        style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', backgroundColor: isSubmitting ? '#94A3B8' : '#10B981', color: 'white', border: 'none', fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer' }}
                      >
                        {isSubmitting ? 'En cours...' : 'Valider'}
                      </button>
                      <button
                        onClick={() => setShowTransactionForm(false)}
                        style={{ padding: '0.75rem 1.5rem', borderRadius: '0.5rem', backgroundColor: '#EF4444', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: '2rem', display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                    <button onClick={() => { setActiveTab('demandes'); setSelectedClient(null); setShowTransactionForm(false); }} className="btn btn-primary" style={{ flex: '1 1 auto', minWidth: '200px', padding: '0.75rem', borderRadius: '0.75rem', fontWeight: 600, border: 'none', backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer' }}>
                      Voir ses dossiers
                    </button>
                    <button onClick={() => setShowTransactionForm(true)} className="btn btn-secondary" style={{ flex: '1 1 auto', minWidth: '200px', padding: '0.75rem', borderRadius: '0.75rem', fontWeight: 600, border: '1px solid #E2E8F0', backgroundColor: '#fff', color: '#475569', cursor: 'pointer' }}>
                      Ajouter une transaction
                    </button>
                  </div>
                )}

                <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #E2E8F0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                      Historique des transactions
                    </h3>

                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <select
                        value={filterPeriod}
                        onChange={e => setFilterPeriod(e.target.value as any)}
                        style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1', backgroundColor: '#F8FAFC', fontSize: '0.875rem' }}
                      >
                        <option value="all">Toutes les dates</option>
                        <option value="today">Aujourd'hui</option>
                        <option value="month">Ce mois</option>
                        <option value="year">Cette année</option>
                        <option value="custom">Date personnalisée</option>
                      </select>

                      {filterPeriod === 'custom' && (
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <input
                            type="date"
                            value={customStartDate}
                            onChange={e => setCustomStartDate(e.target.value)}
                            style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1', fontSize: '0.875rem' }}
                          />
                          <span style={{ color: '#64748B', fontSize: '0.875rem' }}>au</span>
                          <input
                            type="date"
                            value={customEndDate}
                            onChange={e => setCustomEndDate(e.target.value)}
                            style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1', fontSize: '0.875rem' }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '1rem', width: '100%' }}>
                    <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                        <tr>
                          <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Date</th>
                          <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Description / Commentaire</th>
                          <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Montant</th>
                          <th style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredClientTransactions.map(tx => (
                          <React.Fragment key={tx.id}>
                            <tr style={{ borderBottom: '1px solid #E2E8F0' }}>
                              <td style={{ padding: '1rem', color: '#475569', fontSize: '0.875rem' }}>
                                {new Date(tx.date).toLocaleDateString('fr-FR')}
                                {tx.isModificationPending && <span style={{display: 'block', color: '#D97706', fontSize: '0.75rem'}}>⏳ En attente de validation</span>}
                              </td>
                              <td style={{ padding: '1rem', color: '#0F172A', fontSize: '0.875rem' }}>
                                <div style={{ fontWeight: 600 }}>{tx.description}</div>
                                {tx.commentaire && <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.25rem' }}>{tx.commentaire}</div>}
                              </td>
                              <td style={{ padding: '1rem', color: getTransactionSign(tx.type as any) < 0 ? '#DC2626' : '#16A34A', fontSize: '0.875rem', fontWeight: 700 }}>
                                {getTransactionSign(tx.type as any) > 0 ? '+' : '-'}{Math.abs(tx.montant).toLocaleString('fr-FR')} FCFA
                              </td>
                              <td style={{ padding: '1rem' }}>
                                <button onClick={() => {
                                  setEditingTransaction(tx);
                                  setTransactionAmount(Math.abs(tx.montant).toString());
                                  setTransactionDesc(tx.description);
                                  setTransactionCommentaire(tx.commentaire || '');
                                  setTransactionType(tx.type.toLowerCase());
                                }} style={{ padding: '0.5rem', backgroundColor: '#F1F5F9', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: '#475569' }}>
                                  Modifier
                                </button>
                              </td>
                            </tr>
                            {editingTransaction?.id === tx.id && (
                              <tr style={{ backgroundColor: '#F8FAFC' }}>
                                <td colSpan={4} style={{ padding: '1rem' }}>
                                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                                    <select value={transactionType} onChange={e => setTransactionType(e.target.value)} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1' }}>
                                      <option value="paiement">Paiement</option>
                                      <option value="dette">Dette</option>
                                      <option value="créance">Créance</option>
                                      <option value="remboursement">Remboursement</option>
                                    </select>
                                    <input type="number" placeholder="Montant" value={transactionAmount} onChange={e => setTransactionAmount(e.target.value)} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1', width: '150px' }} />
                                    <input type="text" placeholder="Description" value={transactionDesc} onChange={e => setTransactionDesc(e.target.value)} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1', flex: '1 1 auto' }} />
                                    <input type="text" placeholder="Commentaire" value={transactionCommentaire} onChange={e => setTransactionCommentaire(e.target.value)} style={{ padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #CBD5E1', flex: '1 1 auto' }} />
                                    <button onClick={async () => {
                                      const newAmount = parseInt(transactionAmount);
                                      if (isNaN(newAmount)) return;
                                      setIsSubmitting(true);
                                      const finalAmount = Math.abs(newAmount);
                                      let mappedType: 'PAIEMENT' | 'DETTE' | 'CREANCE' | 'REMBOURSEMENT' = 'PAIEMENT';
                                      if (transactionType === 'dette') mappedType = 'DETTE';
                                      if (transactionType === 'créance') mappedType = 'CREANCE';
                                      if (transactionType === 'remboursement') mappedType = 'REMBOURSEMENT';

                                      const res = await updateTransaction(tx.id, {
                                        amount: finalAmount,
                                        type: mappedType,
                                        desc: transactionDesc.trim() || tx.description,
                                        commentaire: transactionCommentaire.trim() || undefined
                                      });
                                      if (res.success) {
                                        toast({ type: 'success', message: res.message || 'Succès' });
                                        setEditingTransaction(null);
                                        const txx = await getClientTransactions(selectedClient.id);
                                        setClientTransactions(txx.transactions || []);
                                      } else {
                                        toast({ type: 'error', message: res.error || 'Erreur' });
                                      }
                                      setIsSubmitting(false);
                                    }} style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
                                      {isSubmitting ? '...' : 'Sauvegarder'}
                                    </button>
                                    <button onClick={() => setEditingTransaction(null)} style={{ padding: '0.5rem 1rem', backgroundColor: '#E2E8F0', color: '#475569', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
                                      Annuler
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- PARAMÈTRES TAB --- */}
        {activeTab === 'parametres' && (
          <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '2rem' }}>Paramètres</h1>
            <PushSettings />
          </div>
        )}

        {/* --- WHATSAPP TAB --- */}
        {activeTab === 'whatsapp' && (
          <div className={`animate-fade-in ${getWhatsappGridClasses(!!selectedWaConv)}`} style={{ backgroundColor: '#fff', borderRadius: '0', overflow: 'hidden' }}>
            {/* Liste des conversations */}
            <div className="wa-list-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, borderRight: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid #E2E8F0', backgroundColor: '#fff' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                  Messagerie
                </h2>
              </div>

              <div style={{ padding: '0.5rem', backgroundColor: '#fff', borderBottom: '1px solid #E2E8F0', overflowX: 'auto', display: 'flex', gap: '0.5rem', WebkitOverflowScrolling: 'touch' }}>
                {(['ALL', 'ACTION_REQUIRED', 'UNREAD', 'HUMAN_SUPPORT', 'TO_DO', 'IN_PROGRESS', 'RESOLVED'] as InboxFilter[]).map(filter => (
                  <button
                    key={filter}
                    onClick={() => setWaFilter(filter)}
                    style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '999px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                      border: waFilter === filter ? 'none' : '1px solid #E2E8F0',
                      backgroundColor: waFilter === filter ? 'var(--color-primary)' : 'transparent',
                      color: waFilter === filter ? '#fff' : '#64748B',
                      cursor: 'pointer'
                    }}
                  >
                    {filter === 'ALL' && 'Toutes'}
                    {filter === 'ACTION_REQUIRED' && 'À suivre'}
                    {filter === 'UNREAD' && 'Non lues'}
                    {filter === 'HUMAN_SUPPORT' && 'Conseiller requis'}
                    {filter === 'TO_DO' && 'À traiter'}
                    {filter === 'IN_PROGRESS' && 'En cours'}
                    {filter === 'RESOLVED' && 'Traitées'}
                  </button>
                ))}
              </div>

              <div style={{ overflowY: 'auto', flex: 1 }}>
                {filterWhatsAppConversations(waConversations, waFilter, searchQuery).map(conv => {
                  const isActive = selectedWaConv?.id === conv.id;
                  const date = new Date(conv.lastMessageAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
                  return (
                    <div
                      key={conv.id}
                      onClick={() => { setConversationOpenSequence(prev => prev + 1); initialScrolledConversationIdRef.current = null; setSelectedWaConv(conv); setWaError(''); }}
                      style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #E2E8F0', cursor: 'pointer', backgroundColor: isActive ? '#EFF6FF' : 'transparent', transition: 'background-color 0.2s' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 600, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {conv.displayName || conv.waId.replace(/(\d{2})(\d{4})(\d{4})/, '+$1 *** $3')}
                          {(conv.unreadCount || 0) > 0 && (
                            <span style={{ backgroundColor: '#EF4444', color: '#fff', borderRadius: '9px', fontSize: '10px', padding: '2px 6px', display: 'inline-flex', alignItems: 'center' }}>
                              {conv.unreadCount}
                            </span>
                          )}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{date}</span>
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {conv._count?.messages} messages
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                        {conv.botState === 'HUMAN_SUPPORT' && (
                          <span style={{ backgroundColor: '#FEE2E2', color: '#DC2626', padding: '0.25rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
                            Conseiller requis
                          </span>
                        )}
                        {conv.supportStatus === 'TO_DO' && (
                          <span style={{ backgroundColor: '#FEF3C7', color: '#D97706', padding: '0.25rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
                            À traiter
                          </span>
                        )}
                        {conv.supportStatus === 'IN_PROGRESS' && (
                          <span style={{ backgroundColor: '#DBEAFE', color: '#2563EB', padding: '0.25rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600 }}>
                            En cours
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {waConversations.length === 0 && (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#64748B' }}>Aucune conversation</div>
                )}
              </div>
            </div>

            {/* Vue d'une conversation */}
            {selectedWaConv ? (
              <div className="wa-conv-container" style={{ backgroundColor: '#fff', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, minWidth: 0 }}>
                <div className="wa-conversation-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E2E8F0', backgroundColor: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0, flexShrink: 0 }}>
                  <div className="wa-conversation-header-identity" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                    <button
                      className="mobile-only"
                      onClick={() => { setSelectedWaConv(null); initialScrolledConversationIdRef.current = null; }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', marginLeft: '-0.5rem', color: '#64748B', flexShrink: 0 }}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    </button>
                    <div className="identity-text" style={{ minWidth: 0, overflow: 'hidden' }}>
                      <h3 style={{ margin: 0, fontSize: '1.125rem', color: '#0F172A', fontWeight: 600, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {selectedWaConv.displayName || 'Client WhatsApp'}
                      </h3>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {selectedWaConv.waId.replace(/(\d{2})(\d{3})(\d{3})(\d{3})/, '+$1 $2 $3 $4')}
                      </p>
                    </div>
                  </div>
                  <div className="wa-conversation-header-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {(() => {
                      const actions = getAdvisorActions(selectedWaConv.supportStatus, selectedWaConv.botState);
                      return (
                        <>
                          {actions.showClaim && (
                            <button
                              onClick={async () => {
                                const res = await claimConversation(selectedWaConv.id);
                                if (res.success) {
                                  setSelectedWaConv({ ...selectedWaConv, supportStatus: 'IN_PROGRESS' });
                                  setWaConversations(prev => sortWhatsAppConversations(prev.map(c => c.id === selectedWaConv.id ? { ...c, supportStatus: 'IN_PROGRESS' } : c)));
                                }
                              }}
                              style={{ padding: '0.5rem 1rem', backgroundColor: '#D97706', color: '#fff', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
                            >
                              Prendre en charge
                            </button>
                          )}
                          {actions.showResolve && (
                            <button
                              onClick={async () => {
                                const res = await resolveConversation(selectedWaConv.id);
                                if (res.success) {
                                  setSelectedWaConv({ ...selectedWaConv, supportStatus: 'RESOLVED' });
                                  setWaConversations(prev => sortWhatsAppConversations(prev.map(c => c.id === selectedWaConv.id ? { ...c, supportStatus: 'RESOLVED' } : c)));
                                }
                              }}
                              style={{ padding: '0.5rem 1rem', backgroundColor: '#10B981', color: '#fff', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
                            >
                              Marquer comme traité
                            </button>
                          )}
                          {actions.showReopen && (
                            <button
                              onClick={async () => {
                                const res = await reopenConversation(selectedWaConv.id);
                                if (res.success) {
                                  setSelectedWaConv({ ...selectedWaConv, supportStatus: 'TO_DO' });
                                  setWaConversations(prev => sortWhatsAppConversations(prev.map(c => c.id === selectedWaConv.id ? { ...c, supportStatus: 'TO_DO' } : c)));
                                }
                              }}
                              style={{ padding: '0.5rem 1rem', backgroundColor: '#64748B', color: '#fff', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}
                            >
                              Remettre à traiter
                            </button>
                          )}
                          {actions.showResumeBot && (
                            <button
                              onClick={async () => {
                                const res = await resumeBot(selectedWaConv.id);
                                if (res.success) {
                                  setSelectedWaConv({ ...selectedWaConv, botState: 'IDLE' });
                                  setWaConversations(prev => sortWhatsAppConversations(prev.map(c => c.id === selectedWaConv.id ? { ...c, botState: 'IDLE' } : c)));
                                } else {
                                  setWaError(res.error || 'Erreur lors de la reprise.');
                                }
                              }}
                              style={{ padding: '0.5rem 1rem', backgroundColor: '#3B82F6', color: '#fff', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem', flexShrink: 0, whiteSpace: 'nowrap' }}
                            >
                              Rendre la main au bot
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div ref={waScrollContainerRef} onScroll={handleWaScroll} className="wa-messages" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minWidth: 0, padding: '1.5rem', backgroundColor: '#F8FAFC', display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
                  {waMessages.map((msg, index) => {
                    const isInbound = msg.direction === 'INBOUND';
                    // Fallback sur createdAt si metaTimestamp est absent (bien que schema l'oblige)
                    const timestampToUse = msg.metaTimestamp || msg.createdAt;

                    const currentDayKey = getMessageDayKey(timestampToUse);
                    const previousDayKey = index > 0
                      ? getMessageDayKey(waMessages[index - 1].metaTimestamp || waMessages[index - 1].createdAt)
                      : null;

                    const showSeparator = currentDayKey !== previousDayKey;

                    const time = formatMessageTime(timestampToUse);

                    return (
                      <React.Fragment key={msg.id}>
                        {showSeparator && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '1rem 0' }}>
                            <div style={{ backgroundColor: '#F1F5F9', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', color: '#64748B', fontWeight: 500, letterSpacing: '0.025em' }}>
                              {formatMessageDate(timestampToUse)}
                            </div>
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: isInbound ? 'flex-start' : 'flex-end', width: '100%', minWidth: 0 }}>
                          <div style={{
                            maxWidth: '85%',
                            overflowWrap: 'anywhere',
                            wordBreak: 'break-word',
                            padding: '0.875rem 1rem',
                            borderRadius: '1rem',
                            borderBottomLeftRadius: isInbound ? '0' : '1rem',
                            borderBottomRightRadius: !isInbound ? '0' : '1rem',
                            backgroundColor: isInbound ? '#fff' : '#10B981',
                            color: isInbound ? '#0F172A' : '#fff',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            border: isInbound ? '1px solid #E2E8F0' : 'none'
                          }}>
                            {msg.content}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', fontSize: '0.75rem', color: '#64748B' }}>
                            <span>{time}</span>
                            {!isInbound && (
                              <span style={{
                                color: msg.status === 'FAILED' ? '#EF4444' : (msg.status === 'READ' ? '#3B82F6' : '#94A3B8'),
                                fontWeight: 600
                              }}>
                                {msg.status === 'FAILED' ? 'Échec' : (msg.status === 'READ' ? 'Lu' : (msg.status === 'DELIVERED' ? 'Distribué' : 'Envoyé'))}
                              </span>
                            )}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                  {waMessages.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#94A3B8', marginTop: '2rem' }}>Aucun message chargé</div>
                  )}
                </div>

                <div className="wa-composer" style={{ flexShrink: 0, padding: '1.5rem', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))', backgroundColor: '#fff', borderTop: '1px solid #E2E8F0', width: '100%', minWidth: 0 }}>
                  {waError && <div style={{ color: '#DC2626', fontSize: '0.875rem', marginBottom: '0.5rem', fontWeight: 500 }}>{waError}</div>}
                  <form onSubmit={handleSendWaReply} style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', width: '100%', minWidth: 0 }}>
                    <textarea
                      ref={waTextareaRef}
                      value={waReplyText}
                      onChange={(e) => {
                        setWaReplyText(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                        e.target.style.overflowY = e.target.scrollHeight > 100 ? 'auto' : 'hidden';
                      }}

                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          if (!isSendingWa && waReplyText.trim()) {
                            handleSendWaReply({ preventDefault: () => {} } as React.FormEvent);
                          }
                        }
                      }}
                      placeholder="Écrire un message..."
                      rows={1}
                      wrap="soft"
                      style={{
                        flex: '1 1 0%',
                        width: '100%',
                        minWidth: 0,
                        maxWidth: '100%',
                        padding: '0.875rem 1.25rem',
                        borderRadius: '1.25rem',
                        border: '1px solid #E2E8F0',
                        outline: 'none',
                        backgroundColor: '#F8FAFC',
                        resize: 'none',
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                        overflowX: 'hidden',
                        overflowY: 'hidden',
                        lineHeight: '1.5',
                        minHeight: '48px',
                        maxHeight: '100px',
                        fontFamily: 'inherit'
                      }}
                    />
                    <button
                      type="submit"
                      disabled={isSendingWa || !waReplyText.trim()}
                      style={{ height: '48px', padding: '0 1rem', flexShrink: 0, borderRadius: '999px', border: 'none', backgroundColor: '#10B981', color: '#fff', fontWeight: 600, cursor: isSendingWa ? 'not-allowed' : 'pointer', opacity: (isSendingWa || !waReplyText.trim()) ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    >
                      {isSendingWa ? '...' : (
                        <>
                          <svg className="desktop-only" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                          <svg className="mobile-only" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                          <span className="desktop-only">Envoyer</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', backgroundColor: '#F8FAFC' }}>
                <div style={{ textAlign: 'center' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ marginBottom: '1rem', opacity: 0.5 }}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                  <p style={{ margin: 0 }}>Sélectionnez une conversation</p>
                </div>
              </div>
            )}
          </div>
        )}

        <DocumentViewerModal
          open={!!viewerDoc}
          onClose={() => setViewerDoc(null)}
          documentUrl={viewerDoc?.url || ''}
          mimeType={viewerDoc?.mimeType}
          title={viewerDoc?.title || 'Document'}
        />
      </main>
      <AdminEnhanceModal
        isOpen={!!enhancingDoc}
        onClose={() => setEnhancingDoc(null)}
        document={enhancingDoc}
        onSuccess={(documentId, newPath) => {
          setDossiers(prev => prev.map(d => {
            if (d.id === selectedDossier?.id) {
              return {
                ...d,
                documents: d.documents.map((doc: any) => doc.id === documentId ? { ...doc, enhancedStoragePath: newPath } : doc)
              };
            }
            return d;
          }));
          if (selectedDossier) {
            setSelectedDossier({
              ...selectedDossier,
              documents: selectedDossier.documents.map((doc: any) => doc.id === documentId ? { ...doc, enhancedStoragePath: newPath } : doc)
            });
          }
        }}
      />
      <ConfirmDialog
        open={pendingStatusChange !== null}
        title="Changement de statut"
        message={`Êtes-vous sûr de vouloir changer le statut de ce dossier à "${pendingStatusChange?.newStatut?.replace('_', ' ')}" ?`}
        onConfirm={confirmStatusChange}
        onCancel={cancelStatusChange}
        loading={!!isUpdating}
      />
    </div>
  );
}

const navItemStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.875rem 1rem',
  borderRadius: '0.75rem',
  fontSize: '0.95rem',
  fontWeight: 600,
  color: '#475569',
  cursor: 'pointer',
  border: 'none',
  background: 'none',
  width: '100%',
  textAlign: 'left' as const,
  transition: 'all 0.2s',
};

const activeNavItemStyle = {
  backgroundColor: 'var(--color-primary-light)',
  color: 'var(--color-primary)',
};

const kpiCardStyle = {
  backgroundColor: '#fff',
  padding: '1.5rem',
  borderRadius: '1rem',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
  border: '1px solid #E2E8F0'
};

const thStyle = {
  padding: '1.25rem 1.5rem',
  fontSize: '0.75rem',
  fontWeight: 700,
  color: '#64748B',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em'
};

const tdStyle = {
  padding: '1.5rem',
  minWidth: '150px'
};

const docLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0.375rem 0.75rem',
  backgroundColor: '#F8FAFC',
  border: '1px solid #E2E8F0',
  borderRadius: '0.5rem',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--color-primary)',
  textDecoration: 'none',
  transition: 'background-color 0.2s'
};

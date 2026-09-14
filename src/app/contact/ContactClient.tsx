'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { SupportedLanguage } from '@/lib/customer-service/language';
import { WebChatResult } from '@/lib/customer-service/web-chat';
import { siteContent } from '@/lib/content';

interface ContactClientProps {
  companyConfig: {
    commercialName: string;
    phone: string;
    whatsappUrl: string;
    privacyEmail: string;
    address: string;
  };
}

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
  suggestedAction?: {
    label: string;
    href: string;
    external?: boolean;
  };
  isFallback?: boolean;
}

const SHORTCUTS: Record<SupportedLanguage, { label: string; query: string }[]> = {
  fr: [
    { label: 'Demander un devis', query: 'Comment faire une demande de devis ?' },
    { label: 'Suivre mon dossier', query: 'Où en est mon dossier de devis ?' },
    { label: 'Questions fréquentes', query: 'Quels sont vos services et véhicules pris en charge ?' },
    { label: 'Parler à un conseiller', query: 'Je souhaite parler à un conseiller humain' },
  ],
  wo: [
    { label: 'Laaj devis', query: 'Naka lañuy defee demande devis ?' },
    { label: 'Toppatoo sama mbir', query: 'Fu sama dossier tollu ?' },
    { label: 'Laaj yu bari', query: 'Yan xeeti woto ngeen di defal assurance ?' },
    { label: 'Waxtaan ak agent', query: 'Dama bëgg wax ak nit conseiller' },
  ],
  en: [
    { label: 'Request a quote', query: 'How do I request an auto insurance quote?' },
    { label: 'Track my file', query: 'What is the status of my quote request?' },
    { label: 'Frequently asked questions', query: 'What vehicle types and services do you offer?' },
    { label: 'Speak with an advisor', query: 'I want to speak with a human advisor' },
  ],
};

const WELCOME_MESSAGES: Record<SupportedLanguage, string> = {
  fr: "Bonjour et bienvenue sur le service client Business Action ! Je suis votre assistant en ligne. Comment puis-je vous aider aujourd'hui ?",
  wo: "Salam ! Dalal jàmm ci service client bu Business Action. Maa ngi fi ngir jappale la. Lu ñu la mën a defal tey ?",
  en: "Hello and welcome to Business Action customer support! I am your online assistant. How can I help you today?",
};

export default function ContactClient({ companyConfig }: ContactClientProps) {
  const [language, setLanguage] = useState<SupportedLanguage>('fr');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatMessagesContainerRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);

  // Initialize welcome message when language changes or on mount
  useEffect(() => {
    const welcomeId = `welcome-${language}`;
    setMessages([
      {
        id: welcomeId,
        sender: 'bot',
        text: WELCOME_MESSAGES[language],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  }, [language]);

  // Scroll to bottom inside chat container only on new message / loading, not on initial mount
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    chatMessagesContainerRef.current?.scrollTo({
      top: chatMessagesContainerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isLoading) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/contact/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, language }),
      });

      const data = await res.json();

      if (data.success && data.result) {
        const result: WebChatResult = data.result;
        const botMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: result.answer,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestedAction: result.suggestedAction,
          isFallback: result.isFallback,
        };
        setMessages((prev) => [...prev, botMsg]);
      } else {
        const errorMsg: ChatMessage = {
          id: `bot-err-${Date.now()}`,
          sender: 'bot',
          text: "Désolé, une erreur temporaire s'est produite. Vous pouvez nous contacter directement sur WhatsApp.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestedAction: {
            label: 'Ouvrir WhatsApp',
            href: companyConfig.whatsappUrl,
            external: true,
          },
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch {
      const fallbackMsg: ChatMessage = {
        id: `bot-fallback-${Date.now()}`,
        sender: 'bot',
        text: "Connexion momentanément indisponible. Notre équipe reste joignable directement par téléphone ou WhatsApp.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedAction: {
          label: 'Contacter sur WhatsApp',
          href: companyConfig.whatsappUrl,
          external: true,
        },
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '3rem 1rem', maxWidth: '1100px' }}>
      {/* Header */}
      <div className="text-center animate-fade-in" style={{ marginBottom: '2.5rem' }}>
        <span
          style={{
            display: 'inline-block',
            backgroundColor: 'var(--color-primary-light)',
            color: 'var(--color-primary)',
            padding: '0.4rem 1rem',
            borderRadius: '2rem',
            fontSize: '0.875rem',
            fontWeight: 700,
            marginBottom: '0.75rem',
          }}
        >
          Centre de Contact Officiel
        </span>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-text-main)', marginBottom: '0.75rem' }}>
          Contactez le Service Client
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '1.1rem', maxWidth: '650px', margin: '0 auto' }}>
          Notre équipe et notre assistant intelligent vous accompagnent pour vos devis d'assurance automobile et vos démarches au Sénégal.
        </p>
      </div>

      {/* Official Contact Channels Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.25rem',
          marginBottom: '3rem',
        }}
      >
        {/* WhatsApp Card */}
        <div
          className="card"
          style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '0.5rem',
                  backgroundColor: '#DCFCE7',
                  color: '#16A34A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-main)', margin: 0 }}>WhatsApp Officiel</h3>
                <span style={{ fontSize: '0.75rem', color: '#16A34A', fontWeight: 600 }}>Réponse rapide</span>
              </div>
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Échangez directement avec un conseiller dédié via notre numéro certifié.
            </p>
          </div>
          <a
            href={companyConfig.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
            style={{
              backgroundColor: '#25D366',
              color: '#FFFFFF',
              border: 'none',
              padding: '0.65rem 1rem',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              fontSize: '0.875rem',
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            Discuter sur WhatsApp
          </a>
        </div>

        {/* Phone Card */}
        <div
          className="card"
          style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '0.5rem',
                  backgroundColor: 'var(--color-primary-light)',
                  color: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-main)', margin: 0 }}>Appel Téléphonique</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{siteContent.supportHours.phone}</span>
              </div>
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Joignez notre accueil téléphonique au numéro direct :
            </p>
          </div>
          <a
            href={`tel:${companyConfig.phone.replace(/\s+/g, '')}`}
            className="btn btn-secondary"
            style={{
              padding: '0.65rem 1rem',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              fontSize: '0.875rem',
              textAlign: 'center',
              border: '1px solid #CBD5E1',
            }}
          >
            {companyConfig.phone}
          </a>
        </div>

        {/* Email Card */}
        <div
          className="card"
          style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '0.5rem',
                  backgroundColor: '#EFF6FF',
                  color: '#2563EB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-main)', margin: 0 }}>Courrier Électronique</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Support écrit</span>
              </div>
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              Pour toute demande formelle ou transmission de pièces :
            </p>
          </div>
          <a
            href={`mailto:${companyConfig.privacyEmail}`}
            className="btn btn-secondary"
            style={{
              padding: '0.65rem 1rem',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              fontSize: '0.875rem',
              textAlign: 'center',
              border: '1px solid #CBD5E1',
              wordBreak: 'break-all',
            }}
          >
            {companyConfig.privacyEmail}
          </a>
        </div>

        {/* Office Location Card */}
        <div
          className="card"
          style={{
            padding: '1.5rem',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '0.5rem',
                  backgroundColor: '#FEF3C7',
                  color: '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-main)', margin: 0 }}>Adresse Physique</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Siège social</span>
              </div>
            </div>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              {companyConfig.address}
            </p>
          </div>
          <Link
            href="/mentions-legales"
            className="btn btn-secondary"
            style={{
              padding: '0.65rem 1rem',
              borderRadius: 'var(--radius-md)',
              fontWeight: 600,
              fontSize: '0.875rem',
              textAlign: 'center',
              border: '1px solid #CBD5E1',
            }}
          >
            Mentions légales
          </Link>
        </div>
      </div>

      {/* Interactive Customer Service Bot Section */}
      <div
        className="card animate-fade-in"
        style={{
          borderRadius: 'var(--radius-xl)',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          boxShadow: 'var(--shadow-md)',
          overflow: 'hidden',
          marginBottom: '2rem',
        }}
      >
        {/* Chat Header with Language Selector */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            backgroundColor: 'var(--color-primary)',
            color: '#FFFFFF',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#10B981',
                boxShadow: '0 0 0 2px rgba(255,255,255,0.4)',
              }}
            ></div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>Assistant Service Client</h2>
              <span style={{ fontSize: '0.8rem', opacity: 0.85 }}>En ligne 7j/7 • Réponses officielles</span>
            </div>
          </div>

          {/* Language Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>Langue :</span>
            {(['fr', 'wo', 'en'] as SupportedLanguage[]).map((langKey) => (
              <button
                key={langKey}
                onClick={() => setLanguage(langKey)}
                style={{
                  padding: '0.3rem 0.65rem',
                  borderRadius: '0.375rem',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  backgroundColor: language === langKey ? '#FFFFFF' : 'rgba(255, 255, 255, 0.2)',
                  color: language === langKey ? 'var(--color-primary)' : '#FFFFFF',
                  transition: 'all 0.2s',
                }}
              >
                {langKey === 'fr' ? 'FR' : langKey === 'wo' ? 'WO' : 'EN'}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Shortcuts */}
        <div
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#F8FAFC',
            borderBottom: '1px solid #E2E8F0',
            display: 'flex',
            gap: '0.5rem',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
          }}
        >
          {SHORTCUTS[language].map((shortcut, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(shortcut.query)}
              disabled={isLoading}
              style={{
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '1.5rem',
                padding: '0.35rem 0.85rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--color-text-main)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                flexShrink: 0,
                transition: 'border-color 0.2s, background-color 0.2s',
              }}
            >
              <span style={{ color: 'var(--color-primary)' }}>✦</span>
              {shortcut.label}
            </button>
          ))}
        </div>

        {/* Conversation Message Area */}
        <div
          ref={chatMessagesContainerRef}
          style={{
            padding: '1.5rem',
            height: '380px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            backgroundColor: '#FAFAFA',
          }}
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '100%',
              }}
            >
              <div
                style={{
                  maxWidth: '85%',
                  padding: '0.875rem 1.15rem',
                  borderRadius: msg.sender === 'user' ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
                  backgroundColor: msg.sender === 'user' ? 'var(--color-primary)' : '#FFFFFF',
                  color: msg.sender === 'user' ? '#FFFFFF' : 'var(--color-text-main)',
                  boxShadow: msg.sender === 'user' ? '0 2px 4px rgba(0,87,217,0.2)' : '0 1px 3px rgba(0,0,0,0.08)',
                  border: msg.sender === 'user' ? 'none' : '1px solid #E2E8F0',
                  fontSize: '0.925rem',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {msg.text}

                {/* Suggested Interactive Action Button */}
                {msg.suggestedAction && (
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                    {msg.suggestedAction.external ? (
                      <a
                        href={msg.suggestedAction.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          backgroundColor: '#25D366',
                          color: '#FFFFFF',
                          padding: '0.45rem 0.85rem',
                          borderRadius: '0.5rem',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          textDecoration: 'none',
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                          <polyline points="15 3 21 3 21 9"></polyline>
                          <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                        {msg.suggestedAction.label}
                      </a>
                    ) : (
                      <Link
                        href={msg.suggestedAction.href}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          backgroundColor: 'var(--color-primary)',
                          color: '#FFFFFF',
                          padding: '0.45rem 0.85rem',
                          borderRadius: '0.5rem',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          textDecoration: 'none',
                        }}
                      >
                        {msg.suggestedAction.label} →
                      </Link>
                    )}
                  </div>
                )}
              </div>
              <span style={{ fontSize: '0.7rem', color: '#94A3B8', marginTop: '0.25rem', padding: '0 0.25rem' }}>
                {msg.timestamp}
              </span>
            </div>
          ))}

          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748B', fontSize: '0.85rem', fontStyle: 'italic' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-primary)', animation: 'pulse 1s infinite' }}></div>
              L&apos;assistant recherche la réponse officielle...
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputText);
          }}
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: '#FFFFFF',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              language === 'fr'
                ? 'Posez votre question (ex: pièces requises, mentions légales, suivi...)'
                : language === 'wo'
                ? 'Laajal sa laaj fi...'
                : 'Ask your question here...'
            }
            maxLength={500}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #CBD5E1',
              outline: 'none',
              fontSize: '0.9rem',
              color: 'var(--color-text-main)',
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !inputText.trim()}
            className="btn btn-primary"
            style={{
              padding: '0.75rem 1.25rem',
              fontSize: '0.9rem',
              fontWeight: 700,
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              opacity: isLoading || !inputText.trim() ? 0.6 : 1,
              cursor: isLoading || !inputText.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            <span>Envoyer</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </form>
      </div>

      {/* Safety & Fallback Notice */}
      <div
        style={{
          padding: '1.25rem',
          borderRadius: 'var(--radius-md)',
          backgroundColor: '#F1F5F9',
          border: '1px solid #E2E8F0',
          fontSize: '0.85rem',
          color: 'var(--color-text-muted)',
          lineHeight: 1.5,
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--color-primary)' }}>
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
        <div>
          <strong>Sécurité et confidentialité :</strong> Cet assistant public fournit exclusivement des renseignements généraux et officiels sur Business Action. Aucune donnée client personnelle ou confidentielle n&apos;est accessible dans cet échange. Pour le suivi d&apos;un dossier spécifique, rendez-vous sur la page sécurisée{' '}
          <Link href="/suivi" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
            Suivi de dossier
          </Link>{' '}
          ou connectez-vous à votre{' '}
          <Link href="/espace-client" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
            Espace Client
          </Link>.
        </div>
      </div>
    </div>
  );
}

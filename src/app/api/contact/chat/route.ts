import { NextRequest, NextResponse } from 'next/server';
import { resolveWebChatMessageAsync } from '@/lib/customer-service/semantic-chat';
import { SupportedLanguage } from '@/lib/customer-service/language';

// In-memory sliding window rate limiter
const ipRequestCounts = new Map<string, { count: number; expiresAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;

function checkWebChatRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = ipRequestCounts.get(ip);

  if (!entry || entry.expiresAt <= now) {
    ipRequestCounts.set(ip, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  entry.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               req.headers.get('x-real-ip')?.trim() ||
               '127.0.0.1';

    if (!checkWebChatRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: 'Trop de requêtes. Veuillez patienter un instant.' },
        { status: 429, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Format JSON invalide.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const { message, language } = body || {};

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Le message ne peut pas être vide.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (message.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Le message est trop long (maximum 500 caractères).' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    let validatedLanguage: SupportedLanguage | null = null;
    if (language === 'fr' || language === 'wo' || language === 'en') {
      validatedLanguage = language;
    }

    const result = await resolveWebChatMessageAsync(message, validatedLanguage);

    return NextResponse.json(
      { success: true, result },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Erreur chat web service client:', error instanceof Error ? error.message : 'Unknown');
    return NextResponse.json(
      { success: false, error: 'Une erreur interne est survenue.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: 'Méthode non autorisée. Utilisez POST.' },
    { status: 405, headers: { Allow: 'POST' } }
  );
}

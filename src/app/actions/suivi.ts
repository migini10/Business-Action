'use server'

import prisma from '@/lib/prisma'
import crypto from 'crypto'
import { cookies, headers } from 'next/headers'

function getRequestIp(hdrs: Headers): string | null {
  const internalIp = hdrs.get('x-businessaction-client-ip');
  console.log("[RLDBG action-ip]", {
    internalHeaderPresent: Boolean(internalIp)
  });
  return internalIp ? internalIp.trim() : null;
}

function normalizeSenegalPhone(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('00221')) {
    return digits.slice(5).length === 9 ? digits.slice(5) : null;
  }
  if (digits.startsWith('221')) {
    return digits.slice(3).length === 9 ? digits.slice(3) : null;
  }
  return digits.length === 9 ? digits : null;
}

export async function checkRateLimit(ip: string | null, now: Date = new Date()): Promise<boolean> {
  const secret = process.env.RATE_LIMIT_SECRET;
  let allowed = false;
  let failureReason = 'OK';
  let sqlExecuted = false;
  let returnedCount = -1;

  if (!ip) {
    failureReason = 'NO_IP';
  } else if (!secret) {
    failureReason = 'NO_SECRET';
    console.error("CRITICAL: RATE_LIMIT_SECRET is not set.");
  } else {
    const normalizedIp = ip.trim().toLowerCase();
    const ipHash = crypto.createHmac('sha256', secret).update(normalizedIp).digest('hex');

    const windowStart = new Date(Math.floor(now.getTime() / 60000) * 60000);
    const expiresAt = new Date(windowStart.getTime() + 60 * 1000);

    try {
      const result = await prisma.$queryRaw<{count: number}[]>`
        INSERT INTO "RateLimitWindow" ("ipHash", "windowStart", "count", "expiresAt")
        VALUES (${ipHash}, ${windowStart}, 1, ${expiresAt})
        ON CONFLICT ("ipHash", "windowStart")
        DO UPDATE SET "count" = "RateLimitWindow"."count" + 1
        RETURNING "count";
      `;
      sqlExecuted = true;
      if (result && result.length > 0) {
        returnedCount = result[0].count;
        if (returnedCount <= 5) {
          allowed = true;
        } else {
          failureReason = 'LIMIT_EXCEEDED';
        }
      } else {
        failureReason = 'SQL_ERROR';
      }
    } catch (error) {
      sqlExecuted = true;
      failureReason = 'SQL_ERROR';
      console.error("Rate limit check failed:", error);
      console.log("[RLDBG sql-error]", {
        errorName: (error as Error).name,
        errorCode: (error as any).code
      });
    }
  }

  console.log("[RLDBG checkRateLimit]", {
    secretPresent: Boolean(secret),
    ipPresent: Boolean(ip),
    sqlExecuted,
    returnedCount,
    allowed,
    failureReason
  });

  return allowed;
}

export async function searchDossiers(query: { numeroDossier?: string; phone?: string }) {
  const now = new Date();
  try {
    const hdrs = await headers();
    const ip = getRequestIp(hdrs);

    const allowed = await checkRateLimit(ip);
    if (!allowed) {
      return { success: false, error: "Trop de tentatives. Veuillez réessayer plus tard." };
    }

    if (!query.numeroDossier && !query.phone) {
      return { success: false, error: "Veuillez fournir un numéro de dossier ou un numéro de téléphone." };
    }

    if (query.numeroDossier) {
      const normalizedDossier = query.numeroDossier.trim().toUpperCase();
      const dossier = await prisma.dossier.findUnique({
        where: { numeroDossier: normalizedDossier },
        select: {
          numeroDossier: true,
          statut: true,
          typeVehicule: true,
          createdAt: true,
          documents: {
            where: {
              deletedAt: null,
              expiresAt: { gt: now }
            },
            take: 1,
            select: { id: true }
          }
        }
      });
      if (!dossier) {
        return { success: false, error: "Informations de suivi incorrectes." };
      }
      return {
        success: true,
        dossiers: [{
          numeroDossier: dossier.numeroDossier,
          statut: dossier.statut,
          typeVehicule: dossier.typeVehicule,
          createdAt: dossier.createdAt,
          hasPrivateDocuments: dossier.documents.length > 0
        }],
        type: 'dossier'
      };
    }

    if (query.phone) {
      const normalizedPhone = query.phone.trim();
      const dossiers = await prisma.dossier.findMany({
        where: { phone: normalizedPhone },
        select: {
          numeroDossier: true,
          statut: true,
          typeVehicule: true,
          createdAt: true,
          documents: {
            where: {
              deletedAt: null,
              expiresAt: { gt: now }
            },
            take: 1,
            select: { id: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (dossiers.length === 0) {
        return { success: false, error: "Informations de suivi incorrectes." };
      }

      const maskedDossiers = dossiers.map(d => {
        const parts = d.numeroDossier.split('-');
        let masked = d.numeroDossier;
        if (parts.length >= 3) {
          masked = `${parts[0]}-****-${parts[parts.length - 1]}`;
        } else {
          masked = '****';
        }
        return {
          numeroDossier: masked,
          statut: d.statut,
          typeVehicule: d.typeVehicule,
          createdAt: d.createdAt,
          hasPrivateDocuments: d.documents.length > 0
        };
      });

      return { success: true, dossiers: maskedDossiers, type: 'phone' };
    }

    return { success: false, error: "Informations de suivi incorrectes." };
  } catch (error) {
    console.error("Erreur lors de la recherche du dossier:", error);
    return { success: false, error: "Une erreur est survenue lors de la recherche." };
  }
}

export async function unlockDossierDocuments(numeroDossier: string, phone: string) {
  try {
    const hdrs = await headers();
    const ip = getRequestIp(hdrs);

    const allowed = await checkRateLimit(ip);
    if (!allowed) {
      return { success: false, error: "Trop de tentatives. Veuillez réessayer plus tard." };
    }

    const normalizedDossier = numeroDossier.trim().toUpperCase();

    if (!phone.trim() || !normalizedDossier) {
      return { success: false, error: "Informations de vérification incorrectes." };
    }

    const dossier = await prisma.dossier.findFirst({
      where: {
        numeroDossier: normalizedDossier
      },
      select: {
        id: true,
        phone: true
      }
    });

    if (!dossier) {
      return { success: false, error: "Informations de vérification incorrectes." };
    }

    const inputPhoneNorm = normalizeSenegalPhone(phone);
    const dbPhoneNorm = normalizeSenegalPhone(dossier.phone);

    if (!inputPhoneNorm || !dbPhoneNorm || inputPhoneNorm !== dbPhoneNorm) {
      return { success: false, error: "Informations de vérification incorrectes." };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.trackingSession.create({
      data: {
        tokenHash,
        dossierId: dossier.id,
        expiresAt
      }
    });

    const cookieStore = await cookies();
    cookieStore.set('tracking_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60
    });

    const now = new Date();
    const documents = await prisma.dossierDocument.findMany({
      where: {
        dossierId: dossier.id,
        deletedAt: null,
        expiresAt: { gt: now }
      },
      select: {
        id: true,
        type: true,
        side: true,
        mimeType: true,
        uploadedAt: true
      }
    });

    return {
      success: true,
      documents: documents.map(doc => ({
        id: doc.id,
        type: doc.type,
        side: doc.side,
        mimeType: doc.mimeType,
        uploadedAt: doc.uploadedAt.toISOString()
      }))
    };
  } catch (error) {
    console.error("Erreur lors du déverrouillage du dossier:", error);
    return { success: false, error: "Une erreur est survenue lors de la vérification." };
  }
}

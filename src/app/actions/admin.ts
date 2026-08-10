'use server'

import prisma from '@/lib/prisma'
import { StatutDossier } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { calculateClientBalance, normalizeTransactionAmount } from '@/lib/finance'

export async function getDossiers() {
  try {
    const dossiers = await prisma.dossier.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return { success: true, dossiers };
  } catch (error) {
    console.error("Erreur récupération dossiers:", error);
    return { success: false, error: "Erreur lors de la récupération." };
  }
}

export async function updateDossierStatus(id: string, statut: string) {
  try {
    const validStatut = statut as StatutDossier;
    await prisma.dossier.update({
      where: { id },
      data: { statut: validStatut }
    });
    
    // Rafraîchir le cache pour afficher les nouvelles données
    revalidatePath('/admin');
    return { success: true };
  } catch (error) {
    console.error("Erreur mise à jour statut:", error);
    return { success: false, error: "Impossible de mettre à jour le statut." };
  }
}

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

import { Resend } from 'resend';
const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy');

export async function uploadAndSendDevis(formData: FormData) {
  const dossierId = formData.get('dossierId') as string;
  const devisFile = formData.get('devis') as File | null;
  
  if (!dossierId || !devisFile) {
    return { success: false, error: "Dossier ou fichier manquant." };
  }

  if (!supabase) {
    return { success: false, error: "Configuration Supabase manquante." };
  }

  try {
    const dossier = await prisma.dossier.findUnique({ where: { id: dossierId } });
    if (!dossier) return { success: false, error: "Dossier introuvable." };

    // 1. Upload du devis sur Supabase
    const buffer = Buffer.from(await devisFile.arrayBuffer());
    const ext = devisFile.name.split('.').pop() || 'pdf';
    const fileName = `devis_${dossier.numeroDossier}_${Date.now()}.${ext}`;
    
    // On utilise le même bucket ou un bucket "devis" s'il existe (ici on réutilise cartes_grises pour simplifier ou on peut en créer un "documents")
    // Note: Idéalement, créez un bucket "documents" dans Supabase
    const { data, error } = await supabase.storage.from('cartes_grises').upload(fileName, buffer, {
      contentType: devisFile.type,
      upsert: true
    });

    if (error) {
      console.error("Erreur upload devis:", error);
      return { success: false, error: "Erreur lors de l'upload du devis." };
    }

    const { data: publicUrlData } = supabase.storage.from('cartes_grises').getPublicUrl(data.path);
    const devisUrl = publicUrlData.publicUrl;

    // 2. Mise à jour du dossier dans la base de données
    await prisma.dossier.update({
      where: { id: dossierId },
      data: { 
        devisUrl,
        statut: StatutDossier.OFFRE_ENVOYEE 
      }
    });

    // 3. Envoi Automatique (Email via Resend)
    if (dossier.email && process.env.RESEND_API_KEY) {
      try {
        const { data, error } = await resend.emails.send({
          // Utilisez 'onboarding@resend.dev' pour les tests si votre domaine n'est pas encore vérifié
          from: 'Bizness Action <onboarding@resend.dev>',
          to: [dossier.email],
          subject: `Votre devis pour ${dossier.typeVehicule.replace('_', ' ').toLowerCase()} est prêt !`,
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #2563EB;">Bonjour,</h1>
              <p>Suite à votre demande sur <strong>Bizness Action</strong>, nous avons le plaisir de vous transmettre votre devis personnalisé.</p>
              <p>Votre numéro de suivi : <strong>${dossier.numeroDossier}</strong></p>
              <div style="margin: 30px 0;">
                <a href="${devisUrl}" style="background-color: #2563EB; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                  Consulter mon Devis
                </a>
              </div>
              <p>Vous pouvez consulter ou télécharger le document officiel en cliquant sur le bouton ci-dessus.</p>
              <p>Si vous avez des questions, n'hésitez pas à nous contacter.</p>
              <p>Cordialement,<br><strong>L'équipe Bizness Action</strong></p>
            </div>
          `
        });
        
        if (error) {
          console.error("Erreur API Resend:", error);
        } else {
          console.log(`[SYSTEME] 📧 Email envoyé avec succès à ${dossier.email}`);
        }
      } catch (emailError) {
        console.error("Exception lors de l'envoi d'email:", emailError);
      }
    } else {
      console.log(`[SYSTEME] ⚠️ Email non envoyé: pas d'adresse email ou clé RESEND manquante.`);
    }

    // 4. Envoi WhatsApp (Simulation / À connecter avec Twilio ou API Meta)
    console.log(`[SYSTEME] 💬 Simulation d'envoi WhatsApp au ${dossier.phone} avec le lien: ${devisUrl}`);

    revalidatePath('/admin');
    return { success: true, message: "Devis uploadé et envoyé au client avec succès !", devisUrl };
  } catch (error) {
    console.error("Erreur globale upload devis:", error);
    return { success: false, error: "Une erreur inattendue s'est produite." };
  }
}

export async function getClients() {
  try {
    const users = await prisma.user.findMany({
      where: { role: 'CLIENT' },
      include: {
        _count: { select: { dossiers: true } },
        transactions: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    const formattedClients = users.map(user => {
      const solde = calculateClientBalance(user.transactions);
      return {
        id: user.id,
        name: user.fullName,
        phone: user.phone,
        email: user.email,
        dossiers: user._count.dossiers,
        solde
      };
    });

    return { success: true, clients: formattedClients };
  } catch (error) {
    console.error("Erreur récupération clients:", error);
    return { success: false, error: "Erreur lors de la récupération." };
  }
}

export async function getClientTransactions(clientId: string) {
  try {
    const transactions = await prisma.transaction.findMany({
      where: { clientId },
      orderBy: { date: 'desc' }
    });
    return { success: true as const, transactions };
  } catch (error) {
    console.error("Erreur récupération transactions:", error);
    return { success: false as const, error: "Erreur lors de la récupération." };
  }
}

export async function addTransaction(data: { clientId: string, amount: number, type: 'PAIEMENT' | 'DETTE' | 'CREANCE' | 'REMBOURSEMENT', desc: string, commentaire?: string, statut?: string }) {
  try {
    await prisma.transaction.create({
      data: {
        clientId: data.clientId,
        montant: normalizeTransactionAmount(data.amount),
        type: data.type,
        description: data.desc,
        commentaire: data.commentaire,
        statut: data.statut || "Payé"
      }
    });
    return { success: true };
  } catch (error) {
    console.error("Erreur ajout transaction:", error);
    return { success: false, error: "Erreur lors de l'ajout." };
  }
}

export async function updateTransaction(id: string, data: { amount: number, type: 'PAIEMENT' | 'DETTE' | 'CREANCE' | 'REMBOURSEMENT', desc: string, commentaire?: string }) {
  try {
    const transaction = await prisma.transaction.findUnique({ where: { id } });
    if (!transaction) return { success: false, error: "Transaction introuvable." };

    const minutesElapsed = (Date.now() - new Date(transaction.date).getTime()) / (1000 * 60);

    if (minutesElapsed < 5) {
      // Modification directe
      await prisma.transaction.update({
        where: { id },
        data: {
          montant: normalizeTransactionAmount(data.amount),
          type: data.type,
          description: data.desc,
          commentaire: data.commentaire
        }
      });
      return { success: true, message: "Transaction modifiée avec succès." };
    } else {
      // Demande de modification
      await prisma.transaction.update({
        where: { id },
        data: {
          isModificationPending: true,
          pendingModification: {
            montant: normalizeTransactionAmount(data.amount),
            type: data.type,
            description: data.desc,
            commentaire: data.commentaire
          }
        }
      });
      return { success: true, message: "Le délai de 5 minutes est dépassé. Une demande de validation a été envoyée au client." };
    }
  } catch (error) {
    console.error("Erreur modification transaction:", error);
    return { success: false, error: "Erreur lors de la modification." };
  }
}

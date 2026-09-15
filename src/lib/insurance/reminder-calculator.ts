/**
 * Moteur pur de calcul des rappels d'expiration d'assurance.
 *
 * Règles métier :
 * - Exactement deux rappels WhatsApp : J-7 et J-2 à 08:00 heure de Dakar (Africa/Dakar).
 * - Aucun autre rappel (pas de J-30, J-1, J-0, etc.).
 * - Si création avant J-7 : planifier J-7 et J-2.
 * - Si création entre J-7 et J-2 (ex: J-5) : planifier uniquement J-2.
 * - Si J-2 est déjà passé lors de la création : aucun rappel.
 * - Timezone métier : Africa/Dakar (UTC+0 permanent).
 */

export const BUSINESS_TIMEZONE = 'Africa/Dakar';
export const REMINDER_HOUR_DAKAR = 8;
export const REMINDER_MINUTE_DAKAR = 0;

export type ReminderType = 'J_MINUS_7' | 'J_MINUS_2';
export type ReminderStatus = 'PREVU' | 'ENVOYE' | 'ECHOUE' | 'ANNULE';

export interface PlannedReminder {
  type: ReminderType;
  scheduledFor: Date;
}

/**
 * Extrait les composantes d'année, mois et jour d'une date dans le fuseau Africa/Dakar.
 */
export function getDatePartsInDakar(date: Date): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const formatted = formatter.format(date); // YYYY-MM-DD
  const [yearStr, monthStr, dayStr] = formatted.split('-');
  return {
    year: parseInt(yearStr, 10),
    month: parseInt(monthStr, 10),
    day: parseInt(dayStr, 10),
  };
}

/**
 * Calcule la date et l'heure cible d'un rappel à N jours avant la date d'expiration
 * fixée à 08:00 (Africa/Dakar).
 */
export function calculateReminderTargetDate(
  dateExpiration: Date,
  daysBefore: number,
  hour: number = REMINDER_HOUR_DAKAR,
  minute: number = REMINDER_MINUTE_DAKAR
): Date {
  const { year, month, day } = getDatePartsInDakar(dateExpiration);

  // Dakar est à UTC+0 sans heure d'été : UTC = Dakar time
  // On construit la date en UTC directement pour respecter 08:00 Dakar
  const targetUtc = new Date(Date.UTC(year, month - 1, day - daysBefore, hour, minute, 0, 0));
  return targetUtc;
}

/**
 * Moteur pur : détermine la liste exacte des rappels applicables selon la date d'expiration
 * et la date de référence (date de création ou de recalcul).
 */
export function computeApplicableReminders(
  dateExpiration: Date,
  referenceDate: Date = new Date()
): PlannedReminder[] {
  const targetJ7 = calculateReminderTargetDate(dateExpiration, 7);
  const targetJ2 = calculateReminderTargetDate(dateExpiration, 2);

  const reminders: PlannedReminder[] = [];

  // Règle 1 : Si référence avant J-7 => créer J-7 et J-2
  if (referenceDate < targetJ7) {
    reminders.push({ type: 'J_MINUS_7', scheduledFor: targetJ7 });
    reminders.push({ type: 'J_MINUS_2', scheduledFor: targetJ2 });
    return reminders;
  }

  // Règle 2 : Si référence entre J-7 et J-2 (ex: J-5) => créer uniquement J-2
  if (referenceDate < targetJ2) {
    reminders.push({ type: 'J_MINUS_2', scheduledFor: targetJ2 });
    return reminders;
  }

  // Règle 3 : Si J-2 est déjà passé => aucun rappel
  return [];
}

/**
 * Filtre anti-duplication : empêche la planification d'un rappel de même type
 * si un rappel existe déjà à l'état PREVU ou ENVOYE pour ce contrat.
 */
export function filterDuplicateReminders(
  candidateReminders: PlannedReminder[],
  existingReminders: Array<{ type: ReminderType; statut: ReminderStatus }>
): PlannedReminder[] {
  const activeTypes = new Set(
    existingReminders
      .filter((r) => r.statut === 'PREVU' || r.statut === 'ENVOYE')
      .map((r) => r.type)
  );

  return candidateReminders.filter((candidate) => !activeTypes.has(candidate.type));
}

export function getMessageDayKey(timestamp: Date | string): string {
  const d = new Date(timestamp);
  // Intl.DateTimeFormat with fr-FR returns DD/MM/YYYY. We rearrange it to YYYY-MM-DD to be a sortable key if needed, or just a unique string for the day.
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Dakar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(d);

  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

export function formatMessageDate(timestamp: Date | string): string {
  const d = new Date(timestamp);
  
  const now = new Date();
  const todayKey = getMessageDayKey(now);
  
  // Use a precise yesterday calculation in the target timezone
  // A simple `- 24 hours` works well enough for day keys unless there is a DST change,
  // but Dakar (Africa/Dakar) does not observe DST.
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayKey = getMessageDayKey(yesterday);
  
  const targetKey = getMessageDayKey(d);
  
  if (targetKey === todayKey) {
    return 'Aujourd’hui';
  }
  if (targetKey === yesterdayKey) {
    return 'Hier';
  }
  
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Dakar',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(d);
}

export function formatMessageTime(timestamp: Date | string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Africa/Dakar',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp));
}

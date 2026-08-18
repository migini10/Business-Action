export type WhatsAppSupportStatus = 'TO_DO' | 'IN_PROGRESS' | 'RESOLVED';
export type WhatsAppBotState = 'IDLE' | 'QUOTE_VEHICLE' | 'QUOTE_CONFIRM' | 'TRACK_SELECT' | 'HUMAN_SUPPORT';

export interface InboxConversation {
  id: string;
  waId: string;
  displayName: string | null;
  botState: WhatsAppBotState | string;
  supportStatus: WhatsAppSupportStatus | string;
  lastMessageAt: Date | string;
  unreadCount: number;
  _count?: {
    messages: number;
  };
}

export function sortWhatsAppConversations(conversations: InboxConversation[]) {
  return [...conversations].sort((a, b) => {
    // 1. HUMAN_SUPPORT + TO_DO
    const aPriority1 = a.botState === 'HUMAN_SUPPORT' && a.supportStatus === 'TO_DO';
    const bPriority1 = b.botState === 'HUMAN_SUPPORT' && b.supportStatus === 'TO_DO';
    if (aPriority1 && !bPriority1) return -1;
    if (!aPriority1 && bPriority1) return 1;

    // 2. IN_PROGRESS
    const aPriority2 = a.supportStatus === 'IN_PROGRESS';
    const bPriority2 = b.supportStatus === 'IN_PROGRESS';
    if (aPriority2 && !bPriority2) return -1;
    if (!aPriority2 && bPriority2) return 1;

    // 3. unreadCount > 0
    const aPriority3 = (a.unreadCount || 0) > 0;
    const bPriority3 = (b.unreadCount || 0) > 0;
    if (aPriority3 && !bPriority3) return -1;
    if (!aPriority3 && bPriority3) return 1;

    // 4. lastMessageAt descendant
    return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
  });
}

export type InboxFilter = 'ALL' | 'ACTION_REQUIRED' | 'UNREAD' | 'HUMAN_SUPPORT' | 'TO_DO' | 'IN_PROGRESS' | 'RESOLVED';

export function filterWhatsAppConversations(
  conversations: InboxConversation[],
  filter: InboxFilter,
  searchQuery: string = ''
) {
  let filtered = conversations;

  switch (filter) {
    case 'UNREAD':
      filtered = filtered.filter(c => (c.unreadCount || 0) > 0);
      break;
    case 'HUMAN_SUPPORT':
      filtered = filtered.filter(c => c.botState === 'HUMAN_SUPPORT');
      break;
    case 'TO_DO':
      filtered = filtered.filter(c => c.supportStatus === 'TO_DO');
      break;
    case 'IN_PROGRESS':
      filtered = filtered.filter(c => c.supportStatus === 'IN_PROGRESS');
      break;
    case 'RESOLVED':
      filtered = filtered.filter(c => c.supportStatus === 'RESOLVED');
      break;
    case 'ACTION_REQUIRED':
      filtered = filtered.filter(isActionRequired);
      break;
    case 'ALL':
    default:
      break;
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(c => 
      (c.displayName?.toLowerCase().includes(q) || false) ||
      (c.waId.includes(q))
    );
  }

  return filtered;
}

export function isActionRequired(c: InboxConversation): boolean {
  return c.supportStatus !== 'RESOLVED' || (c.unreadCount || 0) > 0;
}

export function getActionCount(conversations: InboxConversation[]): number {
  return conversations.filter(isActionRequired).length;
}

export function getAdvisorActions(supportStatus: string | undefined, botState: string | undefined) {
  return {
    showClaim: supportStatus === 'TO_DO',
    showResolve: supportStatus === 'IN_PROGRESS',
    showReopen: supportStatus === 'IN_PROGRESS' || supportStatus === 'RESOLVED',
    showResumeBot: botState === 'HUMAN_SUPPORT',
  };
}

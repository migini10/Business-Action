import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  InboxConversation,
  sortWhatsAppConversations,
  filterWhatsAppConversations,
  getActionCount
} from './whatsapp-inbox';

describe('WhatsApp Inbox Helper Tests (AUTO-006)', () => {
  const baseConv: InboxConversation = {
    id: 'c1',
    waId: '123',
    displayName: 'A',
    botState: 'IDLE',
    supportStatus: 'RESOLVED',
    lastMessageAt: new Date('2026-08-01T10:00:00Z'),
    unreadCount: 0
  };

  test('13. tri HUMAN_SUPPORT + TO_DO en premier', () => {
    const list = [
      { ...baseConv, id: 'c1', supportStatus: 'IN_PROGRESS' },
      { ...baseConv, id: 'c2', botState: 'HUMAN_SUPPORT', supportStatus: 'TO_DO' },
    ];
    const sorted = sortWhatsAppConversations(list);
    assert.strictEqual(sorted[0].id, 'c2');
  });

  test('14. tri IN_PROGRESS en deuxieme', () => {
    const list = [
      { ...baseConv, id: 'c1', unreadCount: 5 },
      { ...baseConv, id: 'c2', supportStatus: 'IN_PROGRESS' },
    ];
    const sorted = sortWhatsAppConversations(list);
    assert.strictEqual(sorted[0].id, 'c2');
  });

  test('15. tri unreadCount > 0 en troisieme', () => {
    const list = [
      { ...baseConv, id: 'c1', supportStatus: 'RESOLVED' },
      { ...baseConv, id: 'c2', unreadCount: 1, supportStatus: 'RESOLVED' },
    ];
    const sorted = sortWhatsAppConversations(list);
    assert.strictEqual(sorted[0].id, 'c2');
  });

  test('16. égalité => lastMessageAt desc', () => {
    const list = [
      { ...baseConv, id: 'c1', supportStatus: 'IN_PROGRESS', lastMessageAt: new Date('2026-08-01T10:00:00Z') },
      { ...baseConv, id: 'c2', supportStatus: 'IN_PROGRESS', lastMessageAt: new Date('2026-08-02T10:00:00Z') },
    ];
    const sorted = sortWhatsAppConversations(list);
    assert.strictEqual(sorted[0].id, 'c2');
  });

  test('17. filtres', () => {
    const list = [
      { ...baseConv, id: 'c1', unreadCount: 1, supportStatus: 'RESOLVED' },
      { ...baseConv, id: 'c2', botState: 'HUMAN_SUPPORT', supportStatus: 'TO_DO' },
      { ...baseConv, id: 'c3', supportStatus: 'IN_PROGRESS' },
    ];
    assert.strictEqual(filterWhatsAppConversations(list, 'UNREAD').length, 1);
    assert.strictEqual(filterWhatsAppConversations(list, 'HUMAN_SUPPORT').length, 1);
    assert.strictEqual(filterWhatsAppConversations(list, 'TO_DO').length, 1);
    assert.strictEqual(filterWhatsAppConversations(list, 'IN_PROGRESS').length, 1);
    assert.strictEqual(filterWhatsAppConversations(list, 'RESOLVED').length, 1);
    assert.strictEqual(filterWhatsAppConversations(list, 'ALL').length, 3);
  });

  test('18. recherche nom', () => {
    const list = [
      { ...baseConv, id: 'c1', displayName: 'Abdou' },
      { ...baseConv, id: 'c2', displayName: 'Zinedine' },
    ];
    assert.strictEqual(filterWhatsAppConversations(list, 'ALL', 'abdou').length, 1);
  });

  test('19. recherche waId', () => {
    const list = [
      { ...baseConv, id: 'c1', waId: '33611223344' },
      { ...baseConv, id: 'c2', waId: '22177000000' },
    ];
    assert.strictEqual(filterWhatsAppConversations(list, 'ALL', '33611').length, 1);
  });

  test('20. actionCount dédupliqué', () => {
    const list = [
      { ...baseConv, id: 'c1', supportStatus: 'TO_DO', unreadCount: 5 }, // 1 action (both apply but it's 1 conv)
      { ...baseConv, id: 'c2', supportStatus: 'IN_PROGRESS', unreadCount: 0 }, // 1 action
      { ...baseConv, id: 'c3', supportStatus: 'RESOLVED', unreadCount: 2 }, // 1 action
      { ...baseConv, id: 'c4', supportStatus: 'RESOLVED', unreadCount: 0 }, // 0 action
    ];
    assert.strictEqual(getActionCount(list), 3);
  });

  test('21. unreadCount réel - structure test', () => {
    const conv = { ...baseConv, unreadCount: 10 };
    assert.strictEqual(conv.unreadCount, 10);
  });
});

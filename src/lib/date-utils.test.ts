import test from 'node:test';
import assert from 'node:assert';
import { getMessageDayKey, formatMessageDate, formatMessageTime } from './date-utils';

test('Date Utils - getMessageDayKey in Africa/Dakar', () => {
  // 16 Aug 2026 23:59:00 UTC = 16 Aug 2026 23:59:00 in Dakar (UTC+0)
  const d1 = new Date('2026-08-16T23:59:00Z');
  assert.strictEqual(getMessageDayKey(d1), '2026-08-16');

  // 17 Aug 2026 00:00:00 UTC = 17 Aug 2026 00:00:00 in Dakar
  const d2 = new Date('2026-08-17T00:00:00Z');
  assert.strictEqual(getMessageDayKey(d2), '2026-08-17');

  // Testing that they belong to different day keys
  assert.notStrictEqual(getMessageDayKey(d1), getMessageDayKey(d2));
});

test('Date Utils - formatMessageDate with Today/Yesterday', () => {
  const now = new Date();
  
  // Today
  assert.strictEqual(formatMessageDate(now), 'Aujourd’hui');

  // Yesterday
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  assert.strictEqual(formatMessageDate(yesterday), 'Hier');

  // Past date
  const past = new Date('2026-08-16T12:00:00Z');
  
  const pastKey = getMessageDayKey(past);
  const todayKey = getMessageDayKey(now);
  const yesterdayKey = getMessageDayKey(yesterday);
  
  if (pastKey !== todayKey && pastKey !== yesterdayKey) {
    assert.strictEqual(formatMessageDate(past), '16 août 2026');
  }
});

test('Date Utils - formatMessageTime in Africa/Dakar', () => {
  const d = new Date('2026-08-16T09:05:00Z');
  assert.strictEqual(formatMessageTime(d), '09:05');
});

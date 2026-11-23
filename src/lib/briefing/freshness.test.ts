import test from 'node:test';
import assert from 'node:assert/strict';
import { isFresh, parsePubDate } from './freshness';

const NOW = Date.parse('2026-11-23T12:00:00+09:00');

test('RFC822 날짜: 오늘은 통과, 사흘 전은 제외', () => {
  assert.equal(isFresh('Mon, 23 Nov 2026 11:48:38 +0900', NOW), true);
  assert.equal(isFresh('Sun, 22 Nov 2026 09:00:00 +0900', NOW), true);
  assert.equal(isFresh('Fri, 20 Nov 2026 09:00:00 +0900', NOW), false);
});

test('JTBC 식 "2024.10.29" 는 제외된다', () => {
  assert.equal(isFresh('2024.10.29', NOW), false);
  assert.equal(isFresh('2026.11.22', NOW), true);
});

test('날짜를 모르면 거르지 않고, 먼 미래 날짜는 제외한다', () => {
  assert.equal(parsePubDate(''), null);
  assert.equal(isFresh(undefined, NOW), true);
  assert.equal(isFresh('Fri, 04 Dec 2026 09:00:00 +0900', NOW), false);
});

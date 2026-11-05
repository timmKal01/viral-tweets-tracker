import { test } from 'node:test';
import assert from 'node:assert/strict';
import { postPattern, summarizePatterns } from '../src/pattern.js';

test('the opening line, length and shape of a list post, links left out', () => {
    const p = postPattern('5 tools I use every day:\n\n- Cursor\n- Raycast\n- Linear\n\nwhat would you add? https://t.co/abc', '2026-11-04T14:30:00.000Z');
    assert.equal(p.hook, '5 tools I use every day:');
    assert.equal(p.hookWords, 6);
    assert.equal(p.hookHasNumber, true);
    assert.equal(p.lineCount, 5);
    assert.equal(p.listItems, 3);
    assert.equal(p.hasQuestion, true);
    assert.equal(p.threadMarker, false);
    assert.equal(p.postedHourUtc, 14);
    assert.equal(p.postedWeekdayUtc, 'Wednesday');
    assert.ok(!p.hook.includes('http') && p.charCount < 80);
});

test('thread openers are spotted by 🧵, "thread" or a 1/ counter, not by any slash', () => {
    assert.equal(postPattern('How we got to $10k MRR 🧵', '2026-11-04T00:00:00Z').threadMarker, true);
    assert.equal(postPattern('a thread on pricing', '2026-11-04T00:00:00Z').threadMarker, true);
    assert.equal(postPattern('Lessons from year one 1/', '2026-11-04T00:00:00Z').threadMarker, true);
    assert.equal(postPattern('shipped v2 (1/7)', '2026-11-04T00:00:00Z').threadMarker, true);
    assert.equal(postPattern('24/7 support and 50/50 odds', '2026-11-04T00:00:00Z').threadMarker, false);
});

test('an empty or odd post still gives safe values', () => {
    const p = postPattern('', 'not a date', { isLongPost: true });
    assert.equal(p.hook, '');
    assert.equal(p.charCount, 0);
    assert.equal(p.postedHourUtc, null);
    assert.equal(p.isLongPost, true);
});

test('a run summary: formats by share and median likes, and the busiest hours', () => {
    const rows = [
        { kind: 'video', likes: 900, ...postPattern('watch this?', '2026-11-04T14:00:00Z') },
        { kind: 'video', likes: 1500, ...postPattern('wild 🧵', '2026-11-04T14:20:00Z') },
        { kind: 'text', likes: 600, ...postPattern('hot take', '2026-11-04T09:00:00Z') },
    ];
    const s = summarizePatterns(rows);
    assert.equal(s.posts, 3);
    assert.deepEqual(Object.keys(s.kinds), ['video', 'text']);
    assert.deepEqual(s.kinds.video, { posts: 2, share: 0.667, medianLikes: 1200 });
    assert.equal(s.withQuestion, 0.333);
    assert.equal(s.threadOpeners, 0.333);
    assert.deepEqual(s.busiestHoursUtc[0], { hourUtc: 14, posts: 2 });
});

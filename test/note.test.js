import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyRunReason, noteRow, errorRow } from '../src/note.js';
import { explainStatus, xDetail } from '../src/xapi.js';

const input = { sinceHours: 24, minLikes: 500, contentType: 'all' };

test('an empty run says whether X found nothing or the filters left nothing', () => {
    assert.match(emptyRunReason({ searched: 2, read: 0, failed: 0 }, input), /X found no posts from the last 24 hours with at least 500 likes/);
    assert.match(emptyRunReason({ searched: 2, read: 0, failed: 1 }, { ...input, contentType: 'videos' }), /no videos .*1 of 2 searches failed/);
    assert.equal(emptyRunReason({ searched: 1, read: 12, skippedSeen: 10, notArticles: 2 }, input),
        'X returned 12 posts, but none were saved: 10 were already returned by earlier runs (onlyNew is on), 2 had no X Article or outside link.');
});

test('note and error rows carry a rowType and are never posts', () => {
    assert.equal(noteRow('n').rowType, 'note');
    const e = errorRow('bad', '@x');
    assert.equal(e.rowType, 'error');
    assert.equal(e.matchedTopic, '@x');
});

test("X's refusals: token, credits and access stop the run, a bad query doesn't", () => {
    assert.equal(explainStatus(401, { title: 'Unauthorized' }).fatal, true);
    assert.match(explainStatus(402, { detail: 'Your enrolled account does not have any credits' }).message, /out of credits.*does not have any credits/);
    assert.equal(explainStatus(403, {}).fatal, true);
    const bad = explainStatus(400, { errors: [{ message: 'Invalid query' }] });
    assert.equal(bad.fatal, false);
    assert.match(bad.message, /X said: "Invalid query"/);
    assert.equal(xDetail(null), '');
});

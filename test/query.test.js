import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildQueries, filterOperators, topicTerms, cleanHandle, trendTerms } from '../src/query.js';

const defaults = { contentType: 'all', minLikes: 500, minReposts: 0, minReplies: 0, language: null, includeReplies: false, verifiedOnly: false };

test('every query leaves out reposts, ads and (by default) replies, and puts the like threshold in the search', () => {
    assert.equal(filterOperators(defaults), '-is:retweet -is:nullcast -is:reply min_likes:500');
    assert.equal(
        filterOperators({ ...defaults, contentType: 'videos', minReposts: 50, language: 'en', includeReplies: true, verifiedOnly: true }),
        '-is:retweet -is:nullcast is:verified lang:en has:video_link min_likes:500 min_reposts:50',
    );
    assert.equal(filterOperators({ ...defaults, minLikes: 0, contentType: 'text' }), '-is:retweet -is:nullcast -is:reply -has:media -has:links');
});

test('topics: single terms as they are, several words as a phrase, X syntax passed through', () => {
    assert.equal(topicTerms('#buildinpublic'), '#buildinpublic');
    assert.equal(topicTerms('$TSLA'), '$TSLA');
    assert.equal(topicTerms('AI agents'), '"AI agents"');
    assert.equal(topicTerms('e-commerce'), 'e-commerce');
    assert.equal(topicTerms('openai OR anthropic'), '(openai OR anthropic)');
    assert.equal(topicTerms('apify -crypto'), '(apify -crypto)');
    assert.equal(topicTerms('url:github.com'), '(url:github.com)');
});

test('handles from @names and profile links; anything else is refused', () => {
    assert.equal(cleanHandle('@nasa'), 'nasa');
    assert.equal(cleanHandle('https://x.com/NASA/status/123'), 'NASA');
    assert.equal(cleanHandle('twitter.com/elonmusk'), 'elonmusk');
    assert.equal(cleanHandle('not a handle'), null);
    assert.equal(cleanHandle('waytoolonghandle123'), null);
});

test('trends: hashtags as they are, names as phrases', () => {
    assert.equal(trendTerms('#WorldSeries'), '#WorldSeries');
    assert.equal(trendTerms('Hegseth fires "chief"'), '"Hegseth fires chief"');
});

test('accounts share as few queries as fit 512 characters; bad handles become problems', () => {
    const many = Array.from({ length: 60 }, (_, i) => `account_${i}`);
    const { queries, problems } = buildQueries({ accounts: [...many, '@account_1', 'no spaces allowed'] }, defaults);
    assert.equal(problems.length, 1);
    assert.match(problems[0].error, /isn't an X handle/);
    assert.ok(queries.length > 1);
    for (const q of queries) assert.ok(q.query.length <= 512, `${q.query.length} chars`);
    const all = queries.flatMap((q) => q.query.match(/from:\w+/g));
    assert.equal(all.length, 60); // the duplicate @account_1 searched once
    assert.equal(queries[0].source, 'accounts');
});

test('a topic too long for X is a problem, not a failed request', () => {
    const { queries, problems } = buildQueries({ topics: ['x'.repeat(600), 'AI agents'] }, defaults);
    assert.equal(queries.length, 1);
    assert.equal(queries[0].query, '"AI agents" -is:retweet -is:nullcast -is:reply min_likes:500');
    assert.match(problems[0].error, /X allows 512/);
});

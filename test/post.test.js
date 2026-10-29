import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toPostRow, includesMaps, bestMp4, SORTS } from '../src/post.js';

// Shaped like X API v2 recent-search output seen on 2026-10-29 (values made up).
const now = Date.parse('2026-10-29T12:00:00Z');
const includes = includesMaps({
    users: [{ id: '42', username: 'example_dev', name: 'Example Dev', verified: true, verified_type: 'blue', profile_image_url: 'https://pbs.twimg.com/profile_images/1/a_normal.jpg', public_metrics: { followers_count: 20000 } }],
    media: [
        { media_key: '13_1', type: 'video', duration_ms: 23958, preview_image_url: 'https://pbs.twimg.com/media/v.jpg', public_metrics: { view_count: 500869 }, variants: [
            { content_type: 'application/x-mpegURL', url: 'https://video.twimg.com/x.m3u8' },
            { content_type: 'video/mp4', bit_rate: 832000, url: 'https://video.twimg.com/low.mp4' },
            { content_type: 'video/mp4', bit_rate: 2176000, url: 'https://video.twimg.com/high.mp4' },
        ] },
        { media_key: '3_2', type: 'photo', url: 'https://pbs.twimg.com/media/p.jpg' },
    ],
});
const videoPost = {
    id: '1001',
    author_id: '42',
    created_at: '2026-10-29T02:00:00.000Z',
    text: 'my AI agents after I give them full access https://t.co/abc',
    lang: 'en',
    public_metrics: { like_count: 10000, retweet_count: 1000, reply_count: 200, quote_count: 100, bookmark_count: 1700, impression_count: 500000 },
    attachments: { media_keys: ['13_1'] },
    entities: { urls: [{ expanded_url: 'https://x.com/example_dev/status/1001/video/1', media_key: '13_1' }], hashtags: [{ tag: 'AI' }] },
};

test('a video post: metrics, rates, author and the best MP4', () => {
    const r = toPostRow(videoPost, includes, { topic: 'AI agents', now });
    assert.equal(r.rowType, 'post');
    assert.equal(r.url, 'https://x.com/example_dev/status/1001');
    assert.equal(r.kind, 'video');
    assert.equal(r.engagements, 13000);
    assert.equal(r.engagementRate, 0.026);
    assert.equal(r.ageHours, 10);
    assert.equal(r.likesPerHour, 1000);
    assert.equal(r.viewsPerFollower, 25);
    assert.equal(r.authorFollowers, 20000);
    assert.equal(r.authorVerified, true);
    assert.equal(r.videoViews, 500869);
    assert.equal(r.videoDurationSec, 24);
    assert.equal(r.videoUrl, 'https://video.twimg.com/high.mp4');
    assert.deepEqual(r.links, []);
    assert.deepEqual(r.hashtags, ['AI']);
    assert.equal(r.matchedTopic, 'AI agents');
});

test('long posts use the full text; quoted-post links are not outside links', () => {
    const r = toPostRow({
        ...videoPost,
        attachments: undefined,
        note_tweet: { text: 'The whole long post.' },
        referenced_tweets: [{ type: 'quoted', id: '777' }],
        entities: { urls: [{ expanded_url: 'https://twitter.com/someone/status/777' }] },
    }, includes, { topic: 't', now });
    assert.equal(r.text, 'The whole long post.');
    assert.equal(r.kind, 'text');
    assert.equal(r.isQuote, true);
    assert.equal(r.quotedPostUrl, 'https://x.com/i/status/777');
    assert.deepEqual(r.links, []);
});

test('outside links and X Articles', () => {
    const link = toPostRow({ ...videoPost, attachments: undefined, entities: { urls: [{ expanded_url: 'https://t.co/x', unwound_url: 'https://example.com/story', title: 'A story', description: 'About it' }] } }, includes, { topic: 't', now });
    assert.equal(link.kind, 'link');
    assert.deepEqual(link.links, [{ url: 'https://example.com/story', title: 'A story', description: 'About it' }]);

    const article = toPostRow({ ...videoPost, attachments: undefined, entities: { urls: [{ expanded_url: 'https://x.com/i/article/555' }] } }, includes, { topic: 't', now });
    assert.equal(article.kind, 'article');
    assert.equal(article.article.url, 'https://x.com/i/article/555');
    assert.deepEqual(article.links, []);

    const native = toPostRow({ ...videoPost, attachments: undefined, entities: {}, article: { title: 'How we ship' } }, includes, { topic: 't', now });
    assert.equal(native.kind, 'article');
    assert.equal(native.articleTitle, 'How we ship');
});

test('without author details the link still works and per-follower numbers are empty', () => {
    const r = toPostRow(videoPost, includesMaps({ media: [] }), { topic: 't', now });
    assert.equal(r.url, 'https://x.com/i/status/1001');
    assert.equal(r.authorUsername, null);
    assert.equal(r.viewsPerFollower, null);
    assert.equal(r.kind, 'text'); // media not included either
});

test('a post seconds old gets a sane per-hour rate, and no views means no engagement rate', () => {
    const r = toPostRow({ ...videoPost, created_at: new Date(now - 1000).toISOString(), public_metrics: { like_count: 600 } }, includes, { topic: 't', now });
    assert.equal(r.likesPerHour, 6000);
    assert.equal(r.views, null);
    assert.equal(r.engagementRate, null);
});

test('bestMp4 skips streams and picks the highest bitrate; sorts order as named', () => {
    assert.equal(bestMp4([{ content_type: 'application/x-mpegURL', url: 'a' }]), null);
    const rows = [{ engagements: 1, likes: 9, views: null, likesPerHour: 1, createdAt: '2026-10-01T00:00:00Z' }, { engagements: 5, likes: 1, views: 10, likesPerHour: 3, createdAt: '2026-10-02T00:00:00Z' }];
    assert.equal([...rows].sort(SORTS.engagements)[0].engagements, 5);
    assert.equal([...rows].sort(SORTS.likes)[0].likes, 9);
    assert.equal([...rows].sort(SORTS.views)[0].views, 10);
    assert.equal([...rows].sort(SORTS.newest)[0].createdAt, '2026-10-02T00:00:00Z');
});

// Turns the input into X recent-search queries. Each topic, each trend and each group of accounts is its own query, so
// every row can say which one found it. Operators: https://docs.x.com/x-api/posts/search/integrate/operators
//
// The like, repost and reply thresholds go into the query itself (min_likes: and friends), so X only returns, and only
// bills the buyer's key for, posts that already pass them.
import { MAX_QUERY_LENGTH } from './config.js';

const CONTENT_OPERATORS = {
    all: [],
    videos: ['has:video_link'], // native X videos
    images: ['has:images'],
    articles: ['has:links'], // narrowed after reading to X Articles and posts linking outside X (see post.js)
    text: ['-has:media', '-has:links'],
};

// Anything that looks like X search syntax is passed through as the buyer wrote it.
const ADVANCED = /["():]|\bOR\b|(^|\s)-\S/;
const HANDLE = /^[A-Za-z0-9_]{1,15}$/;

/** The operators every query gets: no reposts or ads, plus the buyer's filters. */
export function filterOperators({ contentType = 'all', minLikes = 0, minReposts = 0, minReplies = 0, language = null, includeReplies = false, verifiedOnly = false }) {
    const ops = ['-is:retweet', '-is:nullcast'];
    if (!includeReplies) ops.push('-is:reply');
    if (verifiedOnly) ops.push('is:verified');
    if (language) ops.push(`lang:${language}`);
    ops.push(...(CONTENT_OPERATORS[contentType] ?? []));
    if (minLikes > 0) ops.push(`min_likes:${minLikes}`);
    if (minReposts > 0) ops.push(`min_reposts:${minReposts}`);
    if (minReplies > 0) ops.push(`min_replies:${minReplies}`);
    return ops.join(' ');
}

/** One topic as X search terms: words, #hashtags, $cashtags and @mentions as they are, several words as a phrase. */
export function topicTerms(topic) {
    const t = topic.trim();
    if (ADVANCED.test(t)) return `(${t})`;
    return /\s/.test(t) ? `"${t}"` : t;
}

/** "@Name", "x.com/Name" or "https://twitter.com/Name/status/1" -> "Name"; null if it isn't a handle. */
export function cleanHandle(value) {
    const s = String(value ?? '').trim()
        .replace(/^https?:\/\//i, '')
        .replace(/^(www\.|mobile\.)?(x|twitter)\.com\//i, '')
        .replace(/^@/, '')
        .split(/[/?#]/)[0];
    return HANDLE.test(s) ? s : null;
}

/** A trend name as a search: hashtags as they are, anything else as an exact phrase. */
export function trendTerms(name) {
    const t = String(name).replace(/"/g, '').trim();
    return /^[#$]\S+$/.test(t) ? t : `"${t}"`;
}

/**
 * @returns {{ queries: { label: string, query: string, source: 'topic'|'accounts'|'trend' }[], problems: { label: string, error: string }[] }}
 */
export function buildQueries({ topics = [], accounts = [], trends = [] }, filters) {
    const ops = filterOperators(filters);
    const queries = [];
    const problems = [];
    const add = (label, terms, source) => {
        const query = `${terms} ${ops}`;
        if (query.length > MAX_QUERY_LENGTH) {
            problems.push({ label, error: `This search is ${query.length} characters with the filters added; X allows ${MAX_QUERY_LENGTH}. Shorten it or split it into two topics.` });
        } else {
            queries.push({ label, query, source });
        }
    };

    for (const topic of topics) add(topic.trim(), topicTerms(topic), 'topic');
    for (const name of trends) add(name, trendTerms(name), 'trend');

    // Accounts go in as few queries as fit, (from:a OR from:b ...), since each query is a separate request.
    const handles = [];
    for (const raw of accounts) {
        const h = cleanHandle(raw);
        if (h) {
            if (!handles.some((x) => x.toLowerCase() === h.toLowerCase())) handles.push(h);
        } else {
            problems.push({ label: String(raw), error: `"${raw}" isn't an X handle. Use the part after x.com/, like "nasa" or "@nasa".` });
        }
    }
    let group = [];
    const flush = () => {
        if (!group.length) return;
        add(group.map((h) => `@${h}`).join(', '), `(${group.map((h) => `from:${h}`).join(' OR ')})`, 'accounts');
        group = [];
    };
    for (const h of handles) {
        const next = [...group, h];
        if (`(${next.map((x) => `from:${x}`).join(' OR ')}) ${ops}`.length > MAX_QUERY_LENGTH) flush();
        group.push(h);
    }
    flush();
    return { queries, problems };
}

// Viral Tweets Tracker: the most-liked, most-shared X posts, videos and articles for topics, accounts or what's trending,
// read through the official X API with the buyer's own Bearer Token. No cookies, no proxies, no X login.
// Every row has a rowType: "post", "trend" (free), or "note"/"error" (never charged).
import { Actor, log } from 'apify';
import { EVENTS, MAX_LOOKBACK_MS, DEADLINE_MARGIN_MS, SEEN_STORE, SEEN_KEY, SEEN_LIMIT, TREND_LOCATIONS } from './config.js';
import { buildQueries } from './query.js';
import { searchRecent, getTrends } from './xapi.js';
import { toPostRow, includesMaps, SORTS } from './post.js';
import { NO_TOKEN_NOTE, emptyRunReason, noteRow, errorRow } from './note.js';

await Actor.init();
const input = (await Actor.getInput()) ?? {};

const int = (v, def, min, max) => {
    const n = Math.floor(Number(v ?? def));
    return Math.min(max, Math.max(min, Number.isFinite(n) ? n : def));
};
const list = (v) => (Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[\n,]/) : []).map((s) => String(s).trim()).filter(Boolean);

const token = String(input.xBearerToken ?? '').trim();
const topics = list(input.topics);
const accounts = list(input.accounts);
const contentType = ['all', 'videos', 'images', 'articles', 'text'].includes(input.contentType) ? input.contentType : 'all';
const minLikes = int(input.minLikes, 500, 0, 10_000_000);
const minReposts = int(input.minReposts, 0, 0, 10_000_000);
const minReplies = int(input.minReplies, 0, 0, 10_000_000);
const sinceHours = int(input.sinceHours, 24, 1, 168);
const language = /^[a-z]{2,3}$/i.test(String(input.language ?? '').trim()) ? String(input.language).trim().toLowerCase() : null;
const includeReplies = input.includeReplies === true;
const verifiedOnly = input.verifiedOnly === true;
const maxPostsPerSearch = int(input.maxPostsPerSearch, 20, 10, 500);
const sortBy = SORTS[input.sortBy] ? input.sortBy : 'engagements';
const withAuthors = input.includeAuthorDetails !== false;
const onlyNew = input.onlyNew === true;
const trendsLocation = TREND_LOCATIONS[input.trendsLocation] ? input.trendsLocation : 'worldwide';
const trendCount = int(input.trendCount, 5, 1, 20);
const filters = { contentType, minLikes, minReposts, minReplies, language, includeReplies, verifiedOnly };

async function stop(row, status) {
    await Actor.pushData(row);
    await Actor.setStatusMessage(status, { isStatusMessageTerminal: true });
    await Actor.exit();
}

if (!token) await stop(noteRow(NO_TOKEN_NOTE), 'Add your X API Bearer Token to search X; nothing was searched or charged.');
if (input.language && !language) {
    await stop(errorRow(`"${input.language}" isn't a language code. Use a two-letter code like "en", "es" or "ja", or leave it empty for every language.`),
        'Unknown language code; nothing searched or charged.');
}

// The run's time limit (set by whoever started it). New searches stop this long before it, so what was read is saved.
const timeoutAt = Actor.getEnv().timeoutAt;
const deadline = timeoutAt ? new Date(timeoutAt).getTime() - DEADLINE_MARGIN_MS : Infinity;
let timeRanOut = false;
const nearDeadline = () => {
    if (Date.now() > deadline) timeRanOut = true;
    return timeRanOut;
};

// 1. What to search: the topics and accounts given, or else what's trending in the chosen place.
let trends = [];
if (!topics.length && !accounts.length) {
    const place = TREND_LOCATIONS[trendsLocation];
    try {
        trends = await getTrends(place.woeid, trendCount, { token, deadline });
    } catch (err) {
        await stop(errorRow(`Couldn't read X's trends for ${place.name}: ${err.message}`), `Trends unavailable: ${err.message}`);
    }
    if (!trends.length) await stop(noteRow(`X listed no trends for ${place.name} right now. Run again later, or give topics or accounts.`), 'No trends listed; nothing charged.');
    log.info(`No topics or accounts given, so searching the top ${trends.length} trends in ${place.name}: ${trends.map((t) => t.name).join(', ')}`);
    const foundAt = new Date().toISOString();
    await Actor.pushData(trends.map((t, i) => ({ rowType: 'trend', rank: i + 1, trend: t.name, postCount: t.postCount, location: place.name, foundAt })));
}
const { queries, problems } = buildQueries({ topics, accounts, trends: trends.map((t) => t.name) }, filters);
for (const p of problems) await Actor.pushData(errorRow(p.error, p.label));

// 2. Search. Posts are collected, deduplicated across searches, then sorted and saved together.
const seenStore = onlyNew ? await Actor.openKeyValueStore(SEEN_STORE) : null;
const seenBefore = new Set(seenStore ? (await seenStore.getValue(SEEN_KEY)) ?? [] : []);
const startTime = new Date(Date.now() - Math.min(sinceHours * 3600e3, MAX_LOOKBACK_MS)).toISOString();
const stats = { searched: 0, failed: 0, read: 0, authors: 0, skippedSeen: 0, notArticles: 0 };
const rows = new Map();
let fatal = null;
const now = Date.now();

for (const q of queries) {
    if (fatal || nearDeadline()) break;
    stats.searched++;
    log.info(`Searching "${q.label}": ${q.query}`);
    try {
        for await (const page of searchRecent(q.query, { token, max: maxPostsPerSearch, startTime, sortOrder: 'relevancy', withAuthors, deadline, shouldStop: nearDeadline })) {
            const maps = includesMaps(page.includes);
            stats.read += page.data.length;
            stats.authors += maps.users.size;
            for (const post of page.data) {
                if (rows.has(post.id)) continue;
                if (seenBefore.has(post.id)) {
                    stats.skippedSeen++;
                    continue;
                }
                const row = toPostRow(post, maps, { topic: q.label, now });
                if (contentType === 'articles' && row.kind !== 'article' && row.kind !== 'link') {
                    stats.notArticles++;
                    continue;
                }
                rows.set(post.id, row);
            }
        }
    } catch (err) {
        log.warning(`"${q.label}": ${err.message}`);
        await Actor.pushData(errorRow(err.message, q.label));
        stats.failed++;
        if (err.fatal || err.rateLimited) fatal = err;
    }
}

// 3. Save, best first by the chosen measure.
const foundAt = new Date().toISOString();
let saved = 0;
for (const row of [...rows.values()].sort(SORTS[sortBy])) {
    const result = await Actor.pushData({ ...row, foundAt }, EVENTS.post);
    saved++;
    if (result?.eventChargeLimitReached) {
        log.warning('The run reached its maximum cost (set by the user); stopping.');
        break;
    }
}
if (seenStore && saved) {
    const ids = [...seenBefore, ...[...rows.keys()]].slice(-SEEN_LIMIT);
    await seenStore.setValue(SEEN_KEY, ids);
}

const readFromX = stats.read
    ? `Read from X: ${stats.read} posts${withAuthors ? `, ${stats.authors} author profiles` : ''}, billed to your X developer account.`
    : 'Nothing was read from X.';
if (saved === 0) {
    const note = fatal
        ? `Nothing was saved: ${fatal.message}`
        : timeRanOut && stats.read === 0
        ? "The run's time limit was reached before X returned any posts. Run again with a longer time limit."
        : emptyRunReason(stats, { sinceHours, minLikes, contentType });
    await stop(noteRow(note, { stats }), `${note} ${readFromX}`);
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const summary = `Saved ${plural(saved, 'viral post')} from ${plural(stats.searched, 'search')} (last ${sinceHours} h, ${minLikes}+ likes). ${readFromX}`
    + `${fatal ? ` Stopped early: ${fatal.message}` : ''}`
    + `${timeRanOut ? " Stopped early to finish within the run's time limit; run again with a longer limit for more." : ''}`;
log.info(summary);
await Actor.setStatusMessage(summary);
await Actor.exit();

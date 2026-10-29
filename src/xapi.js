// The official X API v2, called with the buyer's own Bearer Token. The token is only ever sent to api.x.com and never
// logged. X bills the buyer's developer account for what each call returns.
import { log } from 'apify';
import { API, USER_AGENT } from './config.js';

export const POST_FIELDS = 'created_at,public_metrics,author_id,lang,entities,attachments,note_tweet,article,possibly_sensitive,referenced_tweets';
export const MEDIA_FIELDS = 'type,url,preview_image_url,duration_ms,public_metrics,variants,width,height,alt_text';
export const USER_FIELDS = 'username,name,verified,verified_type,public_metrics,profile_image_url';

/** A refusal from X. `fatal` ones (bad token, no credits, no access) stop the run; others only skip one search. */
export class XApiError extends Error {
    constructor(message, { status = null, fatal = false, rateLimited = false } = {}) {
        super(message);
        this.status = status;
        this.fatal = fatal;
        this.rateLimited = rateLimited;
    }
}

/** X's own words from an error body, which comes in a few shapes. */
export function xDetail(body) {
    if (!body || typeof body !== 'object') return '';
    return body.detail ?? body.errors?.[0]?.message ?? body.errors?.[0]?.detail ?? body.title ?? body.reason ?? '';
}

/** What an HTTP error from X means for the buyer. */
export function explainStatus(status, body) {
    const said = xDetail(body);
    const quote = said ? ` X said: "${said}"` : '';
    if (status === 401) {
        return new XApiError(`X rejected the Bearer Token (401).${quote} Copy it again from your app's "Keys and tokens" page in the X Developer Console.`, { status, fatal: true });
    }
    if (status === 402) {
        return new XApiError(`Your X developer account is out of credits (402).${quote} Add credits in the X Developer Console, then run again.`, { status, fatal: true });
    }
    if (status === 403) {
        return new XApiError(`X refused access (403).${quote} The token's app needs read access to posts (pay-per-use or a paid plan); the free plan can't search.`, { status, fatal: true });
    }
    if (status === 400) return new XApiError(`X couldn't run this search (400).${quote}`, { status });
    return new XApiError(`X answered ${status}.${quote}`, { status });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * GET one X API endpoint. Server errors and network failures get 3 more tries. A rate limit is waited out when X's
 * reset time comes before `deadline` (a timestamp in ms); otherwise it throws.
 */
export async function xGet(path, params, token, { deadline = Infinity } = {}) {
    const url = new URL(`${API}${path}`);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    let lastError;
    let rateWaits = 0;
    for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt) await sleep(2000 * 2 ** (attempt - 1));
        let res;
        try {
            res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(30_000) });
        } catch (err) {
            lastError = new XApiError(`Couldn't reach api.x.com: ${err.message}`);
            continue;
        }
        const body = await res.json().catch(() => null);
        if (res.ok) return body;
        if (res.status === 429) {
            const reset = Number(res.headers.get('x-rate-limit-reset')) * 1000;
            const wait = Math.max(5000, (Number.isFinite(reset) && reset > 0 ? reset - Date.now() : 60_000) + 1000);
            if (rateWaits++ < 3 && Date.now() + wait < deadline && wait < 16 * 60_000) {
                log.warning(`X's rate limit was reached; waiting ${Math.ceil(wait / 1000)} s for it to reset.`);
                await sleep(wait);
                attempt--; // a rate-limit wait isn't a failed try
                continue;
            }
            throw new XApiError("X's rate limit was reached and doesn't reset before this run's time limit. Run again in 15 minutes.", { status: 429, rateLimited: true });
        }
        if (res.status >= 500) {
            lastError = explainStatus(res.status, body);
            continue;
        }
        throw explainStatus(res.status, body);
    }
    throw lastError;
}

/**
 * Recent search, page by page, until `max` posts or the last page.
 * Yields { data, includes } per page.
 */
export async function* searchRecent(query, { token, max, startTime, sortOrder, withAuthors, deadline, shouldStop = () => false }) {
    let nextToken;
    let read = 0;
    do {
        const pageSize = Math.min(100, Math.max(10, max - read));
        const body = await xGet('/tweets/search/recent', {
            query,
            max_results: pageSize,
            sort_order: sortOrder,
            start_time: startTime,
            next_token: nextToken,
            'tweet.fields': POST_FIELDS,
            expansions: withAuthors ? 'author_id,attachments.media_keys' : 'attachments.media_keys',
            'media.fields': MEDIA_FIELDS,
            'user.fields': withAuthors ? USER_FIELDS : undefined,
        }, token, { deadline });
        const data = body?.data ?? [];
        read += data.length;
        yield { data, includes: body?.includes ?? {} };
        nextToken = body?.meta?.next_token;
    } while (nextToken && read < max && !shouldStop());
}

/** Trending topics for one place: [{ name, postCount }] in X's order. */
export async function getTrends(woeid, count, { token, deadline }) {
    const body = await xGet(`/trends/by/woeid/${woeid}`, { max_trends: count, 'trend.fields': 'trend_name,tweet_count' }, token, { deadline });
    return (body?.data ?? []).filter((t) => t.trend_name).map((t) => ({ name: t.trend_name, postCount: t.tweet_count ?? null }));
}

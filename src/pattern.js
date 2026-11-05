// What a post looks like, for people studying why it went viral: the opening line, its length and shape, and when it
// went out. Plain counts from the text, no guessing at meaning. PATTERNS sums them up per run (2026-11-05).

const URL_RE = /https?:\/\/\S+/g;
const LIST_LINE = /^\s*(?:[-•*▪→>]|\d{1,2}[.)/]|\d{1,2}\s?[-:])\s*\S/;
// "🧵", the word "thread", or a "1/" or "(1/5)" counter mark a post that opens a thread.
const THREAD_MARK = /🧵|\bthread\b|(^|\s)1\/\d*(\s|$)|\(1\/\d+\)/i;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const words = (s) => s.split(/\s+/).filter(Boolean).length;

/** Text as a reader sees it: links removed, whitespace tidied. */
function readable(text) {
    return String(text ?? '').replace(URL_RE, '').replace(/[ \t]+/g, ' ').trim();
}

/**
 * @param {string} text the post's full text (note_tweet text for long posts)
 * @param {string} createdAt ISO time the post went out
 * @param {{ isLongPost?: boolean }} [extra]
 */
export function postPattern(text, createdAt, { isLongPost = false } = {}) {
    const body = readable(text);
    const lines = body.split('\n').map((l) => l.trim()).filter(Boolean);
    const hook = lines[0] ?? '';
    const at = new Date(createdAt);
    const valid = !Number.isNaN(at.getTime());
    return {
        hook,
        hookWords: words(hook),
        charCount: [...body].length,
        wordCount: words(body),
        lineCount: lines.length,
        listItems: lines.filter((l) => LIST_LINE.test(l)).length,
        hasQuestion: body.includes('?'),
        hookHasNumber: /\d/.test(hook),
        threadMarker: THREAD_MARK.test(body),
        isLongPost: Boolean(isLongPost),
        postedHourUtc: valid ? at.getUTCHours() : null,
        postedWeekdayUtc: valid ? WEEKDAYS[at.getUTCDay()] : null,
    };
}

const median = (xs) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : Math.round(((s[m - 1] + s[m]) / 2) * 10) / 10;
};
const share = (n, total) => (total ? Math.round((n / total) * 1000) / 1000 : 0);

/** One run's posts summed up: which formats, lengths and hours the saved viral posts share. */
export function summarizePatterns(rows) {
    const total = rows.length;
    const byKind = {};
    for (const r of rows) {
        const k = (byKind[r.kind] ??= { posts: 0, likes: [] });
        k.posts++;
        k.likes.push(r.likes);
    }
    const hours = {};
    for (const r of rows) if (r.postedHourUtc != null) hours[r.postedHourUtc] = (hours[r.postedHourUtc] ?? 0) + 1;
    return {
        posts: total,
        kinds: Object.fromEntries(Object.entries(byKind)
            .sort((a, b) => b[1].posts - a[1].posts)
            .map(([kind, k]) => [kind, { posts: k.posts, share: share(k.posts, total), medianLikes: median(k.likes) }])),
        medianChars: median(rows.map((r) => r.charCount)),
        medianLines: median(rows.map((r) => r.lineCount)),
        medianHookWords: median(rows.map((r) => r.hookWords)),
        withQuestion: share(rows.filter((r) => r.hasQuestion).length, total),
        withList: share(rows.filter((r) => r.listItems >= 3).length, total),
        hookWithNumber: share(rows.filter((r) => r.hookHasNumber).length, total),
        threadOpeners: share(rows.filter((r) => r.threadMarker).length, total),
        longPosts: share(rows.filter((r) => r.isLongPost).length, total),
        busiestHoursUtc: Object.entries(hours).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h, n]) => ({ hourUtc: Number(h), posts: n })),
    };
}

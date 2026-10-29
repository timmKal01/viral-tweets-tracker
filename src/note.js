// Rows that aren't posts. A run never ends with an empty dataset: it says why nothing was saved, in one row that is
// never charged, so a person, script or AI agent can tell "nothing was viral enough" from "something broke".

export const NOTE_NAME = 'No viral posts saved in this run (not charged)';

export const NO_TOKEN_NOTE = 'This actor reads X through the official X API, so it needs your own X API Bearer Token in the "X API Bearer Token" field. '
    + 'Get one at console.x.com: create an app, add credits (pay-per-use), then copy the Bearer Token from the app\'s "Keys and tokens" page. '
    + 'Nothing was searched or charged in this run.';

/**
 * Why a run that searched saved nothing.
 * @param {{ read: number, skippedSeen: number, notArticles: number, failed: number, searched: number }} stats
 * @param {{ sinceHours: number, minLikes: number, contentType: string }} input
 */
export function emptyRunReason(stats, input) {
    if (stats.searched === 0) return 'No search ran. See the error rows for what X refused.';
    if (stats.read === 0) {
        const bar = input.minLikes > 0 ? ` with at least ${input.minLikes} likes` : '';
        const what = input.contentType === 'all' ? 'posts' : input.contentType;
        const failed = stats.failed ? ` (${stats.failed} of ${stats.searched} searches failed; see the error rows)` : '';
        return `X found no ${what} from the last ${input.sinceHours} hours${bar} for these searches${failed}. Lower minLikes, raise sinceHours (up to 168) or try broader topics.`;
    }
    const parts = [];
    if (stats.skippedSeen) parts.push(`${stats.skippedSeen} were already returned by earlier runs (onlyNew is on)`);
    if (stats.notArticles) parts.push(`${stats.notArticles} had no X Article or outside link`);
    return `X returned ${stats.read} posts, but none were saved: ${parts.join(', ') || 'none matched'}.`;
}

/** The one row a run saves when it has no posts to return. */
export function noteRow(note, extra = {}) {
    return { rowType: 'note', name: NOTE_NAME, note, ...extra, foundAt: new Date().toISOString() };
}

/** The row for one search, handle or setting that couldn't be used (not charged). */
export function errorRow(error, label = null) {
    return { rowType: 'error', name: "Couldn't run this search (not charged)", matchedTopic: label, error, foundAt: new Date().toISOString() };
}

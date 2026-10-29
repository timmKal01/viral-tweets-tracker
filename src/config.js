export const EVENTS = { post: 'viral-post' };

export const API = 'https://api.x.com/2';
export const USER_AGENT = 'viral-tweets-tracker/0.1 (+https://apify.com/m_ctim/viral-tweets-tracker)';

// X's limit on one recent-search query for self-serve access (pay-per-use).
export const MAX_QUERY_LENGTH = 512;
// Recent search only reaches back 7 days; a minute is kept spare so start_time is never refused as too old.
export const MAX_LOOKBACK_MS = 7 * 24 * 3600e3 - 60e3;

// New searches stop this long before the run's time limit, so the posts already read are sorted and saved.
export const DEADLINE_MARGIN_MS = 30_000;

// onlyNew: the posts earlier runs returned, kept in the buyer's own named key-value store.
export const SEEN_STORE = 'viral-tweets-tracker-seen';
export const SEEN_KEY = 'post-ids';
export const SEEN_LIMIT = 20_000;

// X's trend locations are Yahoo WOEIDs. The ones offered here were each checked against the trends endpoint.
export const TREND_LOCATIONS = {
    worldwide: { name: 'Worldwide', woeid: 1 },
    us: { name: 'United States', woeid: 23424977 },
    uk: { name: 'United Kingdom', woeid: 23424975 },
    canada: { name: 'Canada', woeid: 23424775 },
    australia: { name: 'Australia', woeid: 23424748 },
    india: { name: 'India', woeid: 23424848 },
    nigeria: { name: 'Nigeria', woeid: 23424908 },
    kenya: { name: 'Kenya', woeid: 23424863 },
    south_africa: { name: 'South Africa', woeid: 23424942 },
    germany: { name: 'Germany', woeid: 23424829 },
    france: { name: 'France', woeid: 23424819 },
    spain: { name: 'Spain', woeid: 23424950 },
    brazil: { name: 'Brazil', woeid: 23424768 },
    mexico: { name: 'Mexico', woeid: 23424900 },
    japan: { name: 'Japan', woeid: 23424856 },
    philippines: { name: 'Philippines', woeid: 23424934 },
};

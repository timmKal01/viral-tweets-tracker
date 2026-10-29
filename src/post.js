// One post from X's recent search (with its author and media from `includes`) -> one output row, with the numbers
// people use to judge how viral it is.

const X_HOSTS = /^(www\.|mobile\.)?(x|twitter)\.com$/i;
const X_ARTICLE = /^https?:\/\/(www\.)?(x|twitter)\.com\/i\/article\//i;

const round = (n, digits) => Math.round(n * 10 ** digits) / 10 ** digits;

function hostOf(url) {
    try {
        return new URL(url).hostname;
    } catch {
        return null;
    }
}

/** The highest-bitrate MP4 of a video, if X lists one. */
export function bestMp4(variants = []) {
    const mp4 = variants.filter((v) => v.content_type === 'video/mp4' && v.url);
    mp4.sort((a, b) => (b.bit_rate ?? 0) - (a.bit_rate ?? 0));
    return mp4[0]?.url ?? null;
}

/**
 * @param {object} post a post object from X API v2
 * @param {{ users: Map<string, object>, media: Map<string, object> }} includes
 * @param {{ topic: string, now?: number }} ctx
 */
export function toPostRow(post, { users, media }, { topic, now = Date.now() }) {
    const author = users.get(post.author_id) ?? null;
    const m = post.public_metrics ?? {};
    const likes = m.like_count ?? 0;
    const reposts = m.retweet_count ?? 0;
    const replies = m.reply_count ?? 0;
    const quotes = m.quote_count ?? 0;
    const bookmarks = m.bookmark_count ?? 0;
    const views = m.impression_count ?? null;
    const engagements = likes + reposts + replies + quotes + bookmarks;
    // At least six minutes old, so a post seconds old doesn't get an absurd per-hour rate.
    const ageHours = Math.max(0.1, (now - Date.parse(post.created_at)) / 3.6e6);
    const followers = author?.public_metrics?.followers_count ?? null;

    const attached = (post.attachments?.media_keys ?? []).map((k) => media.get(k)).filter(Boolean);
    const video = attached.find((x) => x.type === 'video' || x.type === 'animated_gif') ?? null;
    const images = attached.filter((x) => x.type === 'photo' && x.url).map((x) => x.url);

    // Links that leave X (media and quoted-post links don't count), with the title X read from the page when it has one.
    const urls = post.entities?.urls ?? [];
    const links = urls
        .filter((u) => !u.media_key)
        .map((u) => ({ url: u.unwound_url ?? u.expanded_url ?? u.url, title: u.title ?? null, description: u.description ?? null }))
        .filter((u) => u.url && (!X_HOSTS.test(hostOf(u.url) ?? '') || X_ARTICLE.test(u.url)));
    const articleLink = links.find((u) => X_ARTICLE.test(u.url));
    const outsideLinks = links.filter((u) => u !== articleLink);
    const article = post.article || articleLink
        ? { title: post.article?.title ?? articleLink?.title ?? null, previewText: post.article?.preview_text ?? null, url: articleLink?.url ?? null }
        : null;

    const kind = article ? 'article' : video ? 'video' : outsideLinks.length ? 'link' : images.length ? 'image' : 'text';
    const quoted = post.referenced_tweets?.find((r) => r.type === 'quoted')?.id ?? null;
    const repliedTo = post.referenced_tweets?.find((r) => r.type === 'replied_to')?.id ?? null;

    return {
        rowType: 'post',
        url: author ? `https://x.com/${author.username}/status/${post.id}` : `https://x.com/i/status/${post.id}`,
        id: post.id,
        kind,
        text: post.note_tweet?.text ?? post.text,
        createdAt: post.created_at,
        ageHours: round(ageHours, 1),
        likes,
        reposts,
        replies,
        quotes,
        bookmarks,
        views,
        engagements,
        engagementRate: views ? round(engagements / views, 4) : null,
        likesPerHour: round(likes / ageHours, 1),
        viewsPerFollower: views && followers ? round(views / followers, 2) : null,
        authorUsername: author?.username ?? null,
        authorName: author?.name ?? null,
        authorFollowers: followers,
        authorVerified: author ? Boolean(author.verified) : null,
        authorVerifiedType: author?.verified_type ?? null,
        authorAvatarUrl: author?.profile_image_url ?? null,
        videoViews: video?.public_metrics?.view_count ?? null,
        videoDurationSec: video?.duration_ms ? round(video.duration_ms / 1000, 1) : null,
        videoUrl: video ? bestMp4(video.variants) : null,
        videoPreviewUrl: video?.preview_image_url ?? null,
        images,
        articleTitle: article?.title ?? null,
        article,
        links: outsideLinks,
        hashtags: (post.entities?.hashtags ?? []).map((h) => h.tag),
        mentions: (post.entities?.mentions ?? []).map((x) => x.username),
        lang: post.lang ?? null,
        isQuote: Boolean(quoted),
        quotedPostUrl: quoted ? `https://x.com/i/status/${quoted}` : null,
        isReply: Boolean(repliedTo),
        possiblySensitive: Boolean(post.possibly_sensitive),
        matchedTopic: topic,
    };
}

/** Lookup maps from a search page's `includes`. */
export function includesMaps(includes = {}) {
    return {
        users: new Map((includes.users ?? []).map((u) => [u.id, u])),
        media: new Map((includes.media ?? []).map((x) => [x.media_key, x])),
    };
}

export const SORTS = {
    engagements: (a, b) => b.engagements - a.engagements,
    views: (a, b) => (b.views ?? -1) - (a.views ?? -1),
    likes: (a, b) => b.likes - a.likes,
    likesPerHour: (a, b) => b.likesPerHour - a.likesPerHour,
    newest: (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
};

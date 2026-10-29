# Viral Tweets Tracker: X (Twitter) Posts, Videos & Articles

Find the X posts that are taking off: give topics, accounts, or nothing at all to use what's trending. You get each viral post with its likes, reposts, replies, quotes, bookmarks and views, its engagement rate and likes per hour, its author's followers, and any video file, images, article or links in it.

It runs on the **official X API with your own X API key**. You never hand over an X login, cookies or a password, and no proxies are used, so there's no account to get banned.

**Who it's for:** social media managers and creators looking for what's working in their niche, marketers and PR teams watching a brand, a competitor or a launch, and newsrooms and researchers tracking what's spreading.

## Example output

A real row from a run on 2026-10-29 that watched the NASA and SpaceX accounts with the default 500-like minimum. It returned 3 posts from the last 24 hours, and this video led them.

```json
{
    "rowType": "post",
    "url": "https://x.com/SpaceX/status/2115476295169814978",
    "id": "2115476295169814978",
    "kind": "video",
    "text": "Ship 42 static fires complete. The Starship preparing for Flight 15 performed a full duration, six-engine static fire, and fired a single Raptor engine to simulate a deorbit burn https://t.co/I7Ip89Bmey",
    "createdAt": "2026-10-28T16:10:27.000Z",
    "ageHours": 20.1,
    "likes": 17631,
    "reposts": 2136,
    "replies": 711,
    "quotes": 380,
    "bookmarks": 830,
    "views": 1854564,
    "engagements": 21688,
    "engagementRate": 0.0117,
    "likesPerHour": 875.4,
    "viewsPerFollower": 0.04,
    "authorUsername": "SpaceX",
    "authorName": "SpaceX",
    "authorFollowers": 41941527,
    "authorVerified": true,
    "authorVerifiedType": "business",
    "videoViews": 616776,
    "videoDurationSec": 77.3,
    "videoUrl": "https://video.twimg.com/amplify_video/2115475875122569216/vid/avc1/3840x2160/v5qIS5iJcnND9emk.mp4",
    "videoPreviewUrl": "https://pbs.twimg.com/amplify_video_thumb/2115475875122569216/img/05QhG1ixlpBhow6m.jpg",
    "images": [],
    "articleTitle": null,
    "links": [],
    "hashtags": [],
    "lang": "en",
    "isQuote": false,
    "isReply": false,
    "matchedTopic": "@NASA, @SpaceX",
    "foundAt": "2026-10-29T12:18:49.857Z"
}
```

A search for "AI agents" in articles-only mode the same day kept 7 of the 10 posts X returned. Each one linked to a page outside X, and the row carries that page's title and description as X read them.

## What you get in each row

| Field | What it is |
|---|---|
| `url`, `id`, `text` | The post's link, ID and full text (long posts included) |
| `kind` | `video`, `image`, `article` (an X Article), `link` (links outside X) or `text` |
| `likes`, `reposts`, `replies`, `quotes`, `bookmarks`, `views` | X's public counts at the time of the run |
| `engagements` | Likes + reposts + replies + quotes + bookmarks |
| `engagementRate` | Engagements divided by views |
| `likesPerHour` | Likes divided by the post's age in hours: how fast it's rising |
| `viewsPerFollower` | Views divided by the author's followers: how far past its own audience it travelled |
| `authorUsername`, `authorName`, `authorFollowers`, `authorVerified`, `authorVerifiedType` | Who posted it |
| `videoViews`, `videoDurationSec`, `videoUrl`, `videoPreviewUrl` | For videos: X's view count, length, the highest-quality MP4 and the thumbnail |
| `images` | Image URLs |
| `article`, `articleTitle` | X Articles |
| `links` | Links outside X, with the page title and description when X has them |
| `hashtags`, `mentions`, `lang`, `isQuote`, `quotedPostUrl`, `isReply`, `possiblySensitive` | The rest of what X says about the post |
| `matchedTopic` | Which topic, trend or account group found it |

Every row has a `rowType`:
- **`post`:** a viral post.
- **`trend`:** one of X's trending topics, when the run searched trends. These rows are free.
- **`note`:** the run has nothing to return, and the row says why.
- **`error`:** one search or setting couldn't be used, and the row says why.

Notes and errors are never charged.

## Input

1. **X API Bearer Token.** At [console.x.com](https://console.x.com), create an app, add pay-per-use credits, and copy the Bearer Token from the app's "Keys and tokens" page. Paste it in once; Apify stores it encrypted.
2. **What to search.** Choose one of these:
   - **Topics:** keywords, #hashtags, $cashtags or exact phrases. You can also use your own X search query with OR, quotes or operators such as `url:`.
   - **Accounts:** handles to watch.
   - **Nothing:** the run then searches the top trends in the place you pick, from 16 places including Worldwide, the US, the UK, India, Nigeria, Kenya, Brazil and Japan.
3. **What counts as viral.** By default, at least 500 likes in the last 24 hours. Set minimum likes, reposts and replies, a window of up to 7 days, a language, verified accounts only, and videos, images, articles or text only.

```json
{
    "xBearerToken": "your token",
    "topics": ["AI agents", "#buildinpublic"],
    "minLikes": 500,
    "sinceHours": 24,
    "contentType": "all",
    "maxPostsPerSearch": 20,
    "sortBy": "engagements"
}
```

For a daily digest, schedule the run and turn on **Only posts not returned before**. Each run then returns only posts that earlier runs haven't.

## Pricing

**$0.002 per viral post saved** ($2 per 1,000). Trends, notes, errors, and posts skipped by "only new" or the articles filter are free.

**X also bills your X developer account** for what its API returns: $0.005 per post and $0.010 per user profile (X's published pay-per-use prices, October 2026). X counts a post once per UTC day, so reading it again that day isn't billed again. Three settings keep that bill down:
- **The like, repost and reply minimums go into the search itself,** so X never returns posts below them.
- **Max posts per search** caps how many posts each search returns.
- **Include author details** can be turned off when you don't need follower counts.

## How it works

1. Each topic, trend or group of accounts becomes one X recent-search query. That query leaves out reposts and ads, and leaves out replies unless you include them. It also carries your minimums, such as `min_likes:500`.
2. X returns its most relevant matches first, up to your max posts per search, with each post's counts, media and author.
3. Posts found by more than one search are kept once. All of them are then sorted by your chosen measure: engagements, views, likes, likes per hour, or newest.
4. Searches stop 30 seconds before the run's time limit, so a short limit returns what was found rather than timing out. X's rate limit (300 searches per 15 minutes per token) is waited out when it resets in time.

## Good to know

- **Recent only:** X's recent search covers the last 7 days.
- **X picks the matches,** as in its own search box. A post can match through a quoted post or its long text.
- **Reposts:** never returned as rows. You get the original post, with all its counts.
- **Trends:** worldwide trends are often in many languages, so set a language to keep one. X sometimes leaves out a trend's post count.
- **Errors:** a bad token, an account with no credits, or an app without read access stops the run with an error row saying which one. Posts already found are still saved.
- **Your key:** it stays in your Apify account. It's sent only to api.x.com and never logged.

## Data and terms

Posts come from the X API under your own X developer account. Using them within X's Developer Agreement and Policy is up to you.

## Related tools

- [Hacker News Mention Tracker by Keyword](https://apify.com/m_ctim/hacker-news-keyword-tracker): what's taking off on Hacker News.
- [Blog & RSS Feed Monitor: New Post Alerts](https://apify.com/m_ctim/rss-feed-tracker): new posts from any blog or news feed.

Found a problem or want a field added? Open an issue on the Issues tab.

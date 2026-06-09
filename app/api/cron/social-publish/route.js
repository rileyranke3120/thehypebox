import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { safeCompare } from '@/lib/safe-compare';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const GRAPH_VERSION = 'v19.0';

// ─── Facebook ─────────────────────────────────────────────────────────────────

async function postToFacebook(content, hashtags) {
  const pageId = process.env.FB_PAGE_ID;
  const token  = process.env.META_ACCESS_TOKEN;
  if (!pageId || !token) throw new Error('FB_PAGE_ID or META_ACCESS_TOKEN not configured');

  const message = hashtags.length
    ? `${content}\n\n${hashtags.join(' ')}`
    : content;

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/feed`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, access_token: token }),
      signal: AbortSignal.timeout(15000),
    }
  );

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `Facebook API ${res.status}`);
  }
  return data.id;
}

// ─── Instagram ────────────────────────────────────────────────────────────────
// Requires a Page-linked Instagram Business Account and a publicly accessible
// image URL (INSTAGRAM_IMAGE_URL) because the Graph API does not support
// text-only posts — an image or video is mandatory.

async function getInstagramBusinessId(pageId, token) {
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}` +
    `?fields=instagram_business_account&access_token=${token}`,
    { signal: AbortSignal.timeout(10000) }
  );
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message ?? `Graph API ${res.status}`);
  const igId = data.instagram_business_account?.id;
  if (!igId) throw new Error('No Instagram Business Account linked to this Facebook Page');
  return igId;
}

async function postToInstagram(content, hashtags) {
  const pageId   = process.env.FB_PAGE_ID;
  const token    = process.env.META_ACCESS_TOKEN;
  const imageUrl = process.env.INSTAGRAM_IMAGE_URL;

  if (!pageId || !token) throw new Error('FB_PAGE_ID or META_ACCESS_TOKEN not configured');
  if (!imageUrl) throw new Error('INSTAGRAM_IMAGE_URL not set — host a branded background image and add this env var');

  const igUserId = await getInstagramBusinessId(pageId, token);
  const caption  = hashtags.length
    ? `${content}\n\n${hashtags.join(' ')}`
    : content;

  // Step 1: create media container
  const mediaRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption, image_url: imageUrl, access_token: token }),
      signal: AbortSignal.timeout(15000),
    }
  );
  const mediaData = await mediaRes.json();
  if (!mediaRes.ok || mediaData.error) {
    throw new Error(mediaData.error?.message ?? `Instagram media create ${mediaRes.status}`);
  }

  // Step 2: publish container
  const pubRes = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: mediaData.id, access_token: token }),
      signal: AbortSignal.timeout(15000),
    }
  );
  const pubData = await pubRes.json();
  if (!pubRes.ok || pubData.error) {
    throw new Error(pubData.error?.message ?? `Instagram publish ${pubRes.status}`);
  }
  return pubData.id;
}

// ─── LinkedIn ─────────────────────────────────────────────────────────────────
// Requires an OAuth 2.0 User/Organization Access Token (60-day expiry by default;
// use the LinkedIn refresh token flow to extend, or set up a monthly rotation).
// LINKEDIN_ORGANIZATION_ID is the numeric ID from your Company Page URL:
//   linkedin.com/company/{org_id}

async function postToLinkedIn(content, hashtags) {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  const orgId = process.env.LINKEDIN_ORGANIZATION_ID;
  if (!token || !orgId) throw new Error('LINKEDIN_ACCESS_TOKEN or LINKEDIN_ORGANIZATION_ID not configured');

  const text = hashtags.length
    ? `${content}\n\n${hashtags.join(' ')}`
    : content;

  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: `urn:li:organization:${orgId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    }),
    signal: AbortSignal.timeout(15000),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message ?? data.serviceErrorCode ?? `LinkedIn API ${res.status}`);
  }
  // LinkedIn returns the URN in the x-linkedin-id response header
  return res.headers.get('x-linkedin-id') ?? data.id ?? 'posted';
}

// ─── Publisher ────────────────────────────────────────────────────────────────

const PUBLISHERS = {
  facebook:  postToFacebook,
  instagram: postToInstagram,
  linkedin:  postToLinkedIn,
};

export async function GET(request) {
  const authHeader = request.headers.get('authorization');

  if (!process.env.CRON_SECRET) {
    console.error('[social-publish] CRON_SECRET not set');
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }
  if (!safeCompare(authHeader ?? '', `Bearer ${process.env.CRON_SECRET ?? ''}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();

  const { data: posts, error: fetchErr } = await supabase
    .from('social_posts')
    .select('*')
    .eq('status', 'approved')
    .order('scheduled_date', { ascending: true });

  if (fetchErr) {
    console.error('[social-publish] DB fetch error:', fetchErr.message);
    return NextResponse.json({ error: 'DB fetch failed', detail: fetchErr.message }, { status: 500 });
  }

  if (!posts?.length) {
    console.log('[social-publish] no approved posts to publish');
    return NextResponse.json({ ok: true, published: 0, failed: 0, skipped: 0 });
  }

  console.log(`[social-publish] found ${posts.length} approved posts`);

  const results = { published: 0, failed: 0, skipped: 0 };

  for (const post of posts) {
    const publisher = PUBLISHERS[post.platform];

    if (!publisher) {
      console.warn(`[social-publish] no publisher for platform: ${post.platform}`);
      await supabase
        .from('social_posts')
        .update({ status: 'skipped', error_message: 'No publisher for this platform' })
        .eq('id', post.id);
      results.skipped++;
      continue;
    }

    try {
      const platformPostId = await publisher(post.content, post.hashtags ?? []);
      await supabase
        .from('social_posts')
        .update({
          status: 'posted',
          posted_at: new Date().toISOString(),
          platform_post_id: String(platformPostId),
          error_message: null,
        })
        .eq('id', post.id);
      console.log(`[social-publish] ✓ ${post.platform} run_id=${post.run_id} → ${platformPostId}`);
      results.published++;
    } catch (err) {
      console.error(`[social-publish] ✗ ${post.platform} run_id=${post.run_id}:`, err.message);
      // Keep status=approved so it retries next run after credentials are fixed
      await supabase
        .from('social_posts')
        .update({ error_message: err.message })
        .eq('id', post.id);
      results.failed++;
    }
  }

  return NextResponse.json({ ok: true, ...results });
}

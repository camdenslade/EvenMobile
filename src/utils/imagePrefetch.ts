//********************************************************************
//
// Image Prefetching Utilities
//
// Centralized image prefetching functions for proactive image loading.
// Used to prefetch images after API responses to improve perceived
// performance. All prefetching is non-blocking and opportunistic.
//
// Return Value
// ------------
// Promise<void>    Resolves when prefetch completes (or fails silently)
//
// Value Parameters
// ----------------
// urls       string[]    Array of image URLs to prefetch
// priority  "low"|"normal"|"high"  Prefetch priority (default: "normal")
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// Image     expo-image Image class
//
//*******************************************************************

import { Image } from "expo-image";

/**
 * Prefetch a single image URL
 * @param url Image URL to prefetch
 * @param priority Prefetch priority (default: "normal")
 */
export async function prefetchImage(
  url: string | null | undefined,
  priority: "low" | "normal" | "high" = "normal"
): Promise<void> {
  if (!url || typeof url !== "string") return;
  
  try {
    await Image.prefetch(url, "memory-disk");
  } catch (error) {
    // Silently fail - prefetching is opportunistic
    // Don't log errors to avoid noise
  }
}

/**
 * Prefetch multiple image URLs in parallel
 * @param urls Array of image URLs to prefetch
 * @param priority Prefetch priority (default: "normal")
 * @param maxConcurrent Maximum concurrent prefetches (default: 5)
 * @param maxTotal Maximum total URLs to prefetch (default: 100) - hard cap for safety
 */
export async function prefetchImages(
  urls: (string | null | undefined)[],
  priority: "low" | "normal" | "high" = "normal",
  maxConcurrent: number = 5,
  maxTotal: number = 100
): Promise<void> {
  // Filter, validate, and deduplicate URLs
  const validUrls = urls
    .filter((url): url is string => Boolean(url && typeof url === "string" && url.trim().length > 0))
    .filter((url) => url.startsWith("http://") || url.startsWith("https://")) // Only prefetch remote URLs
    .filter((url, index, self) => self.indexOf(url) === index); // Deduplicate
  
  // Hard cap total URLs
  const cappedUrls = validUrls.slice(0, maxTotal);
  
  if (cappedUrls.length === 0) return;

  // Process in batches to avoid overwhelming the network
  for (let i = 0; i < cappedUrls.length; i += maxConcurrent) {
    const batch = cappedUrls.slice(i, i + maxConcurrent);
    await Promise.allSettled(
      batch.map((url) => prefetchImage(url, priority))
    );
  }
}

/**
 * Prefetch profile photos from a list of profiles
 * @param profiles Array of profiles with photos
 * @param priority Prefetch priority (default: "normal")
 * @param maxPhotosPerProfile Maximum photos to prefetch per profile (default: 3)
 * @param maxTotalProfiles Maximum profiles to process (default: 50) - hard cap for safety
 */
export function prefetchProfilePhotos(
  profiles: Array<{ photos?: (string | null)[]; profileImageUrl?: string | null }>,
  priority: "low" | "normal" | "high" = "normal",
  maxPhotosPerProfile: number = 3,
  maxTotalProfiles: number = 50
): void {
  const urls: string[] = [];
  
  // Cap total profiles processed
  const cappedProfiles = profiles.slice(0, maxTotalProfiles);
  
  for (const profile of cappedProfiles) {
    // Prefetch primary profile image
    if (profile.profileImageUrl && typeof profile.profileImageUrl === "string") {
      urls.push(profile.profileImageUrl);
    }
    
    // Prefetch additional photos (up to maxPhotosPerProfile)
    if (profile.photos && Array.isArray(profile.photos)) {
      const photos = profile.photos
        .filter((p): p is string => Boolean(p && typeof p === "string" && p.trim().length > 0))
        .slice(0, maxPhotosPerProfile);
      urls.push(...photos);
    }
  }
  
  // Deduplicate URLs before prefetching
  const uniqueUrls = Array.from(new Set(urls));
  
  // Prefetch in background (don't await)
  // Hard cap at 150 URLs total (50 profiles * 3 photos max)
  prefetchImages(uniqueUrls, priority, 5, 150).catch(() => {
    // Silently fail
  });
}

/**
 * Prefetch match avatars
 * @param matches Array of matches with profile photos
 * @param priority Prefetch priority (default: "normal")
 * @param maxMatches Maximum matches to prefetch (default: 100) - hard cap for safety
 */
export function prefetchMatchAvatars(
  matches: Array<{ profile?: { photos?: (string | null)[] } }>,
  priority: "low" | "normal" | "high" = "normal",
  maxMatches: number = 100
): void {
  // Cap total matches processed
  const cappedMatches = matches.slice(0, maxMatches);
  
  const urls: (string | null | undefined)[] = cappedMatches.map(
    (match) => match.profile?.photos?.[0]
  );
  
  // Hard cap at maxMatches URLs
  prefetchImages(urls, priority, 5, maxMatches).catch(() => {
    // Silently fail
  });
}


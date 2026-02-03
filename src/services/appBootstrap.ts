//********************************************************************
//
// preloadAppData Function
//
// Preloads all application data at startup to enable instant screen
// population. Fetches profile, matches, chat threads, reviews, review
// summary, swipe queue, and settings in parallel. Stores results in
// Zustand cache. Preloads images for the first 20 profiles in the queue.
// Marks cache as preloaded when complete.
//
// Return Value
// ------------
// Promise<void>
//
// Value Parameters
// ----------------
// None
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// cache              AppCacheState        Zustand cache state
// profile            PromiseSettledResult Response from /profiles/me
// matches            PromiseSettledResult Response from /matches/me
// threads            PromiseSettledResult Response from /chat/threads
// reviews            PromiseSettledResult Response from /reviews/me
// reviewSummary      PromiseSettledResult Response from /reviews/summary/me
// queue              PromiseSettledResult Response from /profiles/queue
// settings           PromiseSettledResult Response from /users/me
// unmessaged         any[]                Filtered matches without messages
// imagesToPreload    string[]             Array of image URLs to preload
// url                string               Image URL in map
// error              Error                Error object if preload fails
//
//*******************************************************************

import { apiGet } from "./apiService";
import { useAppCache } from "./appCache";
import { prefetchProfilePhotos } from "../utils/imagePrefetch";

export async function preloadAppData(token: string | null): Promise<void> {
  // Note: This function is only called when user is authenticated (from AuthLoadingScreen)
  // Token must be provided from AuthContext to ensure auth has hydrated

  if (!token) {
    console.warn("preloadAppData called without token");
    return;
  }

  const cache = useAppCache.getState();

  try {
    const [
      profile,
      matches,
      threads,
      reviews,
      queue,
      settings,
    ] = await Promise.allSettled([
      apiGet("/profiles/me", token),
      apiGet("/matches/me", token),
      apiGet("/chat/threads", token),
      apiGet("/reviews/me", token),
      apiGet("/profiles/queue", token),
      apiGet("/users/me", token), // Only for settings (email, role), not tokens
    ]);

    const failed: string[] = [];

    if (profile.status === "fulfilled" && profile.value) {
      cache.setProfile(profile.value);
    } else if (profile.status === "rejected") {
      failed.push("/profiles/me");
    }

    if (matches.status === "fulfilled" && Array.isArray(matches.value)) {
      const unmessaged = matches.value.filter(
        (m: any) => !m.firstMessageAt || m.firstMessageAt === null
      );
      cache.setMatches(unmessaged);
    } else if (matches.status === "rejected") {
      failed.push("/matches/me");
    }

    if (threads.status === "fulfilled" && Array.isArray(threads.value)) {
      cache.setMessagesThreads(threads.value);
    } else if (threads.status === "rejected") {
      failed.push("/chat/threads");
    }

    if (reviews.status === "fulfilled" && Array.isArray(reviews.value)) {
      cache.setReviews(reviews.value);
    } else if (reviews.status === "rejected") {
      failed.push("/reviews/me");
    }

    // Note: reviewSummary and userSummary (tokens) are now handled by SessionDataContext
    // They are fetched once per session and shared across all screens

    if (queue.status === "fulfilled" && Array.isArray(queue.value)) {
      cache.setQueue(queue.value);
      // Prefetch profile photos using centralized utility
      if (queue.value.length <= 100) {
        prefetchProfilePhotos(queue.value, "high", 3, 20);
      } else {
        console.warn("prefetch skipped: queue too large", { size: queue.value.length });
      }
    } else if (queue.status === "rejected") {
      failed.push("/profiles/queue");
    }

    if (settings.status === "fulfilled" && settings.value) {
      cache.setSettings(settings.value);
    } else if (settings.status === "rejected") {
      failed.push("/users/me");
    }

    if (failed.length) {
      console.warn("preloadAppData partial failure", { failed });
    }

    cache.setPreloaded(true);
  } catch (error) {
    console.error("Failed to preload app data:", error);
    cache.setPreloaded(true);
  }
}

//********************************************************************
//
// refreshAppData Function
//
// Refreshes all application data in the background. Same as preloadAppData
// but intended for silent updates without blocking app startup.
//
// Return Value
// ------------
// Promise<void>
//
// Value Parameters
// ----------------
// None
//
// Reference Parameters
// --------------------
// None
//
// Local Variables
// ---------------
// None
//
//*******************************************************************
export async function refreshAppData(token: string | null): Promise<void> {
  await preloadAppData(token);
}

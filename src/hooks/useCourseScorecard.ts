import { useNostr } from '@nostrify/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import type { CourseScorecard } from '@/lib/courseScorecard';
import {
  COURSE_SCORECARD_KIND,
  buildScorecardTags,
  courseSlug,
  defaultHoles,
} from '@/lib/courseScorecard';
import type { NostrEvent } from '@nostrify/nostrify';

/** Parse a Nostr kind 34477 event into a CourseScorecard */
function parseScorecardEvent(event: NostrEvent): CourseScorecard | null {
  try {
    const getTag = (name: string) => event.tags.find(([n]) => n === name)?.[1];

    const slug = getTag('d');
    const name = getTag('name');
    const holesJson = getTag('holes');

    if (!slug || !name || !holesJson) return null;

    const holes = JSON.parse(holesJson);
    const teesJson = getTag('tees');
    const tees = teesJson ? JSON.parse(teesJson) : [];

    return {
      slug,
      name,
      city: getTag('city'),
      state: getTag('state'),
      country: getTag('country'),
      holes,
      tees,
      publishedBy: event.pubkey,
      updatedAt: event.created_at,
    };
  } catch {
    return null;
  }
}

/**
 * Search for a course scorecard on Nostr by course name.
 * Queries across ALL pubkeys — this is the crowd-sourced library.
 * Returns the most recently updated scorecard for that slug.
 */
export function useCourseScorecard(courseName: string | undefined) {
  const { nostr } = useNostr();

  const slug = courseName ? courseSlug(courseName) : undefined;

  return useQuery({
    queryKey: ['course-scorecard', slug],
    queryFn: async () => {
      if (!slug) return null;

      // Query all pubkeys for this course slug
      const events = await nostr.query([{
        kinds: [COURSE_SCORECARD_KIND],
        '#d': [slug],
        limit: 10,
      }]);

      if (events.length === 0) return null;

      // Sort by created_at descending, return newest
      const sorted = [...events].sort((a, b) => b.created_at - a.created_at);
      return parseScorecardEvent(sorted[0]);
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Search for course scorecards by partial name (for autocomplete).
 * Note: Nostr relays can't do substring search — we fetch recent scorecards
 * and filter client-side. For a personal app this is fine.
 */
export function useCourseSearch(query: string) {
  const { nostr } = useNostr();

  return useQuery({
    queryKey: ['course-search', query.toLowerCase().trim()],
    queryFn: async () => {
      if (query.trim().length < 2) return [];

      // Fetch recent scorecards and filter by name match
      const events = await nostr.query([{
        kinds: [COURSE_SCORECARD_KIND],
        limit: 200,
      }]);

      const seen = new Map<string, CourseScorecard>();

      for (const event of events) {
        const card = parseScorecardEvent(event);
        if (!card) continue;

        const existing = seen.get(card.slug);
        if (!existing || card.updatedAt! > existing.updatedAt!) {
          seen.set(card.slug, card);
        }
      }

      const lowerQuery = query.toLowerCase();
      return Array.from(seen.values())
        .filter((c) => c.name.toLowerCase().includes(lowerQuery))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 10);
    },
    enabled: query.trim().length >= 2,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to publish/update a course scorecard to Nostr.
 * Any user can publish — the newest version wins.
 */
export function usePublishScorecard() {
  const { mutateAsync: publish } = useNostrPublish();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (card: Omit<CourseScorecard, 'slug' | 'publishedBy' | 'updatedAt'> & { slug?: string }) => {
      const slug = card.slug ?? courseSlug(card.name);
      const fullCard: CourseScorecard = { ...card, slug };
      const tags = buildScorecardTags(fullCard);

      await publish({
        kind: COURSE_SCORECARD_KIND,
        content: '',
        tags,
      });

      return fullCard;
    },
    onSuccess: (card) => {
      queryClient.invalidateQueries({ queryKey: ['course-scorecard', card.slug] });
      queryClient.invalidateQueries({ queryKey: ['course-search'] });
    },
  });
}

/** Build a blank scorecard template from just a name */
export function blankScorecard(name: string, location?: { city?: string; state?: string; country?: string }): Omit<CourseScorecard, 'publishedBy' | 'updatedAt'> {
  return {
    slug: courseSlug(name),
    name,
    city: location?.city,
    state: location?.state,
    country: location?.country,
    holes: defaultHoles(),
    tees: [],
  };
}

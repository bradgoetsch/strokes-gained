import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { RoundData, HoleData } from '@/lib/strokesGained';
import { calculateHoleSG, calculateRoundSG } from '@/lib/strokesGained';
import type { NostrEvent } from '@nostrify/nostrify';

export const GOLF_ROUND_KIND = 32823;

/** Parse a Nostr event (kind 32823) into a RoundData object */
export function parseRoundEvent(event: NostrEvent): RoundData | null {
  try {
    const getTag = (name: string) => event.tags.find(([n]) => n === name)?.[1];

    const id = getTag('d');
    const date = getTag('date');
    const courseName = getTag('title');
    const holesJson = getTag('holes');

    if (!id || !date || !courseName || !holesJson) return null;

    const holes: HoleData[] = JSON.parse(holesJson);
    const totalStrokes = holes.reduce((sum, h) => sum + h.shots.length, 0);
    const totalPar = holes.reduce((sum, h) => sum + h.par, 0);

    const sg = calculateRoundSG(holes);

    return {
      id,
      date,
      courseName,
      holes,
      sg,
      totalStrokes,
      totalPar,
    };
  } catch {
    return null;
  }
}

/** Hook to load all golf rounds for the current user */
export function useGolfRounds() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['golf-rounds', user?.pubkey],
    queryFn: async () => {
      if (!user?.pubkey) return [];

      const events = await nostr.query([{
        kinds: [GOLF_ROUND_KIND],
        authors: [user.pubkey],
        limit: 100,
      }]);

      const rounds = events
        .map(parseRoundEvent)
        .filter((r): r is RoundData => r !== null);

      // Sort by date descending
      return rounds.sort((a, b) => b.date.localeCompare(a.date));
    },
    enabled: !!user?.pubkey,
  });
}

/** Hook to load a specific golf round */
export function useGolfRound(roundId: string | undefined) {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery({
    queryKey: ['golf-round', user?.pubkey, roundId],
    queryFn: async () => {
      if (!user?.pubkey || !roundId) return null;

      const events = await nostr.query([{
        kinds: [GOLF_ROUND_KIND],
        authors: [user.pubkey],
        '#d': [roundId],
        limit: 1,
      }]);

      if (events.length === 0) return null;
      return parseRoundEvent(events[0]);
    },
    enabled: !!user?.pubkey && !!roundId,
  });
}

/** Build a Nostr event tag array for a golf round */
export function buildRoundEventTags(round: RoundData): string[][] {
  const processedHoles = round.holes.map(calculateHoleSG);
  const sg = calculateRoundSG(processedHoles);

  return [
    ['d', round.id],
    ['alt', `Golf round: ${round.courseName} on ${round.date}`],
    ['title', round.courseName],
    ['date', round.date],
    ['par', String(round.totalPar)],
    ['strokes', String(round.totalStrokes)],
    ['sg_total', sg.total.toFixed(2)],
    ['sg_ott', sg.offTheTee.toFixed(2)],
    ['sg_app', sg.approach.toFixed(2)],
    ['sg_arg', sg.aroundGreen.toFixed(2)],
    ['sg_putt', sg.putting.toFixed(2)],
    ['holes', JSON.stringify(processedHoles)],
    ['t', 'golf'],
    ['t', 'strokes-gained'],
  ];
}

import { useNostr } from '@nostrify/react';
import { useNostrLogin } from '@nostrify/react/login';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { NSchema as n, NostrEvent, NostrMetadata } from '@nostrify/nostrify';

export interface Account {
  id: string;
  pubkey: string;
  event?: NostrEvent;
  metadata: NostrMetadata;
}

export function useLoggedInAccounts() {
  const { nostr } = useNostr();
  const { logins, setLogin, removeLogin } = useNostrLogin();

  const { data: authors = [] } = useQuery({
    queryKey: ['nostr', 'logins', logins.map((l) => l.id).join(';')],
    queryFn: async () => {
      const events = await nostr.query(
        [{ kinds: [0], authors: logins.map((l) => l.pubkey) }],
        // Increased from 1500ms — slow relays were timing out before
        // returning the profile, causing the fallback name to persist.
        { signal: AbortSignal.timeout(8000) },
      );

      return logins.map(({ id, pubkey }): Account => {
        const event = events.find((e) => e.pubkey === pubkey);
        try {
          const metadata = n.json().pipe(n.metadata()).parse(event?.content);
          return { id, pubkey, metadata, event };
        } catch {
          return { id, pubkey, metadata: {}, event };
        }
      });
    },
    retry: 3,
    // Keep profile data fresh for 5 minutes so a relay-change
    // invalidation doesn't immediately trigger a re-fetch.
    staleTime: 5 * 60 * 1000,
    // Hold onto the last successful result while re-fetching so the
    // display name never drops back to the generated fallback.
    placeholderData: keepPreviousData,
  });

  // Current user is the first login
  const currentUser: Account | undefined = (() => {
    const login = logins[0];
    if (!login) return undefined;
    const author = authors.find((a) => a.id === login.id);
    return { metadata: {}, ...author, id: login.id, pubkey: login.pubkey };
  })();

  // Other users are all logins except the current one
  const otherUsers = (authors || []).slice(1) as Account[];

  return {
    authors,
    currentUser,
    otherUsers,
    setLogin,
    removeLogin,
  };
}
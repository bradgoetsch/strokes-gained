import { useSeoMeta } from '@unhead/react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useLoggedInAccounts } from '@/hooks/useLoggedInAccounts';
import { useNostrLogin } from '@nostrify/react/login';
import { useGolfRounds } from '@/hooks/useGolfRounds';
import { calcHandicapIndex, formatHandicap } from '@/lib/handicap';
import type { HandicapRound } from '@/lib/handicap';
import { genUserName } from '@/lib/genUserName';
import { nip19 } from 'nostr-tools';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { LoginArea } from '@/components/auth/LoginArea';
import { EditProfileForm } from '@/components/EditProfileForm';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import {
  Copy,
  Check,
  ExternalLink,
  KeyRound,
  Puzzle,
  Wifi,
  User,
  Settings,
  ChevronDown,
  ChevronUp,
  Flag,
  BarChart3,
  Calendar,
} from 'lucide-react';
import { formatSG, sgColorClass } from '@/lib/strokesGained';
import { format, parseISO } from 'date-fns';

const LOGIN_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; description: string }> = {
  extension: {
    label: 'Browser Extension',
    icon: <Puzzle className="w-4 h-4" />,
    description: 'Your key is managed by your browser extension (e.g. Alby, nos2x). This is the most secure method.',
  },
  nsec: {
    label: 'Private Key',
    icon: <KeyRound className="w-4 h-4" />,
    description: 'You are signed in with a private key stored in this browser.',
  },
  bunker: {
    label: 'Remote Signer',
    icon: <Wifi className="w-4 h-4" />,
    description: 'Your key is managed by a remote NIP-46 signer (bunker).',
  },
};

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: 'Copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className={cn('text-muted-foreground hover:text-foreground transition-colors', className)}
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function Profile() {
  useSeoMeta({ title: 'Profile · StrokesGained' });

  const { user, metadata } = useCurrentUser();
  const { currentUser } = useLoggedInAccounts();
  const { logins } = useNostrLogin();
  const { data: rounds } = useGolfRounds();
  const [showEditForm, setShowEditForm] = useState(false);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="w-8 h-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Sign in to view your profile</h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            Connect with Nostr to access your profile and account settings.
          </p>
        </div>
        <LoginArea className="max-w-56" />
      </div>
    );
  }

  const npub = nip19.npubEncode(user.pubkey);
  const npubShort = `${npub.slice(0, 12)}…${npub.slice(-6)}`;
  const displayName = metadata?.name ?? genUserName(user.pubkey);
  const loginType = logins[0]?.type ?? 'nsec';
  const loginInfo = LOGIN_TYPE_LABELS[loginType] ?? LOGIN_TYPE_LABELS.nsec;

  // Handicap
  const handicapRounds: HandicapRound[] = (rounds ?? [])
    .filter((r) => r.courseRating !== undefined && r.slopeRating !== undefined)
    .map((r) => ({
      score: r.totalStrokes,
      courseRating: r.courseRating!,
      slopeRating: r.slopeRating!,
      date: r.date,
    }));
  const handicapIndex = calcHandicapIndex(handicapRounds);

  // Stats summary
  const roundCount = rounds?.length ?? 0;
  const avgScore = roundCount > 0
    ? Math.round((rounds ?? []).reduce((s, r) => s + r.totalStrokes, 0) / roundCount)
    : null;
  const avgSGTotal = roundCount > 0
    ? (rounds ?? []).reduce((s, r) => s + r.sg.total, 0) / roundCount
    : null;

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Banner + Avatar header — Primal-style */}
      <div className="relative">
        {/* Banner */}
        <div
          className="h-32 rounded-xl overflow-hidden golf-gradient"
          style={
            metadata?.banner
              ? { backgroundImage: `url(${metadata.banner})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : undefined
          }
        />

        {/* Avatar — overlaps banner */}
        <div className="absolute left-4 -bottom-10">
          <div className="w-20 h-20 rounded-full ring-4 ring-background overflow-hidden">
            <Avatar className="w-full h-full">
              <AvatarImage src={metadata?.picture} alt={displayName} />
              <AvatarFallback className="text-2xl golf-gradient text-white">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>

      {/* Name row — offset for avatar */}
      <div className="pt-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold truncate">{displayName}</h1>
          {metadata?.about && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{metadata.about}</p>
          )}
          {metadata?.nip05 && (
            <p className="text-xs text-primary mt-1 font-medium">{metadata.nip05}</p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={() => setShowEditForm((v) => !v)}
        >
          <Settings className="w-3.5 h-3.5" />
          Edit Profile
        </Button>
      </div>

      {/* Edit profile form — collapsible */}
      {showEditForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <EditProfileForm />
          </CardContent>
        </Card>
      )}

      {/* Npub identity card */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Nostr Public Key
            </span>
            <Badge variant="secondary" className="text-[10px] gap-1">
              {loginInfo.icon}
              {loginInfo.label}
            </Badge>
          </div>

          {/* npub display */}
          <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-2">
            <code className="text-xs font-mono flex-1 truncate text-muted-foreground">
              {npubShort}
            </code>
            <CopyButton text={npub} />
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            {loginInfo.description}
          </p>
        </CardContent>
      </Card>

      {/* Key management section */}
      <Card className="border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              Key Management
            </span>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Your Nostr keys are the password to your identity. You can back up your key,
            switch to a browser extension, or manage multiple accounts from the
            Shakespeare settings panel.
          </p>

          <div className="flex flex-col gap-2">
            <a
              href="https://shakespeare.diy/settings/nostr"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <div>
                  <div className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    Nostr Keys &amp; Accounts
                  </div>
                  <div className="text-[10px] text-amber-600/80 dark:text-amber-500">
                    Backup key · Switch to extension · Add accounts
                  </div>
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-amber-500 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors" />
            </a>

            <a
              href="https://shakespeare.diy/settings"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg bg-muted/60 hover:bg-muted transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <Settings className="w-4 h-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">All Settings</div>
                  <div className="text-[10px] text-muted-foreground">
                    Relays · Storage · AI providers
                  </div>
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </a>
          </div>

          {loginType === 'nsec' && (
            <div className="flex items-start gap-2 mt-1 p-2.5 rounded-lg bg-amber-100/80 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <span className="text-amber-600 dark:text-amber-400 text-sm leading-none mt-px">⚠️</span>
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                You're signed in with a private key stored in this browser. Consider backing it up or
                moving it to a browser extension for better security.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Golf stats summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Your Golf Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{roundCount}</div>
              <div className="text-xs text-muted-foreground">Rounds</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {handicapIndex !== null ? formatHandicap(handicapIndex) : '—'}
              </div>
              <div className="text-xs text-muted-foreground">Hcp Index</div>
            </div>
            <div className="text-center">
              <div className={cn('text-2xl font-bold', avgSGTotal !== null ? sgColorClass(avgSGTotal) : '')}>
                {avgSGTotal !== null ? formatSG(avgSGTotal) : '—'}
              </div>
              <div className="text-xs text-muted-foreground">Avg SG</div>
            </div>
          </div>

          {roundCount === 0 ? (
            <div className="text-center py-4 text-sm text-muted-foreground">
              No rounds logged yet.{' '}
              <Link to="/round/new" className="text-primary hover:underline">
                Log your first round →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              <Separator />
              <p className="text-xs text-muted-foreground pt-1 font-medium">Recent Rounds</p>
              {(rounds ?? []).slice(0, 3).map((round) => (
                <Link
                  key={round.id}
                  to={`/round/${round.id}`}
                  className="flex items-center justify-between py-2 hover:text-primary transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Flag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate group-hover:text-primary">
                        {round.courseName}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(parseISO(round.date), 'MMM d, yyyy')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold">{round.totalStrokes}</span>
                    <span className={cn('text-xs font-bold tabular-nums', sgColorClass(round.sg.total))}>
                      {formatSG(round.sg.total)}
                    </span>
                  </div>
                </Link>
              ))}
              {roundCount > 3 && (
                <Link
                  to="/history"
                  className="block text-center text-xs text-primary hover:underline pt-1"
                >
                  View all {roundCount} rounds →
                </Link>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

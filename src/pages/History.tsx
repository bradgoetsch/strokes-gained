import { useSeoMeta } from '@unhead/react';
import { Link } from 'react-router-dom';
import { useGolfRounds } from '@/hooks/useGolfRounds';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { formatSG, sgColorClass } from '@/lib/strokesGained';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Flag, Plus, Calendar, MapPin, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoginArea } from '@/components/auth/LoginArea';
import { format, parseISO } from 'date-fns';

export default function History() {
  useSeoMeta({ title: 'Round History · StrokesGained' });

  const { user } = useCurrentUser();
  const { data: rounds, isLoading } = useGolfRounds();

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Calendar className="w-8 h-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Sign in to view history</h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            Connect with Nostr to access your round history stored on the network.
          </p>
        </div>
        <LoginArea className="max-w-56" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Round History</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {rounds?.length
              ? `${rounds.length} round${rounds.length !== 1 ? 's' : ''} logged`
              : 'No rounds yet'}
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link to="/round/new">
            <Plus className="w-4 h-4" />
            New Round
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : !rounds || rounds.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Flag className="w-8 h-8 text-primary" />
          </div>
          <div className="space-y-2 max-w-sm">
            <h3 className="text-lg font-semibold">No rounds logged</h3>
            <p className="text-muted-foreground text-sm">
              Track your first round to start building your stats history.
            </p>
          </div>
          <Button asChild size="lg" className="gap-2">
            <Link to="/round/new">
              <Plus className="w-4 h-4" />
              Log Your First Round
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {rounds.map((round) => {
            const scoreVsPar = round.totalStrokes - round.totalPar;
            return (
              <Link key={round.id} to={`/round/${round.id}`}>
                <Card className="hover:shadow-md transition-all hover:border-primary/40 group cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Score badge */}
                      <div className={cn(
                        'w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 font-bold',
                        scoreVsPar < 0
                          ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400'
                          : scoreVsPar === 0
                          ? 'bg-primary/10 text-primary'
                          : 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-400'
                      )}>
                        <span className="text-xl">{round.totalStrokes}</span>
                        <span className="text-[10px] opacity-80">
                          {scoreVsPar === 0 ? 'E' : scoreVsPar > 0 ? `+${scoreVsPar}` : scoreVsPar}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold group-hover:text-primary transition-colors truncate">
                          {round.courseName}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(parseISO(round.date), 'MMM d, yyyy')}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            Par {round.totalPar}
                          </span>
                        </div>
                        {/* SG breakdown */}
                        <div className="flex items-center gap-3 mt-2">
                          {[
                            { label: 'OTT', val: round.sg.offTheTee },
                            { label: 'APP', val: round.sg.approach },
                            { label: 'ARG', val: round.sg.aroundGreen },
                            { label: 'PUTT', val: round.sg.putting },
                          ].map((item) => (
                            <div key={item.label} className="text-center">
                              <div className={cn('text-xs font-bold tabular-nums', sgColorClass(item.val))}>
                                {formatSG(item.val)}
                              </div>
                              <div className="text-[10px] text-muted-foreground">{item.label}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Total SG */}
                      <div className="shrink-0 flex items-center gap-2">
                        <div className="text-right">
                          <div className={cn('text-lg font-bold tabular-nums', sgColorClass(round.sg.total))}>
                            {formatSG(round.sg.total)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">Total SG</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

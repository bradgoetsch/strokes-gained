import { useSeoMeta } from '@unhead/react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useGolfRound, GOLF_ROUND_KIND } from '@/hooks/useGolfRounds';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useQueryClient } from '@tanstack/react-query';
import { formatSG, sgColorClass, SG_CATEGORY_LABELS, type SGCategory } from '@/lib/strokesGained';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ChevronLeft, MapPin, Calendar, Flag, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/useToast';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts';

const CATEGORY_COLORS: Record<SGCategory, string> = {
  ott: '#10b981',
  approach: '#3b82f6',
  arg: '#f59e0b',
  putting: '#8b5cf6',
};

export default function RoundDetail() {
  useSeoMeta({ title: 'Round Detail · StrokesGained' });

  const { roundId } = useParams<{ roundId: string }>();
  const navigate = useNavigate();
  const { data: round, isLoading } = useGolfRound(roundId);
  const { user } = useCurrentUser();
  const { mutateAsync: publish } = useNostrPublish();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!round || !user) return;
    try {
      // NIP-09: publish a kind 5 deletion event referencing the round event
      // Since we don't have the event ID directly, we publish a replacement
      // addressable event with empty holes — relays will replace it.
      // A cleaner approach is kind 5 with the `a` tag for addressable events.
      await publish({
        kind: 5,
        content: 'Round deleted',
        tags: [
          ['a', `${GOLF_ROUND_KIND}:${user.pubkey}:${round.id}`],
        ],
      });

      await queryClient.invalidateQueries({ queryKey: ['golf-rounds'] });
      await queryClient.invalidateQueries({ queryKey: ['golf-round', user.pubkey, round.id] });

      toast({ title: 'Round deleted', description: 'The round has been removed.' });
      navigate('/history');
    } catch {
      toast({ title: 'Error deleting round', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!round) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
        <Flag className="w-12 h-12 text-muted-foreground" />
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Round not found</h3>
          <p className="text-muted-foreground text-sm">This round may have been deleted or is unavailable.</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/history">Back to History</Link>
        </Button>
      </div>
    );
  }

  const scoreVsPar = round.totalStrokes - round.totalPar;
  const isOwner = user?.pubkey !== undefined; // on Nostr, only you publish your own events

  const holeChartData = round.holes.map((h) => ({
    name: `H${h.number}`,
    sg: h.totalSG ?? 0,
    strokes: h.shots.length,
    par: h.par,
  }));

  const categoryData = [
    { name: 'Off the Tee', key: 'ott' as SGCategory, value: round.sg.offTheTee },
    { name: 'Approach', key: 'approach' as SGCategory, value: round.sg.approach },
    { name: 'Around Green', key: 'arg' as SGCategory, value: round.sg.aroundGreen },
    { name: 'Putting', key: 'putting' as SGCategory, value: round.sg.putting },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back nav + actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild className="-ml-2 gap-1 text-muted-foreground hover:text-foreground">
          <Link to="/history">
            <ChevronLeft className="w-4 h-4" />
            All Rounds
          </Link>
        </Button>

        {isOwner && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <Link to={`/round/${round.id}/edit`}>
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </Link>
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30">
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this round?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete your round at <strong>{round.courseName}</strong> on {format(parseISO(round.date), 'MMMM d, yyyy')}. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Delete Round
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {/* Round Header */}
      <Card className="overflow-hidden">
        <div className="golf-gradient p-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{round.courseName}</h1>
              <div className="flex items-center gap-3 text-white/80 text-sm mt-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {format(parseISO(round.date), 'MMMM d, yyyy')}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  Par {round.totalPar}
                </span>
                {round.teeName && (
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                    {round.teeName} tees
                  </span>
                )}
                {round.courseRating && round.slopeRating && (
                  <span className="text-white/60 text-xs">
                    {round.courseRating} / {round.slopeRating}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-4xl font-black">{round.totalStrokes}</div>
              <div className="text-white/80 text-sm font-medium">
                {scoreVsPar === 0 ? 'Even par' : scoreVsPar > 0 ? `+${scoreVsPar}` : `${scoreVsPar}`}
              </div>
              {round.handicapDifferential !== undefined && (
                <div className="text-white/60 text-xs mt-0.5">
                  Diff: {round.handicapDifferential}
                </div>
              )}
            </div>
          </div>
        </div>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {categoryData.map((cat) => (
              <div key={cat.key} className="text-center">
                <div className={cn('text-xl font-bold tabular-nums', sgColorClass(cat.value))}>
                  {formatSG(cat.value)}
                </div>
                <div className="text-xs text-muted-foreground font-medium">{cat.name}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
            <div className="text-sm text-muted-foreground font-medium">Total Strokes Gained</div>
            <div className={cn('text-2xl font-bold tabular-nums', sgColorClass(round.sg.total))}>
              {formatSG(round.sg.total)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="charts">
        <TabsList className="w-full">
          <TabsTrigger value="charts" className="flex-1">Charts</TabsTrigger>
          <TabsTrigger value="holes" className="flex-1">Hole by Hole</TabsTrigger>
          <TabsTrigger value="shots" className="flex-1">Shot Detail</TabsTrigger>
        </TabsList>

        {/* Charts Tab */}
        <TabsContent value="charts" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Strokes Gained per Hole</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={holeChartData} margin={{ top: 5, right: 5, left: -30, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-card border border-border rounded-lg p-2 shadow text-xs">
                          <div className="font-semibold">Hole {d.name.slice(1)}</div>
                          <div>Par {d.par} · {d.strokes} shots</div>
                          <div className={cn('font-bold', sgColorClass(d.sg))}>SG: {formatSG(d.sg)}</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="sg" radius={[3, 3, 0, 0]}>
                    {holeChartData.map((entry, index) => (
                      <Cell key={index} fill={entry.sg >= 0 ? '#10b981' : '#ef4444'} opacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">SG by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {categoryData.map((cat) => {
                  const maxAbs = Math.max(...categoryData.map((c) => Math.abs(c.value)), 1);
                  const pct = (Math.abs(cat.value) / maxAbs) * 100;
                  return (
                    <div key={cat.key} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{cat.name}</span>
                        <span className={cn('font-bold tabular-nums', sgColorClass(cat.value))}>
                          {formatSG(cat.value)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            cat.value >= 0 ? 'bg-emerald-500' : 'bg-red-500'
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hole by Hole Tab */}
        <TabsContent value="holes" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                <div className="grid grid-cols-5 px-4 py-2 text-xs font-medium text-muted-foreground">
                  <span>Hole</span>
                  <span className="text-center">Par</span>
                  <span className="text-center">Shots</span>
                  <span className="text-center">Score</span>
                  <span className="text-right">SG</span>
                </div>
                {round.holes.map((hole) => {
                  const score = hole.shots.length;
                  const diff = score - hole.par;
                  if (score === 0) return null;
                  return (
                    <div key={hole.number} className="grid grid-cols-5 px-4 py-3 items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                          {hole.number}
                        </div>
                      </div>
                      <div className="text-center text-sm">{hole.par}</div>
                      <div className="text-center text-sm">{score}</div>
                      <div className="text-center">
                        <Badge
                          variant={diff < 0 ? 'default' : diff === 0 ? 'secondary' : 'destructive'}
                          className="text-xs"
                        >
                          {diff === 0 ? 'E' : diff > 0 ? `+${diff}` : diff}
                        </Badge>
                      </div>
                      <div className={cn('text-right text-sm font-bold tabular-nums', sgColorClass(hole.totalSG ?? 0))}>
                        {formatSG(hole.totalSG ?? 0)}
                      </div>
                    </div>
                  );
                })}
                <div className="grid grid-cols-5 px-4 py-3 items-center bg-muted/30 font-semibold text-sm">
                  <span>Total</span>
                  <span className="text-center">{round.totalPar}</span>
                  <span className="text-center">{round.totalStrokes}</span>
                  <span className="text-center">
                    <Badge
                      variant={scoreVsPar < 0 ? 'default' : scoreVsPar === 0 ? 'secondary' : 'destructive'}
                      className="text-xs"
                    >
                      {scoreVsPar === 0 ? 'E' : scoreVsPar > 0 ? `+${scoreVsPar}` : scoreVsPar}
                    </Badge>
                  </span>
                  <span className={cn('text-right font-bold tabular-nums', sgColorClass(round.sg.total))}>
                    {formatSG(round.sg.total)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Shot Detail Tab */}
        <TabsContent value="shots" className="mt-4 space-y-3">
          {round.holes.filter((h) => h.shots.length > 0).map((hole) => (
            <Card key={hole.number}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>Hole {hole.number} — Par {hole.par}</span>
                  <span className={cn('text-sm font-bold tabular-nums', sgColorClass(hole.totalSG ?? 0))}>
                    {formatSG(hole.totalSG ?? 0)} SG
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {hole.shots.map((shot, idx) => (
                    <div key={shot.id} className="px-4 py-3 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="font-semibold">Shot {idx + 1}</span>
                        {shot.category && (
                          <Badge variant="outline" className="ml-2 text-[10px] py-0">
                            {SG_CATEGORY_LABELS[shot.category]}
                          </Badge>
                        )}
                      </div>
                      <div className="text-muted-foreground text-center">
                        {shot.distanceToHole}{shot.surface === 'green' ? 'ft' : 'yd'} from {shot.surface}
                        {shot.holed
                          ? ' → Holed!'
                          : shot.distanceAfter !== undefined
                          ? ` → ${shot.distanceAfter}${shot.surfaceAfter === 'green' ? 'ft' : 'yd'}`
                          : ''}
                      </div>
                      <div
                        className={cn(
                          'text-right font-bold tabular-nums',
                          shot.strokesGained !== undefined
                            ? sgColorClass(shot.strokesGained)
                            : 'text-muted-foreground'
                        )}
                      >
                        {shot.strokesGained !== undefined ? formatSG(shot.strokesGained) : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Edit prompt at bottom of shot list */}
          {isOwner && (
            <div className="text-center pt-2">
              <Button variant="outline" size="sm" asChild className="gap-1.5">
                <Link to={`/round/${round.id}/edit`}>
                  <Pencil className="w-3.5 h-3.5" />
                  Edit shots in this round
                </Link>
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

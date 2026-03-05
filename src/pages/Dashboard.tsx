import { useSeoMeta } from '@unhead/react';
import { Link } from 'react-router-dom';
import { useGolfRounds } from '@/hooks/useGolfRounds';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { formatSG, sgColorClass, SG_CATEGORY_LABELS, SG_CATEGORY_ICONS, type SGCategory } from '@/lib/strokesGained';
import { calcHandicapIndex, formatHandicap } from '@/lib/handicap';
import type { HandicapRound } from '@/lib/handicap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Flag, Plus, TrendingUp, TrendingDown, Minus, BarChart3, Calendar, Target } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from 'recharts';
import { cn } from '@/lib/utils';
import { LoginArea } from '@/components/auth/LoginArea';
import { format, parseISO } from 'date-fns';

const SG_CATEGORIES: { key: SGCategory; label: string; icon: string; color: string }[] = [
  { key: 'ott', label: 'Off the Tee', icon: '🏌️', color: '#10b981' },
  { key: 'approach', label: 'Approach', icon: '🎯', color: '#3b82f6' },
  { key: 'arg', label: 'Around Green', icon: '🪄', color: '#f59e0b' },
  { key: 'putting', label: 'Putting', icon: '⛳', color: '#8b5cf6' },
];

function SGTrendIcon({ value }: { value: number }) {
  if (value > 0.1) return <TrendingUp className="w-4 h-4 text-emerald-500" />;
  if (value < -0.1) return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-muted-foreground" />;
}

export default function Dashboard() {
  useSeoMeta({
    title: 'Dashboard · StrokesGained',
    description: 'Your golf strokes gained statistics dashboard.',
  });

  const { user } = useCurrentUser();
  const { data: rounds, isLoading } = useGolfRounds();

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-20 h-20 rounded-2xl golf-gradient flex items-center justify-center mx-auto shadow-xl">
            <span className="text-4xl">⛳</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">StrokesGained</h1>
          <p className="text-muted-foreground text-lg">
            Track your golf game like a pro. Log every shot, calculate strokes gained, and identify where you're winning and losing strokes.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground">Sign in with Nostr to save your rounds</p>
          <LoginArea className="max-w-56" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl w-full">
          {SG_CATEGORIES.map((cat) => (
            <Card key={cat.key} className="text-center p-4 border-2 border-dashed border-border hover:border-primary/50 transition-colors">
              <div className="text-2xl mb-2">{cat.icon}</div>
              <div className="text-xs font-medium text-muted-foreground">{cat.label}</div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Calculate handicap index from rounds that have rating/slope data
  const handicapRounds: HandicapRound[] = (rounds ?? [])
    .filter((r) => r.courseRating !== undefined && r.slopeRating !== undefined)
    .map((r) => ({
      score: r.totalStrokes,
      courseRating: r.courseRating!,
      slopeRating: r.slopeRating!,
      date: r.date,
    }));
  const handicapIndex = calcHandicapIndex(handicapRounds);

  // Calculate averages across all rounds
  const avgSG = rounds && rounds.length > 0
    ? {
        ott: rounds.reduce((s, r) => s + r.sg.offTheTee, 0) / rounds.length,
        approach: rounds.reduce((s, r) => s + r.sg.approach, 0) / rounds.length,
        arg: rounds.reduce((s, r) => s + r.sg.aroundGreen, 0) / rounds.length,
        putting: rounds.reduce((s, r) => s + r.sg.putting, 0) / rounds.length,
        total: rounds.reduce((s, r) => s + r.sg.total, 0) / rounds.length,
      }
    : null;

  // Trend data for chart (last 10 rounds)
  const trendData = rounds
    ? [...rounds].reverse().slice(-10).map((r, i) => ({
        label: `R${i + 1}`,
        date: r.date,
        ott: r.sg.offTheTee,
        approach: r.sg.approach,
        arg: r.sg.aroundGreen,
        putting: r.sg.putting,
        total: r.sg.total,
        strokes: r.totalStrokes,
        course: r.courseName,
      }))
    : [];

  // Radar chart data
  const radarData = avgSG
    ? [
        { subject: 'Off Tee', value: avgSG.ott, fullMark: 2 },
        { subject: 'Approach', value: avgSG.approach, fullMark: 2 },
        { subject: 'Arg', value: avgSG.arg, fullMark: 2 },
        { subject: 'Putting', value: avgSG.putting, fullMark: 2 },
      ]
    : [];

  // Per-category bar chart
  const categoryData = avgSG
    ? SG_CATEGORIES.map((cat) => ({
        name: cat.label,
        value: cat.key === 'ott' ? avgSG.ott
          : cat.key === 'approach' ? avgSG.approach
          : cat.key === 'arg' ? avgSG.arg
          : avgSG.putting,
        color: cat.color,
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {rounds?.length
              ? `${rounds.length} round${rounds.length !== 1 ? 's' : ''} tracked`
              : 'No rounds yet — start tracking!'}
          </p>
        </div>
        <Button asChild className="gap-2 shadow-sm">
          <Link to="/round/new">
            <Plus className="w-4 h-4" />
            New Round
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <DashboardSkeleton />
      ) : rounds && rounds.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* SG Category Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {SG_CATEGORIES.map((cat) => {
              const val = avgSG
                ? cat.key === 'ott' ? avgSG.ott
                  : cat.key === 'approach' ? avgSG.approach
                  : cat.key === 'arg' ? avgSG.arg
                  : avgSG.putting
                : 0;

              return (
                <Card key={cat.key} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="text-2xl">{cat.icon}</div>
                      <SGTrendIcon value={val} />
                    </div>
                    <div className={cn('text-2xl font-bold tabular-nums', sgColorClass(val))}>
                      {formatSG(val)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 font-medium">{cat.label}</div>
                    <div className="text-xs text-muted-foreground">avg per round</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Total SG Banner */}
          {avgSG && (
            <Card className={cn('border-2', avgSG.total >= 0 ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20')}>
              <CardContent className="py-5">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl golf-gradient flex items-center justify-center shadow">
                      <Target className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground font-medium">Total Strokes Gained (avg)</div>
                      <div className={cn('text-3xl font-bold tabular-nums', sgColorClass(avgSG.total))}>
                        {formatSG(avgSG.total)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{rounds?.length ?? 0}</div>
                      <div className="text-muted-foreground">Rounds</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {rounds && rounds.length > 0
                          ? Math.round(rounds.reduce((s, r) => s + r.totalStrokes, 0) / rounds.length)
                          : '—'}
                      </div>
                      <div className="text-muted-foreground">Avg Score</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {handicapIndex !== null
                          ? formatHandicap(handicapIndex)
                          : '—'}
                      </div>
                      <div className="text-muted-foreground">
                        {handicapIndex !== null ? 'Hcp Index' : 'Hcp (needs rating)'}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Charts Row */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* SG Trend Line Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  Total SG Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="label" className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} />
                    <YAxis className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm space-y-1">
                            <div className="font-semibold">{d.course}</div>
                            <div className="text-muted-foreground">{d.date}</div>
                            <div className={cn('font-bold', sgColorClass(d.total))}>
                              SG Total: {formatSG(d.total)}
                            </div>
                            <div className="text-muted-foreground">Score: {d.strokes}</div>
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 4" />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.5}
                      dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Category Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  SG by Category (avg)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={categoryData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="name" className="text-xs fill-muted-foreground" tick={{ fontSize: 11 }} />
                    <YAxis className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm">
                            <div className="font-semibold">{d.name}</div>
                            <div className={cn('font-bold', sgColorClass(d.value))}>
                              {formatSG(d.value)}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {categoryData.map((entry, index) => (
                        <Cell
                          key={index}
                          fill={entry.value >= 0 ? entry.color : '#ef4444'}
                          opacity={0.85}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Recent Rounds */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  Recent Rounds
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/history">View All</Link>
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {(rounds ?? []).slice(0, 5).map((round) => (
                  <Link
                    key={round.id}
                    to={`/round/${round.id}`}
                    className="flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors group"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm group-hover:text-primary transition-colors">{round.courseName}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {format(parseISO(round.date), 'MMM d, yyyy')} · {round.totalStrokes} strokes
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {[
                        { val: round.sg.offTheTee, label: 'OTT' },
                        { val: round.sg.approach, label: 'APP' },
                        { val: round.sg.aroundGreen, label: 'ARG' },
                        { val: round.sg.putting, label: 'PUTT' },
                      ].map((item) => (
                        <div key={item.label} className="hidden sm:block text-center">
                          <div className={cn('text-xs font-bold tabular-nums', sgColorClass(item.val))}>
                            {formatSG(item.val)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">{item.label}</div>
                        </div>
                      ))}
                      <Badge
                        variant={round.sg.total >= 0 ? 'default' : 'destructive'}
                        className="ml-2 tabular-nums text-xs"
                      >
                        {formatSG(round.sg.total)}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
        <Flag className="w-8 h-8 text-primary" />
      </div>
      <div className="space-y-2 max-w-sm">
        <h3 className="text-lg font-semibold">No rounds yet</h3>
        <p className="text-muted-foreground text-sm">
          Start tracking your game by logging your first round. You'll see detailed strokes gained analysis after each round.
        </p>
      </div>
      <Button asChild size="lg" className="gap-2">
        <Link to="/round/new">
          <Plus className="w-4 h-4" />
          Log Your First Round
        </Link>
      </Button>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-4 pb-4 space-y-2">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid md:grid-cols-2 gap-6">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}

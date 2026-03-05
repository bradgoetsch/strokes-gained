import { useSeoMeta } from '@unhead/react';
import { Link } from 'react-router-dom';
import { useGolfRounds } from '@/hooks/useGolfRounds';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { formatSG, sgColorClass, type SGCategory } from '@/lib/strokesGained';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { BarChart3, Plus, TrendingUp, Award } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoginArea } from '@/components/auth/LoginArea';
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
} from 'recharts';

const CATEGORY_COLORS: Record<SGCategory, string> = {
  ott: '#10b981',
  approach: '#3b82f6',
  arg: '#f59e0b',
  putting: '#8b5cf6',
};

const CATEGORY_LABELS: Record<SGCategory, string> = {
  ott: 'Off the Tee',
  approach: 'Approach',
  arg: 'Around Green',
  putting: 'Putting',
};

export default function Stats() {
  useSeoMeta({ title: 'Statistics · StrokesGained' });

  const { user } = useCurrentUser();
  const { data: rounds, isLoading } = useGolfRounds();

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <BarChart3 className="w-8 h-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Sign in to view stats</h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            Connect with Nostr to see your detailed statistics.
          </p>
        </div>
        <LoginArea className="max-w-56" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid md:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!rounds || rounds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <BarChart3 className="w-8 h-8 text-primary" />
        </div>
        <div className="space-y-2 max-w-sm">
          <h3 className="text-lg font-semibold">No stats yet</h3>
          <p className="text-muted-foreground text-sm">
            Log at least one round to start seeing your statistics.
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

  // Calculate statistics
  const sortedByDate = [...rounds].sort((a, b) => a.date.localeCompare(b.date));

  const avgOf = (fn: (r: typeof rounds[0]) => number) =>
    rounds.reduce((s, r) => s + fn(r), 0) / rounds.length;

  const stats = {
    avgTotal: avgOf((r) => r.sg.total),
    avgOtt: avgOf((r) => r.sg.offTheTee),
    avgApp: avgOf((r) => r.sg.approach),
    avgArg: avgOf((r) => r.sg.aroundGreen),
    avgPutt: avgOf((r) => r.sg.putting),
    avgScore: avgOf((r) => r.totalStrokes),
    bestScore: Math.min(...rounds.map((r) => r.totalStrokes)),
    bestSGRound: rounds.reduce((best, r) => r.sg.total > best.sg.total ? r : best),
    worstSGRound: rounds.reduce((worst, r) => r.sg.total < worst.sg.total ? r : worst),
  };

  // Trend data
  const trendData = sortedByDate.map((r, i) => ({
    label: `R${i + 1}`,
    date: r.date,
    course: r.courseName,
    total: r.sg.total,
    ott: r.sg.offTheTee,
    approach: r.sg.approach,
    arg: r.sg.aroundGreen,
    putting: r.sg.putting,
    score: r.totalStrokes,
  }));

  // Rolling averages (window of 5)
  const rollingAvgData = trendData.map((d, i) => {
    const window = trendData.slice(Math.max(0, i - 4), i + 1);
    return {
      ...d,
      rollingTotal: window.reduce((s, x) => s + x.total, 0) / window.length,
    };
  });

  // Category distribution
  const categoryData: { name: string; key: SGCategory; avg: number; best: number; worst: number }[] = [
    { name: 'Off the Tee', key: 'ott', avg: stats.avgOtt, best: Math.max(...rounds.map((r) => r.sg.offTheTee)), worst: Math.min(...rounds.map((r) => r.sg.offTheTee)) },
    { name: 'Approach', key: 'approach', avg: stats.avgApp, best: Math.max(...rounds.map((r) => r.sg.approach)), worst: Math.min(...rounds.map((r) => r.sg.approach)) },
    { name: 'Around Green', key: 'arg', avg: stats.avgArg, best: Math.max(...rounds.map((r) => r.sg.aroundGreen)), worst: Math.min(...rounds.map((r) => r.sg.aroundGreen)) },
    { name: 'Putting', key: 'putting', avg: stats.avgPutt, best: Math.max(...rounds.map((r) => r.sg.putting)), worst: Math.min(...rounds.map((r) => r.sg.putting)) },
  ];

  // Weakest vs strongest
  const sorted = [...categoryData].sort((a, b) => a.avg - b.avg);
  const weakest = sorted[0];
  const strongest = sorted[sorted.length - 1];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Statistics</h1>
          <p className="text-muted-foreground text-sm mt-1">Based on {rounds.length} round{rounds.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Key Insights */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3 mb-3">
              <TrendingUp className="w-5 h-5 text-primary" />
              <span className="text-sm font-semibold text-primary">Biggest Strength</span>
            </div>
            <div className="text-lg font-bold">{CATEGORY_LABELS[strongest.key]}</div>
            <div className={cn('text-2xl font-bold tabular-nums mt-1', sgColorClass(strongest.avg))}>
              {formatSG(strongest.avg)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">avg per round</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/5 to-red-500/10 border-red-200 dark:border-red-900/50">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-3 mb-3">
              <Award className="w-5 h-5 text-red-500" />
              <span className="text-sm font-semibold text-red-500">Biggest Weakness</span>
            </div>
            <div className="text-lg font-bold">{CATEGORY_LABELS[weakest.key]}</div>
            <div className={cn('text-2xl font-bold tabular-nums mt-1', sgColorClass(weakest.avg))}>
              {formatSG(weakest.avg)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">avg per round</div>
          </CardContent>
        </Card>
      </div>

      {/* Category Stats Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Strokes Gained by Category</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            <div className="grid grid-cols-4 px-4 py-2 text-xs font-medium text-muted-foreground">
              <span>Category</span>
              <span className="text-center">Avg</span>
              <span className="text-center">Best</span>
              <span className="text-center">Worst</span>
            </div>
            {categoryData.map((cat) => (
              <div key={cat.key} className="grid grid-cols-4 px-4 py-3 items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat.key] }} />
                  <span className="text-sm font-medium">{cat.name}</span>
                </div>
                <div className={cn('text-center text-sm font-bold tabular-nums', sgColorClass(cat.avg))}>
                  {formatSG(cat.avg)}
                </div>
                <div className={cn('text-center text-sm font-semibold tabular-nums', sgColorClass(cat.best))}>
                  {formatSG(cat.best)}
                </div>
                <div className={cn('text-center text-sm font-semibold tabular-nums', sgColorClass(cat.worst))}>
                  {formatSG(cat.worst)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* SG Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Total SG Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={rollingAvgData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-card border border-border rounded-lg p-3 shadow-lg text-sm space-y-1">
                      <div className="font-semibold">{d.course}</div>
                      <div className="text-muted-foreground text-xs">{d.date}</div>
                      <div className={cn('font-bold', sgColorClass(d.total))}>SG: {formatSG(d.total)}</div>
                      <div className="text-muted-foreground">Score: {d.score}</div>
                    </div>
                  );
                }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="total" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Round SG" />
              <Line type="monotone" dataKey="rollingTotal" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: 'hsl(var(--primary))', r: 3 }} name="5-Round Avg" />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-6 mt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-0.5 bg-primary rounded" />
              <span>5-Round Rolling Avg</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-px bg-muted-foreground" style={{ borderTop: '1px dashed' }} />
              <span>Per Round</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Trend Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {(['ott', 'approach', 'arg', 'putting'] as SGCategory[]).map((cat) => {
          const dataKey = cat === 'ott' ? 'ott' : cat === 'approach' ? 'approach' : cat === 'arg' ? 'arg' : 'putting';
          const color = CATEGORY_COLORS[cat];
          const label = CATEGORY_LABELS[cat];
          const avg = cat === 'ott' ? stats.avgOtt : cat === 'approach' ? stats.avgApp : cat === 'arg' ? stats.avgArg : stats.avgPutt;

          return (
            <Card key={cat}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>{label}</span>
                  <span className={cn('font-bold text-base tabular-nums', sgColorClass(avg))}>
                    {formatSG(avg)} avg
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={130}>
                  <BarChart data={trendData} margin={{ top: 5, right: 5, left: -30, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload;
                        const val = d[dataKey] as number;
                        return (
                          <div className="bg-card border border-border rounded-lg p-2 shadow text-xs">
                            <div className="font-semibold">{d.course}</div>
                            <div className={cn('font-bold', sgColorClass(val))}>{formatSG(val)}</div>
                          </div>
                        );
                      }}
                    />
                    <Bar dataKey={dataKey} radius={[3, 3, 0, 0]}>
                      {trendData.map((entry, index) => {
                        const val = entry[dataKey as keyof typeof entry] as number;
                        return <Cell key={index} fill={val >= 0 ? color : '#ef4444'} opacity={0.8} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Notable Rounds */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="w-4 h-4 text-primary" />
            Notable Rounds
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Link to={`/round/${stats.bestSGRound.id}`} className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 hover:border-emerald-400 transition-colors group">
            <div>
              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-0.5">Best SG Round</div>
              <div className="text-sm font-medium group-hover:text-primary transition-colors">{stats.bestSGRound.courseName}</div>
              <div className="text-xs text-muted-foreground">{stats.bestSGRound.date}</div>
            </div>
            <div className={cn('text-xl font-bold tabular-nums', sgColorClass(stats.bestSGRound.sg.total))}>
              {formatSG(stats.bestSGRound.sg.total)}
            </div>
          </Link>
          <Link to={`/round/${stats.worstSGRound.id}`} className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 hover:border-red-400 transition-colors group">
            <div>
              <div className="text-xs font-semibold text-red-600 dark:text-red-400 mb-0.5">Most Room for Improvement</div>
              <div className="text-sm font-medium group-hover:text-primary transition-colors">{stats.worstSGRound.courseName}</div>
              <div className="text-xs text-muted-foreground">{stats.worstSGRound.date}</div>
            </div>
            <div className={cn('text-xl font-bold tabular-nums', sgColorClass(stats.worstSGRound.sg.total))}>
              {formatSG(stats.worstSGRound.sg.total)}
            </div>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

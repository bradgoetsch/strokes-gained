import { useSeoMeta } from '@unhead/react';
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useQueryClient } from '@tanstack/react-query';
import {
  calculateHoleSG,
  calculateRoundSG,
  calculateShotSG,
  getShotCategory,
  formatSG,
  sgColorClass,
  SURFACE_LABELS,
  SG_CATEGORY_LABELS,
  type Shot,
  type HoleData,
  type ShotSurface,
} from '@/lib/strokesGained';
import { buildRoundEventTags, GOLF_ROUND_KIND } from '@/hooks/useGolfRounds';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Check,
  Flag,
  Info,
  Loader2,
  Save,
} from 'lucide-react';
import { LoginArea } from '@/components/auth/LoginArea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CourseSearch } from '@/components/CourseSearch';

const PAR_OPTIONS = [3, 4, 5];
const SURFACE_OPTIONS: ShotSurface[] = ['tee', 'fairway', 'rough', 'sand', 'recovery', 'green'];

/** Generate a simple ID */
function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Default hole setup */
function createDefaultHoles(): HoleData[] {
  return Array.from({ length: 18 }, (_, i) => ({
    number: i + 1,
    par: 4,
    shots: [],
  }));
}

/** Create an empty shot */
function createShot(): Shot {
  return {
    id: genId(),
    distanceToHole: 0,
    surface: 'tee',
    holed: false,
    distanceAfter: undefined,
    surfaceAfter: undefined,
  };
}

type Step = 'setup' | 'holes' | 'review';

export default function NewRound() {
  useSeoMeta({ title: 'New Round · StrokesGained' });

  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { mutateAsync: publish } = useNostrPublish();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('setup');
  const [courseName, setCourseName] = useState('');
  const [roundDate, setRoundDate] = useState(new Date().toISOString().split('T')[0]);
  const [holes, setHoles] = useState<HoleData[]>(createDefaultHoles());
  const [currentHole, setCurrentHole] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const hole = holes[currentHole];
  const totalStrokes = holes.reduce((s, h) => s + h.shots.length, 0);
  const totalPar = holes.reduce((s, h) => s + h.par, 0);

  // Update hole par
  const updateHolePar = (holeIdx: number, par: number) => {
    setHoles((prev) => prev.map((h, i) => (i === holeIdx ? { ...h, par } : h)));
  };

  // Add a shot to current hole
  const addShot = () => {
    const newShot = createShot();
    const prevShot = hole.shots[hole.shots.length - 1];

    if (prevShot && !prevShot.holed) {
      // Carry over distance/surface from the previous shot's result
      if (prevShot.distanceAfter !== undefined) {
        newShot.distanceToHole = prevShot.distanceAfter;
      }
      if (prevShot.surfaceAfter !== undefined) {
        newShot.surface = prevShot.surfaceAfter;
      }
    } else if (hole.shots.length === 0) {
      // First shot on hole is always from the tee
      newShot.surface = 'tee';
    }

    setHoles((prev) =>
      prev.map((h, i) =>
        i === currentHole ? { ...h, shots: [...h.shots, newShot] } : h
      )
    );
  };

  // Remove a shot
  const removeShot = (shotId: string) => {
    setHoles((prev) =>
      prev.map((h, i) =>
        i === currentHole
          ? { ...h, shots: h.shots.filter((s) => s.id !== shotId) }
          : h
      )
    );
  };

  // Update a shot field
  const updateShot = useCallback(
    (shotId: string, updates: Partial<Shot>) => {
      setHoles((prev) =>
        prev.map((h, i) => {
          if (i !== currentHole) return h;
          return {
            ...h,
            shots: h.shots.map((s) => {
              if (s.id !== shotId) return s;
              const updated = { ...s, ...updates };
              // Auto-calculate SG
              if (
                updated.distanceToHole > 0 &&
                (updated.holed || (updated.distanceAfter !== undefined && updated.surfaceAfter))
              ) {
                updated.strokesGained = calculateShotSG(updated);
                updated.category = getShotCategory(updated);
              }
              return updated;
            }),
          };
        })
      );
    },
    [currentHole]
  );

  // Go to review
  const goToReview = () => {
    // Calculate SG for all holes
    const processedHoles = holes.map(calculateHoleSG);
    setHoles(processedHoles);
    setStep('review');
  };

  // Save round to Nostr
  const saveRound = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      const processedHoles = holes.map(calculateHoleSG);
      const roundId = genId();
      const roundData = {
        id: roundId,
        date: roundDate,
        courseName,
        holes: processedHoles,
        sg: calculateRoundSG(processedHoles),
        totalStrokes,
        totalPar,
      };

      const tags = buildRoundEventTags(roundData);

      await publish({
        kind: GOLF_ROUND_KIND,
        content: '',
        tags,
      });

      await queryClient.invalidateQueries({ queryKey: ['golf-rounds'] });

      toast({
        title: 'Round saved!',
        description: `Your round at ${courseName} has been saved to Nostr.`,
      });

      navigate(`/round/${roundId}`);
    } catch (err) {
      toast({
        title: 'Error saving round',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <Flag className="w-8 h-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Sign in to log rounds</h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            Connect with Nostr to save your rounds and track your progress over time.
          </p>
        </div>
        <LoginArea className="max-w-56" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Round</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {step === 'setup' && 'Enter course details'}
            {step === 'holes' && `Hole ${currentHole + 1} of 18 · ${totalStrokes} strokes so far`}
            {step === 'review' && 'Review your round'}
          </p>
        </div>
        {step !== 'setup' && (
          <Badge variant="outline" className="text-sm">
            {totalStrokes > 0 ? `${totalStrokes > totalPar ? '+' : ''}${totalStrokes - totalPar} vs par` : `Par ${totalPar}`}
          </Badge>
        )}
      </div>

      {/* Progress */}
      {step === 'holes' && (
        <Progress value={((currentHole + 1) / 18) * 100} className="h-2" />
      )}

      {/* Step 1: Setup */}
      {step === 'setup' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Round Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="course">Course Name</Label>
              <CourseSearch
                value={courseName}
                onChange={setCourseName}
                onSelect={(course) => setCourseName(course.name)}
                placeholder="Search or type a course name..."
              />
              <p className="text-xs text-muted-foreground">
                Search powered by OpenStreetMap · or type any name manually
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Round Date</Label>
              <Input
                id="date"
                type="date"
                value={roundDate}
                onChange={(e) => setRoundDate(e.target.value)}
              />
            </div>

            <Separator />

            {/* Par setup for each hole */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label>Hole Pars</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>Set the par for each hole. Default is 4.</TooltipContent>
                </Tooltip>
              </div>
              <div className="grid grid-cols-9 gap-2">
                {holes.map((h, i) => (
                  <div key={i} className="text-center">
                    <div className="text-[10px] text-muted-foreground mb-1 font-medium">{h.number}</div>
                    <Select
                      value={String(h.par)}
                      onValueChange={(v) => updateHolePar(i, Number(v))}
                    >
                      <SelectTrigger className="h-8 px-1 text-xs text-center">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAR_OPTIONS.map((p) => (
                          <SelectItem key={p} value={String(p)}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Front 9 par: {holes.slice(0, 9).reduce((s, h) => s + h.par, 0)}</span>
                <span>Back 9 par: {holes.slice(9).reduce((s, h) => s + h.par, 0)}</span>
                <span>Total: {totalPar}</span>
              </div>
            </div>

            <Button
              className="w-full gap-2"
              disabled={!courseName.trim() || !roundDate}
              onClick={() => setStep('holes')}
            >
              Start Entering Shots
              <ChevronRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Hole-by-hole shot entry */}
      {step === 'holes' && (
        <div className="space-y-4">
          {/* Hole Navigation */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {holes.map((h, i) => (
              <button
                key={i}
                onClick={() => setCurrentHole(i)}
                className={cn(
                  'shrink-0 w-9 h-9 rounded-full text-xs font-bold transition-all',
                  i === currentHole
                    ? 'golf-gradient text-white shadow-md'
                    : h.shots.length > 0
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-muted text-muted-foreground border border-border hover:border-primary/50'
                )}
              >
                {h.number}
              </button>
            ))}
          </div>

          {/* Current Hole Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Hole {hole.number} — Par {hole.par}
                </CardTitle>
                <div className="flex items-center gap-2 text-sm">
                  {hole.shots.length > 0 && (
                    <Badge variant={hole.shots.length === hole.par ? 'secondary' : hole.shots.length < hole.par ? 'default' : 'destructive'}>
                      {hole.shots.length} shots
                      {hole.shots.length === hole.par ? ' (par)' : hole.shots.length < hole.par ? ` (${hole.par - hole.shots.length} under)` : ` (+${hole.shots.length - hole.par})`}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Shot list */}
              {hole.shots.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed border-border rounded-lg">
                  No shots yet. Add your first shot for this hole.
                </div>
              ) : (
                <div className="space-y-4">
                  {hole.shots.map((shot, shotIdx) => (
                    <ShotEntry
                      key={shot.id}
                      shot={shot}
                      shotNumber={shotIdx + 1}
                      isLast={shotIdx === hole.shots.length - 1}
                      prevShot={shotIdx > 0 ? hole.shots[shotIdx - 1] : undefined}
                      onUpdate={(updates) => updateShot(shot.id, updates)}
                      onRemove={() => removeShot(shot.id)}
                    />
                  ))}
                </div>
              )}

              <Button variant="outline" className="w-full gap-2" onClick={addShot}>
                <Plus className="w-4 h-4" />
                Add Shot
              </Button>

              {/* Hole SG preview */}
              {hole.shots.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">SG Preview (this hole)</div>
                  <div className="flex flex-wrap gap-3">
                    {hole.shots.map((shot, idx) => (
                      shot.strokesGained !== undefined && (
                        <div key={shot.id} className="text-center">
                          <div className={cn('text-sm font-bold tabular-nums', sgColorClass(shot.strokesGained))}>
                            {formatSG(shot.strokesGained)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Shot {idx + 1} {shot.category ? `(${SG_CATEGORY_LABELS[shot.category]})` : ''}
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="outline"
              onClick={() => setCurrentHole((p) => Math.max(0, p - 1))}
              disabled={currentHole === 0}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </Button>

            {currentHole < 17 ? (
              <Button
                className="flex-1 gap-2"
                onClick={() => setCurrentHole((p) => p + 1)}
              >
                Next Hole
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                className="flex-1 gap-2"
                onClick={goToReview}
                disabled={totalStrokes === 0}
              >
                Review Round
                <Check className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Finish early button */}
          {currentHole < 17 && totalStrokes > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={goToReview}
            >
              Finish & Review Early
            </Button>
          )}
        </div>
      )}

      {/* Step 3: Review */}
      {step === 'review' && (
        <div className="space-y-4">
          <ReviewSummary holes={holes} courseName={courseName} roundDate={roundDate} />

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => setStep('holes')}
            >
              <ChevronLeft className="w-4 h-4" />
              Edit Shots
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={saveRound}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save to Nostr
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Shot Entry Component ---

interface ShotEntryProps {
  shot: Shot;
  shotNumber: number;
  isLast: boolean;
  prevShot?: Shot;
  onUpdate: (updates: Partial<Shot>) => void;
  onRemove: () => void;
}

function ShotEntry({ shot, shotNumber, isLast, prevShot, onUpdate, onRemove }: ShotEntryProps) {
  // A field was auto-filled from the previous shot's result if it matches
  const distanceAutoFilled =
    prevShot &&
    !prevShot.holed &&
    prevShot.distanceAfter !== undefined &&
    shot.distanceToHole === prevShot.distanceAfter &&
    shot.distanceToHole > 0;

  const surfaceAutoFilled =
    prevShot &&
    !prevShot.holed &&
    prevShot.surfaceAfter !== undefined &&
    shot.surface === prevShot.surfaceAfter;

  return (
    <div className="border border-border rounded-lg p-4 space-y-4 bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full golf-gradient text-white text-xs font-bold flex items-center justify-center">
            {shotNumber}
          </div>
          <span className="text-sm font-medium">Shot {shotNumber}</span>
          {shot.strokesGained !== undefined && (
            <Badge
              variant="outline"
              className={cn('text-xs', sgColorClass(shot.strokesGained))}
            >
              SG: {formatSG(shot.strokesGained)}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onRemove}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Distance to hole */}
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5">
            Distance to Hole
            <span className="text-muted-foreground">
              {shot.surface === 'green' ? '(feet)' : '(yards)'}
            </span>
            {distanceAutoFilled && (
              <span className="text-[10px] text-primary font-medium bg-primary/10 px-1.5 py-0.5 rounded">
                auto-filled
              </span>
            )}
          </Label>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            placeholder={shot.surface === 'green' ? 'feet' : 'yards'}
            value={shot.distanceToHole || ''}
            onChange={(e) => onUpdate({ distanceToHole: Number(e.target.value) })}
            className={cn('h-9', distanceAutoFilled && 'border-primary/40 bg-primary/5')}
          />
        </div>

        {/* Surface */}
        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5">
            Lie / Surface
            {surfaceAutoFilled && (
              <span className="text-[10px] text-primary font-medium bg-primary/10 px-1.5 py-0.5 rounded">
                auto-filled
              </span>
            )}
          </Label>
          <Select
            value={shot.surface}
            onValueChange={(v) => onUpdate({ surface: v as ShotSurface })}
          >
            <SelectTrigger className={cn('h-9 text-xs', surfaceAutoFilled && 'border-primary/40 bg-primary/5')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SURFACE_OPTIONS.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">
                  {SURFACE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Holed out toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onUpdate({ holed: !shot.holed, distanceAfter: shot.holed ? undefined : 0, surfaceAfter: shot.holed ? undefined : undefined })}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all',
            shot.holed
              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
              : 'border-border text-muted-foreground hover:border-primary/50'
          )}
        >
          {shot.holed ? <Check className="w-4 h-4" /> : <Flag className="w-4 h-4" />}
          {shot.holed ? 'Holed Out!' : 'Mark as Holed'}
        </button>
      </div>

      {/* Result (if not holed) */}
      {!shot.holed && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Distance After
              <span className="text-muted-foreground ml-1">
                {shot.surfaceAfter === 'green' ? '(feet)' : '(yards)'}
              </span>
            </Label>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              placeholder={shot.surfaceAfter === 'green' ? 'feet' : 'yards'}
              value={shot.distanceAfter ?? ''}
              onChange={(e) => onUpdate({ distanceAfter: Number(e.target.value) })}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Lie After Shot</Label>
            <Select
              value={shot.surfaceAfter ?? ''}
              onValueChange={(v) => onUpdate({ surfaceAfter: v as ShotSurface })}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {SURFACE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {SURFACE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Review Summary Component ---

interface ReviewSummaryProps {
  holes: HoleData[];
  courseName: string;
  roundDate: string;
}

function ReviewSummary({ holes, courseName, roundDate }: ReviewSummaryProps) {
  const processedHoles = holes.map(calculateHoleSG);
  const sg = calculateRoundSG(processedHoles);
  const totalStrokes = processedHoles.reduce((s, h) => s + h.shots.length, 0);
  const totalPar = processedHoles.reduce((s, h) => s + h.par, 0);

  const cats = [
    { label: 'Off the Tee', val: sg.offTheTee, icon: '🏌️' },
    { label: 'Approach', val: sg.approach, icon: '🎯' },
    { label: 'Around Green', val: sg.aroundGreen, icon: '🪄' },
    { label: 'Putting', val: sg.putting, icon: '⛳' },
  ];

  return (
    <div className="space-y-4">
      {/* Round Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Round Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-semibold text-lg">{courseName}</div>
              <div className="text-sm text-muted-foreground">{roundDate}</div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{totalStrokes}</div>
              <div className="text-sm text-muted-foreground">
                {totalStrokes > totalPar ? `+${totalStrokes - totalPar}` : totalStrokes === totalPar ? 'E' : `-${totalPar - totalStrokes}`} (par {totalPar})
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-3">
            {cats.map((cat) => (
              <div key={cat.label} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                <span className="text-sm text-muted-foreground">{cat.icon} {cat.label}</span>
                <span className={cn('text-sm font-bold tabular-nums', sgColorClass(cat.val))}>
                  {formatSG(cat.val)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between bg-primary/10 rounded-lg px-4 py-3 border border-primary/20">
            <span className="font-semibold">Total SG</span>
            <span className={cn('text-xl font-bold tabular-nums', sgColorClass(sg.total))}>
              {formatSG(sg.total)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Hole-by-hole */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Hole by Hole</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {processedHoles.filter((h) => h.shots.length > 0).map((hole) => (
              <div key={hole.number} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                    {hole.number}
                  </div>
                  <div>
                    <div className="text-sm font-medium">Hole {hole.number}</div>
                    <div className="text-xs text-muted-foreground">Par {hole.par} · {hole.shots.length} shots</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={hole.shots.length < hole.par ? 'default' : hole.shots.length === hole.par ? 'secondary' : 'destructive'}
                    className="text-xs"
                  >
                    {hole.shots.length < hole.par
                      ? `-${hole.par - hole.shots.length}`
                      : hole.shots.length === hole.par
                      ? 'E'
                      : `+${hole.shots.length - hole.par}`}
                  </Badge>
                  {hole.totalSG !== undefined && (
                    <span className={cn('text-sm font-bold tabular-nums w-14 text-right', sgColorClass(hole.totalSG))}>
                      {formatSG(hole.totalSG)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

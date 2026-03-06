/**
 * CourseSetup — combines course name search (OpenStreetMap + Nostr library),
 * scorecard lookup, editable pars, tee/rating/slope entry, and scorecard
 * publishing back to Nostr.
 */
import { useState, useEffect } from 'react';
import { CourseSearch } from '@/components/CourseSearch';
import { useCourseScorecard, usePublishScorecard, blankScorecard } from '@/hooks/useCourseScorecard';
import type { CourseScorecard, HolePar, TeeInfo } from '@/lib/courseScorecard';
import { totalPar } from '@/lib/courseScorecard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/useToast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Users,
  Edit3,
  Plus,
  Trash2,
  BookOpen,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const PAR_OPTIONS = [3, 4, 5];

export interface CourseSetupValue {
  courseName: string;
  teeName?: string;
  courseRating?: number;
  slopeRating?: number;
  holes: HolePar[];
}

interface CourseSetupProps {
  value: CourseSetupValue;
  onChange: (value: CourseSetupValue) => void;
  /** How many holes this round covers — controls which holes to use from a scorecard */
  holeCount: 9 | 18;
  /** Which 9 to play when holeCount is 9 */
  nineChoice?: 'front' | 'back';
}

type Mode = 'search' | 'found' | 'editing';

export function CourseSetup({ value, onChange, holeCount, nineChoice = 'front' }: CourseSetupProps) {
  const { user } = useCurrentUser();
  const { toast } = useToast();
  const { mutateAsync: publishScorecard, isPending: isPublishing } = usePublishScorecard();

  const [mode, setMode] = useState<Mode>('search');
  const [editCard, setEditCard] = useState<CourseScorecard | null>(null);
  const [showTees, setShowTees] = useState(false);

  // Nostr scorecard lookup — fires when course name is set
  const { data: nostrCard, isLoading: isSearchingNostr } = useCourseScorecard(
    value.courseName.length >= 3 ? value.courseName : undefined
  );

  /** Slice full 18-hole scorecard down to the holes we're playing */
  const sliceHoles = (allHoles: HolePar[]): HolePar[] => {
    if (holeCount === 18) return allHoles;
    // For 9-hole rounds: front 9 = holes 1-9, back 9 = holes 10-18
    const slice = nineChoice === 'back' ? allHoles.slice(9, 18) : allHoles.slice(0, 9);
    // Re-number 1–9 so hole numbers are always sequential in the round
    return slice.map((h, i) => ({ ...h, number: i + 1 }));
  };

  // When a Nostr card is found, auto-populate
  useEffect(() => {
    if (!nostrCard) return;
    if (mode === 'editing') return;

    const firstTee = nostrCard.tees[0];
    setMode('found');
    onChange({
      courseName: nostrCard.name,
      holes: sliceHoles(nostrCard.holes),
      teeName: firstTee?.name,
      courseRating: firstTee?.courseRating,
      slopeRating: firstTee?.slopeRating,
    });
  }, [nostrCard, holeCount, nineChoice]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCourseSelect = (name: string) => {
    onChange({ ...value, courseName: name });
  };

  const handleStartEditing = () => {
    const base = nostrCard ?? blankScorecard(value.courseName);
    // Always edit a full 18-hole scorecard in editing mode so the
    // community data stays complete, even for 9-hole rounds
    const fullHoles: HolePar[] = base.holes.length === 18
      ? base.holes
      : Array.from({ length: 18 }, (_, i) => ({ number: i + 1, par: 4 }));
    setEditCard({
      ...base,
      name: value.courseName,
      holes: fullHoles,
      tees: base.tees ?? [],
    });
    setMode('editing');
  };

  const handleHolePar = (holeIdx: number, par: number) => {
    if (!editCard) return;
    const holes = editCard.holes.map((h, i) => i === holeIdx ? { ...h, par } : h);
    setEditCard({ ...editCard, holes });
  };

  const handleAddTee = () => {
    if (!editCard) return;
    const newTee: TeeInfo = { name: '', courseRating: 72.0, slopeRating: 113 };
    setEditCard({ ...editCard, tees: [...editCard.tees, newTee] });
  };

  const handleTeeChange = (idx: number, updates: Partial<TeeInfo>) => {
    if (!editCard) return;
    const tees = editCard.tees.map((t, i) => i === idx ? { ...t, ...updates } : t);
    setEditCard({ ...editCard, tees });
  };

  const handleRemoveTee = (idx: number) => {
    if (!editCard) return;
    setEditCard({ ...editCard, tees: editCard.tees.filter((_, i) => i !== idx) });
  };

  const handleSaveAndPublish = async () => {
    if (!editCard || !user) return;

    const selTee = editCard.tees.find((t) => t.name === value.teeName) ?? editCard.tees[0];

    // Propagate only the holes we're actually playing
    onChange({
      courseName: editCard.name,
      holes: sliceHoles(editCard.holes),
      teeName: selTee?.name,
      courseRating: selTee?.courseRating,
      slopeRating: selTee?.slopeRating,
    });

    // Publish to Nostr so others benefit
    try {
      await publishScorecard(editCard);
      toast({ title: 'Scorecard saved!', description: 'Shared with the community on Nostr.' });
    } catch {
      toast({ title: 'Saved locally', description: 'Could not publish to Nostr — round data is still saved.', variant: 'destructive' });
    }

    setMode('found');
  };

  const handleTeeSelect = (teeName: string) => {
    const card = nostrCard ?? editCard;
    const tee = card?.tees.find((t) => t.name === teeName);
    onChange({
      ...value,
      teeName,
      courseRating: tee?.courseRating,
      slopeRating: tee?.slopeRating,
    });
  };

  const activeCard = mode === 'editing' ? editCard : nostrCard;
  const par = activeCard ? totalPar(activeCard.holes) : totalPar(value.holes);

  return (
    <div className="space-y-4">
      {/* Course name search */}
      <div className="space-y-1.5">
        <Label>Course Name</Label>
        <div className="relative">
          <CourseSearch
            value={value.courseName}
            onChange={(name) => {
              onChange({ ...value, courseName: name, holes: value.holes });
              if (mode !== 'search') setMode('search');
            }}
            onSelect={(course) => handleCourseSelect(course.name, { city: course.location?.split(',')[0] })}
            placeholder="Search or type a course name..."
          />
          {isSearchingNostr && value.courseName.length >= 3 && (
            <div className="absolute right-10 top-1/2 -translate-y-1/2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </div>

      {/* Nostr scorecard found banner */}
      {mode === 'found' && nostrCard && (
        <div className="flex items-center justify-between gap-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2.5">
          <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 min-w-0">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="font-medium truncate">Scorecard found</span>
            <span className="flex items-center gap-1 text-xs text-emerald-600/80 dark:text-emerald-500 shrink-0">
              <Users className="w-3 h-3" />
              community
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 shrink-0"
            onClick={handleStartEditing}
          >
            <Edit3 className="w-3 h-3 mr-1" />
            Edit
          </Button>
        </div>
      )}

      {/* No scorecard found — prompt to add */}
      {mode === 'search' && value.courseName.length >= 3 && !isSearchingNostr && !nostrCard && (
        <div className="flex items-center justify-between gap-3 bg-muted/60 border border-dashed border-border rounded-lg px-3 py-2.5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
            <BookOpen className="w-4 h-4 shrink-0" />
            <span className="truncate">No scorecard in library yet</span>
          </div>
          {user && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs shrink-0"
              onClick={handleStartEditing}
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Scorecard
            </Button>
          )}
        </div>
      )}

      {/* Tee selector (when scorecard is found and has tees) */}
      {mode === 'found' && nostrCard && nostrCard.tees.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-sm">Tee Played</Label>
          <div className="flex flex-wrap gap-2">
            {nostrCard.tees.map((tee) => (
              <button
                key={tee.name}
                type="button"
                onClick={() => handleTeeSelect(tee.name)}
                className={cn(
                  'flex flex-col items-center px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                  value.teeName === tee.name
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                )}
              >
                <span className="font-semibold">{tee.name}</span>
                <span className="text-[10px] opacity-75">{tee.courseRating} / {tee.slopeRating}</span>
                {tee.yardage && <span className="text-[10px] opacity-60">{tee.yardage}y</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Editing mode */}
      {mode === 'editing' && editCard && (
        <Card className="border-primary/30">
          <CardContent className="pt-4 space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Edit Scorecard</span>
              <Badge variant="outline" className="text-xs">Par {totalPar(editCard.holes)}</Badge>
            </div>

            {/* Hole pars grid — always shows full 18 for the community scorecard */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Hole Pars (full 18)</Label>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>Out: {totalPar(editCard.holes.slice(0, 9))}</span>
                  <span>In: {totalPar(editCard.holes.slice(9))}</span>
                </div>
              </div>
              {/* Two rows of 9 for readability */}
              {[editCard.holes.slice(0, 9), editCard.holes.slice(9)].map((row, rowIdx) => (
                <div key={rowIdx} className="grid grid-cols-9 gap-1.5">
                  {row.map((h, i) => {
                    const globalIdx = rowIdx * 9 + i;
                    return (
                      <div key={globalIdx} className="text-center">
                        <div className="text-[10px] text-muted-foreground mb-1 font-medium">{h.number}</div>
                        <Select
                          value={String(h.par)}
                          onValueChange={(v) => handleHolePar(globalIdx, Number(v))}
                        >
                          <SelectTrigger className="h-8 px-0 text-xs justify-center">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAR_OPTIONS.map((p) => (
                              <SelectItem key={p} value={String(p)}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <Separator />

            {/* Tees section */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowTees(!showTees)}
                className="flex items-center justify-between w-full text-sm font-medium hover:text-primary transition-colors"
              >
                <span>Tees & Ratings <span className="text-xs font-normal text-muted-foreground">(optional, enables handicap)</span></span>
                {showTees ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showTees && (
                <div className="space-y-3 pt-1">
                  {editCard.tees.map((tee, idx) => (
                    <div key={idx} className="grid grid-cols-4 gap-2 items-end">
                      <div className="space-y-1">
                        <Label className="text-[10px]">Tee Name</Label>
                        <Input
                          placeholder="Blue"
                          value={tee.name}
                          onChange={(e) => handleTeeChange(idx, { name: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Course Rating</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          placeholder="72.4"
                          value={tee.courseRating || ''}
                          onChange={(e) => handleTeeChange(idx, { courseRating: parseFloat(e.target.value) })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Slope</Label>
                        <Input
                          type="number"
                          inputMode="decimal"
                          placeholder="131"
                          value={tee.slopeRating || ''}
                          onChange={(e) => handleTeeChange(idx, { slopeRating: parseInt(e.target.value) })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveTee(idx)}
                        type="button"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs gap-1.5"
                    onClick={handleAddTee}
                    type="button"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Tee
                  </Button>
                </div>
              )}
            </div>

            {/* Save button */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setMode(nostrCard ? 'found' : 'search')}
                type="button"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1 text-xs gap-1.5"
                onClick={handleSaveAndPublish}
                disabled={isPublishing || !user}
                type="button"
              >
                {isPublishing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                {user ? 'Save & Share to Nostr' : 'Sign in to save'}
              </Button>
            </div>

            {user && (
              <p className="text-[10px] text-muted-foreground text-center">
                Saving shares this scorecard with the community — others playing this course will get pars &amp; ratings automatically.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Par/rating summary when found and not editing */}
      {mode === 'found' && nostrCard && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
          <span>Par {par}</span>
          {value.courseRating && <span>Rating: {value.courseRating}</span>}
          {value.slopeRating && <span>Slope: {value.slopeRating}</span>}
          {value.teeName && <Badge variant="secondary" className="text-[10px] h-4">{value.teeName} tees</Badge>}
        </div>
      )}
    </div>
  );
}

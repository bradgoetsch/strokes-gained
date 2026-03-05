import { useParams, Link } from 'react-router-dom';
import { useGolfRound } from '@/hooks/useGolfRounds';
import NewRound from './NewRound';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Flag, ChevronLeft } from 'lucide-react';

export default function EditRound() {
  const { roundId } = useParams<{ roundId: string }>();
  const { data: round, isLoading } = useGolfRound(roundId);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pt-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
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
          <p className="text-muted-foreground text-sm">
            This round may have been deleted or is unavailable.
          </p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link to="/history">
            <ChevronLeft className="w-4 h-4" />
            Back to History
          </Link>
        </Button>
      </div>
    );
  }

  return <NewRound initialRound={round} />;
}

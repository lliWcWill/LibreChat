import { Check, X } from 'lucide-react';
import { Spinner } from '@librechat/client';
import { cn } from '~/utils';

interface RecordingControlsProps {
  onConfirm: () => void;
  onCancel: () => void;
  isTranscribing: boolean;
}

export default function RecordingControls({
  onConfirm,
  onCancel,
  isTranscribing,
}: RecordingControlsProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onCancel}
        className={cn(
          'flex size-9 items-center justify-center rounded-full border transition-colors',
          'border-border-medium bg-surface-primary hover:bg-red-500/10 hover:border-red-500/40',
        )}
        aria-label="Cancel recording"
      >
        <X className="size-4 stroke-text-secondary" />
      </button>

      <button
        type="button"
        onClick={onConfirm}
        disabled={isTranscribing}
        className={cn(
          'flex size-9 items-center justify-center rounded-full border transition-colors',
          'border-border-medium bg-surface-primary hover:bg-green-500/10 hover:border-green-500/40',
          'disabled:cursor-not-allowed disabled:opacity-40',
        )}
        aria-label="Confirm recording"
      >
        {isTranscribing ? (
          <Spinner className="size-4 stroke-text-secondary" />
        ) : (
          <Check className="size-4 stroke-text-secondary" />
        )}
      </button>
    </div>
  );
}

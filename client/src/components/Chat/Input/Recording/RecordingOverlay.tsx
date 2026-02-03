import { Spinner } from '@librechat/client';
import { Mic } from 'lucide-react';
import WaveformCanvas from './WaveformCanvas';
import RecordingControls from './RecordingControls';

interface RecordingOverlayProps {
  analyserNode: AnalyserNode | null;
  isTranscribing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function RecordingOverlay({
  analyserNode,
  isTranscribing,
  onConfirm,
  onCancel,
}: RecordingOverlayProps) {
  return (
    <div className="flex h-full w-full items-center gap-3 px-3 py-2">
      {/* Mic icon with recording pulse */}
      <div className="relative flex shrink-0 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-red-500/20" />
        <div className="relative flex size-8 items-center justify-center rounded-full bg-red-500/10">
          <Mic className="size-4 text-red-500" />
        </div>
      </div>

      {/* Waveform area - takes remaining space */}
      <div className="relative flex h-10 min-w-0 flex-1 items-center overflow-hidden">
        {isTranscribing ? (
          <div className="flex w-full items-center justify-center gap-2">
            <Spinner className="size-4 stroke-text-secondary" />
            <span className="text-sm text-text-secondary">Transcribing...</span>
          </div>
        ) : (
          <WaveformCanvas analyserNode={analyserNode} className="h-full w-full" />
        )}
      </div>

      {/* Controls */}
      <RecordingControls
        onConfirm={onConfirm}
        onCancel={onCancel}
        isTranscribing={isTranscribing}
      />
    </div>
  );
}

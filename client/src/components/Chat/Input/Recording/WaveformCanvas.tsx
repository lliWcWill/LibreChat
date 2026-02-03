import { useRef } from 'react';
import useWaveformVisualizer from '~/hooks/Input/useWaveformVisualizer';
import { cn } from '~/utils';

interface WaveformCanvasProps {
  analyserNode: AnalyserNode | null;
  className?: string;
}

export default function WaveformCanvas({ analyserNode, className }: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useWaveformVisualizer({
    analyserNode,
    canvasRef,
    barCount: 72,
    barGap: 3,
    barMinHeight: 4,
    barRadius: 2,
    sensitivity: 4.0,
    scrollSpeed: 60,
  });

  return (
    <canvas
      ref={canvasRef}
      className={cn('block h-full w-full', className)}
    />
  );
}

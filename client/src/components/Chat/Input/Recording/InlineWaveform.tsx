import { useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '~/utils';

interface InlineWaveformProps {
  analyserNode: AnalyserNode | null;
  isTranscribing?: boolean;
  className?: string;
}

/**
 * WaveSurfer-style waveform with sharp peaks.
 * Uses frequency data for that classic EQ/spectrum look.
 */
export default function InlineWaveform({
  analyserNode,
  isTranscribing = false,
  className,
}: InlineWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const historyRef = useRef<number[][]>([]);
  const scrollOffsetRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const draw = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      animFrameRef.current = requestAnimationFrame(draw);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      animFrameRef.current = requestAnimationFrame(draw);
      return;
    }

    const deltaTime = lastTimeRef.current ? (timestamp - lastTimeRef.current) / 1000 : 0.016;
    lastTimeRef.current = timestamp;

    // ═══════════════════════════════════════════════════════
    // TUNING - WaveSurfer style sharp peaks
    // ═══════════════════════════════════════════════════════
    const scrollSpeed = 88;        // Pixels per second
    const lineWidth = 1;           // Thin lines for sharp look
    const lineGap = 1;             // Minimal gap
    const waveColor = 'rgba(255, 255, 255, 0.85)';
    const silentColor = 'rgba(107, 114, 128, 0.3)';
    // ═══════════════════════════════════════════════════════

    // High-DPI
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    ctx.clearRect(0, 0, displayWidth, displayHeight);

    const centerY = displayHeight / 2;
    const maxHeight = displayHeight * 0.9;
    const pixelsPerSample = lineWidth + lineGap;
    const samplesNeeded = Math.ceil(displayWidth / pixelsPerSample) + 2;

    // Get frequency data - this gives us the sharp peaks
    let frequencyData: number[] = [];

    if (analyserNode && !isTranscribing) {
      const bufferLength = analyserNode.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyserNode.getByteFrequencyData(dataArray);

      // Sample across frequency spectrum, normalize to 0-1
      const step = Math.floor(bufferLength / 64);
      for (let i = 0; i < 64; i++) {
        const idx = i * step;
        frequencyData.push(dataArray[idx] / 255);
      }
    } else {
      frequencyData = new Array(64).fill(0);
    }

    // Scroll and push new data
    scrollOffsetRef.current += scrollSpeed * deltaTime;

    while (scrollOffsetRef.current >= pixelsPerSample) {
      scrollOffsetRef.current -= pixelsPerSample;
      historyRef.current.unshift([...frequencyData]);
      if (historyRef.current.length > samplesNeeded) {
        historyRef.current.pop();
      }
    }

    // Initialize if empty
    while (historyRef.current.length < samplesNeeded) {
      historyRef.current.push(new Array(64).fill(0));
    }

    // Draw waveform - sharp vertical lines from center
    for (let i = 0; i < samplesNeeded && i < historyRef.current.length; i++) {
      const sample = historyRef.current[i];
      const x = displayWidth - (i * pixelsPerSample) + scrollOffsetRef.current;

      if (x < -lineWidth || x > displayWidth + lineWidth) continue;

      // Average the frequency bands for this column
      const avg = sample.reduce((a, b) => a + b, 0) / sample.length;

      // Also get the peak for sharp spikes
      const peak = Math.max(...sample);

      // Blend average and peak for visual interest
      const amplitude = avg * 0.4 + peak * 0.6;
      const height = amplitude * maxHeight;

      if (amplitude > 0.02) {
        // Draw mirrored waveform from center
        ctx.fillStyle = waveColor;
        ctx.fillRect(x, centerY - height / 2, lineWidth, height);
      } else {
        // Silent - tiny dot
        ctx.fillStyle = silentColor;
        ctx.fillRect(x, centerY - 1, lineWidth, 2);
      }
    }

    animFrameRef.current = requestAnimationFrame(draw);
  }, [analyserNode, isTranscribing]);

  useEffect(() => {
    if (analyserNode) {
      // Low smoothing for sharp, responsive peaks
      analyserNode.smoothingTimeConstant = 0.3;
      analyserNode.fftSize = 256; // Smaller = faster, more responsive
    }

    animFrameRef.current = requestAnimationFrame(draw);
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [draw, analyserNode]);

  useEffect(() => {
    historyRef.current = [];
    scrollOffsetRef.current = 0;
    lastTimeRef.current = 0;
  }, [analyserNode]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className={cn('absolute inset-0 overflow-hidden', className)}
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        style={{ display: 'block' }}
      />
    </motion.div>
  );
}

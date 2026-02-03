import { useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '~/utils';

interface InlineWaveformProps {
  analyserNode: AnalyserNode | null;
  isTranscribing?: boolean;
  className?: string;
}

/**
 * Professional DAW-style waveform visualizer.
 *
 * TUNING GUIDE (for the user):
 * ────────────────────────────
 * - SCALE:      maxBarHeight (line ~58) - controls vertical size (0.5 = 50% of container)
 * - GAIN:       gain (line ~75) - amplifies input signal (higher = louder peaks)
 * - SPEED:      scrollSpeed (line ~52) - pixels per second scrolling
 * - SMOOTHING:  analyserNode.smoothingTimeConstant (line ~137) - 0 = raw, 0.8 = smooth
 * - BAR WIDTH:  barWidth (line ~54) - thicker bars = less detail
 * - BAR GAP:    barGap (line ~55) - space between bars
 */
export default function InlineWaveform({
  analyserNode,
  isTranscribing = false,
  className,
}: InlineWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const amplitudeHistoryRef = useRef<number[]>([]);
  const lastTimeRef = useRef<number>(0);
  const scrollAccumRef = useRef<number>(0);

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

    // Delta time for frame-rate independent animation
    const deltaTime = lastTimeRef.current ? (timestamp - lastTimeRef.current) / 1000 : 0.016;
    lastTimeRef.current = timestamp;

    // ═══════════════════════════════════════════════════════
    // TUNING PARAMETERS - Adjust these for different feels
    // ═══════════════════════════════════════════════════════
    const scrollSpeed = 90;      // Pixels per second (higher = faster scroll)
    const barWidth = 1.5;         // Bar thickness in pixels (smaller = zoomed out)
    const barGap = 0.5;           // Gap between bars (smaller = zoomed out)
    const minBarHeight = 2;       // Minimum bar height (silent state)
    const maxBarHeight = 0.7;    // 0-1 scale of container height (0.85 = 85%)
    const gain = 3.5;             // Input amplification (higher = more sensitive)
    // ═══════════════════════════════════════════════════════

    // High-DPI canvas setup
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    ctx.clearRect(0, 0, displayWidth, displayHeight);

    // Calculate bar layout
    const pixelsPerBar = barWidth + barGap;
    const barCount = Math.floor(displayWidth / pixelsPerBar) + 2;
    const centerY = displayHeight / 2;
    const maxHeight = displayHeight * maxBarHeight;

    // Colors - subtle when silent, bright white when active
    const silentColor = 'rgba(107, 114, 128, 0.3)';   // Gray-500 at 30%
    const activeColor = 'rgba(255, 255, 255, 0.95)';  // Near-white

    // ═══════════════════════════════════════════════════════
    // AUDIO AMPLITUDE DETECTION - True instantaneous peaks
    // ═══════════════════════════════════════════════════════
    let currentAmplitude = 0;

    if (analyserNode && !isTranscribing) {
      const bufferLength = analyserNode.fftSize;
      const floatData = new Float32Array(bufferLength);
      analyserNode.getFloatTimeDomainData(floatData);

      // Find TRUE instantaneous peak (no averaging, no RMS)
      // This gives the raw, uncompressed signal peak
      let peak = 0;
      for (let i = 0; i < bufferLength; i++) {
        const sample = Math.abs(floatData[i]);
        if (sample > peak) peak = sample;
      }

      // Apply gain and soft-clip at 1.0 (allows full dynamic range)
      currentAmplitude = Math.min(peak * gain, 1.0);
    }

    // Initialize history array if needed
    if (amplitudeHistoryRef.current.length !== barCount) {
      amplitudeHistoryRef.current = new Array(barCount).fill(0);
    }

    // ═══════════════════════════════════════════════════════
    // SCROLLING - Continuous right-to-left train animation
    // ═══════════════════════════════════════════════════════
    scrollAccumRef.current += scrollSpeed * deltaTime;

    // When we've scrolled past one bar width, shift and add new sample
    while (scrollAccumRef.current >= pixelsPerBar) {
      scrollAccumRef.current -= pixelsPerBar;
      // Push new amplitude to the front (newest on right)
      amplitudeHistoryRef.current.unshift(currentAmplitude);
      // Trim excess
      if (amplitudeHistoryRef.current.length > barCount) {
        amplitudeHistoryRef.current.pop();
      }
    }

    // ═══════════════════════════════════════════════════════
    // RENDERING - Draw bars from right to left
    // ═══════════════════════════════════════════════════════
    for (let i = 0; i < barCount; i++) {
      const amplitude = amplitudeHistoryRef.current[i] ?? 0;

      // X position: rightmost at i=0, scrolling left
      const x = displayWidth - (i + 1) * pixelsPerBar + scrollAccumRef.current;

      // Skip bars outside visible area
      if (x + barWidth < 0 || x > displayWidth) continue;

      // Calculate height - direct mapping, no additional smoothing
      const height = Math.max(amplitude * maxHeight, minBarHeight);
      const y = centerY - height / 2;

      // Color based on activity threshold
      const isActive = amplitude > 0.02;
      ctx.fillStyle = isActive ? activeColor : silentColor;

      // Draw rounded bar
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, barWidth, height, 1.5);
      } else {
        ctx.rect(x, y, barWidth, height);
      }
      ctx.fill();
    }

    animFrameRef.current = requestAnimationFrame(draw);
  }, [analyserNode, isTranscribing]);

  useEffect(() => {
    // ═══════════════════════════════════════════════════════
    // ANALYSER CONFIG - Critical for responsiveness
    // ═══════════════════════════════════════════════════════
    if (analyserNode) {
      // smoothingTimeConstant: 0 = NO smoothing (raw peaks)
      // Higher values (0.8) = more averaged/smooth
      // For DAW-style rapid response, use 0 or very low
      analyserNode.smoothingTimeConstant = 0;

      // fftSize: Higher = more samples per read (more accurate peaks)
      // 2048 or 4096 is good for voice
      analyserNode.fftSize = 2048;
    }

    animFrameRef.current = requestAnimationFrame(draw);
    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [draw, analyserNode]);

  // Reset state when analyser changes
  useEffect(() => {
    amplitudeHistoryRef.current = [];
    scrollAccumRef.current = 0;
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

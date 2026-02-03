import { useRef, useEffect, useCallback } from 'react';

interface UseWaveformVisualizerOptions {
  analyserNode: AnalyserNode | null;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  barCount?: number;
  barGap?: number;
  barMinHeight?: number;
  barRadius?: number;
  idleColor?: string;
  activeColor?: string;
  sensitivity?: number;
  scrollSpeed?: number;
}

/**
 * ChatGPT-style scrolling waveform visualizer.
 * - Continuous right-to-left scrolling "train" animation
 * - Pulsing dots when idle (no audio input)
 * - Responsive wave bars when voice is detected
 * - High sensitivity for voice input
 */
const useWaveformVisualizer = ({
  analyserNode,
  canvasRef,
  barCount = 64,
  barGap = 4,
  barMinHeight = 3,
  barRadius = 1.5,
  idleColor = '',
  activeColor = '',
  sensitivity = 3.5,
  scrollSpeed = 80,
}: UseWaveformVisualizerOptions) => {
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const scrollOffsetRef = useRef<number>(0);
  const amplitudeHistoryRef = useRef<number[]>([]);
  const idlePhaseRef = useRef<number>(0);
  const cachedIdleColorRef = useRef<string>('');
  const cachedActiveColorRef = useRef<string>('');

  const draw = useCallback(
    (timestamp: number) => {
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

      // Calculate delta time for frame-rate independent animation
      const deltaTime = lastTimeRef.current ? (timestamp - lastTimeRef.current) / 1000 : 0.016;
      lastTimeRef.current = timestamp;

      // Handle high-DPI displays
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;

      if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      ctx.clearRect(0, 0, displayWidth, displayHeight);

      // Calculate bar dimensions
      const totalGaps = (barCount - 1) * barGap;
      const barWidth = Math.max((displayWidth - totalGaps) / barCount, 2);
      const pixelsPerBar = barWidth + barGap;
      const maxBarHeight = displayHeight * 0.8;
      const centerY = displayHeight / 2;

      // Resolve colors (cache to avoid repeated getComputedStyle calls)
      if (!cachedIdleColorRef.current) {
        cachedIdleColorRef.current =
          idleColor ||
          getComputedStyle(canvas).getPropertyValue('--text-tertiary').trim() ||
          '#6b7280';
      }
      if (!cachedActiveColorRef.current) {
        cachedActiveColorRef.current =
          activeColor ||
          getComputedStyle(canvas).getPropertyValue('--text-secondary').trim() ||
          '#9ca3af';
      }

      // Get current audio amplitude using time-domain data (more responsive to voice)
      let currentAmplitude = 0;

      if (analyserNode) {
        const bufferLength = analyserNode.fftSize;
        const dataArray = new Uint8Array(bufferLength);
        analyserNode.getByteTimeDomainData(dataArray);

        // Calculate RMS (root mean square) for accurate amplitude
        let sumSquares = 0;
        for (let i = 0; i < bufferLength; i++) {
          const normalized = (dataArray[i] - 128) / 128;
          sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / bufferLength);

        // Apply sensitivity multiplier and clamp to 0-1
        currentAmplitude = Math.min(rms * sensitivity, 1);
      }

      // Update scroll position (moves left continuously)
      scrollOffsetRef.current += scrollSpeed * deltaTime;

      // When we've scrolled past one bar width, shift the history
      while (scrollOffsetRef.current >= pixelsPerBar) {
        scrollOffsetRef.current -= pixelsPerBar;
        // Add new amplitude at the beginning (right side of display)
        amplitudeHistoryRef.current.unshift(currentAmplitude);
        // Trim excess history
        if (amplitudeHistoryRef.current.length > barCount + 5) {
          amplitudeHistoryRef.current.pop();
        }
      }

      // Initialize history with zeros if empty
      while (amplitudeHistoryRef.current.length < barCount) {
        amplitudeHistoryRef.current.push(0);
      }

      // Update idle animation phase
      idlePhaseRef.current += deltaTime * 2.5;

      // Draw bars from right to left (train effect)
      for (let i = 0; i < barCount; i++) {
        const amplitude = amplitudeHistoryRef.current[i] ?? 0;

        // X position: rightmost bar at i=0, scrolling left
        const x = displayWidth - (i + 1) * pixelsPerBar + scrollOffsetRef.current;

        // Skip bars outside visible area
        if (x + barWidth < 0 || x > displayWidth) {
          continue;
        }

        let barHeight: number;
        let fillColor: string;

        const isActive = amplitude > 0.015;

        if (isActive) {
          // Voice detected - show responsive wave
          barHeight = Math.max(amplitude * maxBarHeight, barMinHeight * 2);
          fillColor = cachedActiveColorRef.current;
        } else {
          // Idle state - subtle pulsing dots with wave motion
          const wavePhase = idlePhaseRef.current + i * 0.12;
          const pulse = Math.sin(wavePhase) * 0.4 + 0.6;
          barHeight = barMinHeight * pulse;
          fillColor = cachedIdleColorRef.current;
        }

        // Draw bar centered vertically
        const y = centerY - barHeight / 2;

        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(x, y, barWidth, barHeight, barRadius);
        } else {
          // Fallback for browsers without roundRect
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fillStyle = fillColor;
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(draw);
    },
    [
      analyserNode,
      canvasRef,
      barCount,
      barGap,
      barMinHeight,
      barRadius,
      idleColor,
      activeColor,
      sensitivity,
      scrollSpeed,
    ],
  );

  useEffect(() => {
    // Start animation immediately (shows idle state even without analyser)
    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [draw]);

  // Reset state when analyser changes
  useEffect(() => {
    amplitudeHistoryRef.current = [];
    scrollOffsetRef.current = 0;
    cachedIdleColorRef.current = '';
    cachedActiveColorRef.current = '';
  }, [analyserNode]);
};

export default useWaveformVisualizer;

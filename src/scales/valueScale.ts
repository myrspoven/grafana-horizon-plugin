import { YScaleMode } from '../types';

export interface ValueTick {
  value: number;
  y: number;
  label: string;
}

export interface ValueScale {
  min: number;
  max: number;
  mode: YScaleMode;
  y: (value: number | null) => number;
  ticks: ValueTick[];
}

function formatTick(value: number): string {
  if (value >= 1000) {
    return `${Math.round(value / 100) / 10}k`;
  }

  return `${value}`;
}

function log1p(value: number): number {
  return Math.log10(Math.max(0, value) + 1);
}

function signedLog1p(value: number): number {
  return Math.sign(value) * log1p(Math.abs(value));
}

function clampValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function linearTicks(min: number, max: number, y: (value: number) => number): ValueTick[] {
  const step = (max - min) / 4;

  return [min, min + step, min + step * 2, min + step * 3, max].map((value) => ({
    value,
    y: y(value),
    label: formatTick(Math.round(value)),
  }));
}

function logTicks(min: number, max: number, y: (value: number) => number): ValueTick[] {
  const positiveCandidates = [0, 1, 3, 10, 30, 100, 300, 1000, 3000, 10000, 30000, 100000];
  const candidates = [
    ...positiveCandidates
      .slice(1)
      .map((value) => -value)
      .reverse(),
    ...positiveCandidates,
  ];
  const ticks = candidates.filter((value) => value >= min && value <= max);

  if (ticks[0] !== min) {
    ticks.unshift(min);
  }

  if (ticks[ticks.length - 1] !== max) {
    ticks.push(max);
  }

  return removeCrowdedTicks(ticks.map((value) => ({
    value,
    y: y(value),
    label: formatTick(Math.round(value)),
  })));
}

function removeCrowdedTicks(ticks: ValueTick[], minPixelSpacing = 16): ValueTick[] {
  return ticks.reduce<ValueTick[]>((visibleTicks, tick, index) => {
    const previous = visibleTicks[visibleTicks.length - 1];
    const isFinalTick = index === ticks.length - 1;

    if (!previous || Math.abs(previous.y - tick.y) >= minPixelSpacing) {
      visibleTicks.push(tick);
      return visibleTicks;
    }

    if (isFinalTick) {
      visibleTicks[visibleTicks.length - 1] = tick;
    }

    return visibleTicks;
  }, []);
}

export function createValueScale(minValue: number, maxValue: number, height: number, mode: YScaleMode): ValueScale {
  const min = Math.min(minValue, maxValue);
  const max = Math.max(min + 1, maxValue);

  if (mode === 'log1p') {
    const transformedMin = signedLog1p(min);
    const transformedMax = signedLog1p(max);
    const transformedRange = Math.max(Number.EPSILON, transformedMax - transformedMin);
    const y = (value: number | null) => {
      const safeValue = value === null ? min : clampValue(value, min, max);
      const transformed = signedLog1p(safeValue);
      return height - ((transformed - transformedMin) / transformedRange) * height;
    };

    return {
      min,
      max,
      mode,
      y,
      ticks: logTicks(min, max, y),
    };
  }

  const range = Math.max(1, max - min);
  const y = (value: number | null) => {
    const safeValue = value === null ? min : clampValue(value, min, max);
    return height - ((safeValue - min) / range) * height;
  };

  return {
    min,
    max,
    mode,
    y,
    ticks: linearTicks(min, max, y),
  };
}

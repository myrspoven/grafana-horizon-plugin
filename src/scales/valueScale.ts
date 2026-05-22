import { YScaleMode } from '../types';

export interface ValueTick {
  value: number;
  y: number;
  label: string;
}

export interface ValueScale {
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

function linearTicks(max: number, height: number, y: (value: number) => number): ValueTick[] {
  const safeMax = max <= 0 ? 1 : max;
  const step = safeMax / 4;

  return [0, step, step * 2, step * 3, safeMax].map((value) => ({
    value,
    y: y(value),
    label: formatTick(Math.round(value)),
  }));
}

function logTicks(max: number, y: (value: number) => number): ValueTick[] {
  const candidates = [0, 1, 3, 10, 30, 100, 300, 1000, 3000, 10000, 30000, 100000];
  const ticks = candidates.filter((value) => value <= max);

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

export function createValueScale(maxValue: number, height: number, mode: YScaleMode): ValueScale {
  const max = Math.max(1, maxValue);

  if (mode === 'log1p') {
    const transformedMax = log1p(max);
    const y = (value: number | null) => {
      const transformed = value === null ? 0 : log1p(value);
      return height - (transformed / transformedMax) * height;
    };

    return {
      max,
      mode,
      y,
      ticks: logTicks(max, y),
    };
  }

  const y = (value: number | null) => {
    const safeValue = value === null ? 0 : Math.max(0, value);
    return height - (safeValue / max) * height;
  };

  return {
    max,
    mode,
    y,
    ticks: linearTicks(max, height, y),
  };
}

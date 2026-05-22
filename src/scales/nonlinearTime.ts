import { ContextCompressionOptions } from '../types';

export type TimeZoneId = 'historical' | 'transition' | 'recent';

export interface TimeZoneRange {
  id: TimeZoneId;
  label: string;
  start: number;
  end: number;
  xStart: number;
  xEnd: number;
}

export interface NonlinearTimeScale {
  domainStart: number;
  domainEnd: number;
  width: number;
  zones: TimeZoneRange[];
  x: (time: number) => number;
  zoneFor: (time: number) => TimeZoneRange;
}

const HOUR_MS = 60 * 60 * 1000;

function positive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function createLogProjection(domainStart: number, domainEnd: number, width: number, focusMs: number) {
  const totalAge = Math.max(1, domainEnd - domainStart);
  const focus = Math.max(HOUR_MS, focusMs);
  const denominator = Math.log1p(totalAge / focus);

  return (time: number): number => {
    const clampedTime = Math.max(domainStart, Math.min(domainEnd, time));
    const age = domainEnd - clampedTime;
    const compressedAge = Math.log1p(age / focus) / denominator;
    return width * (1 - compressedAge);
  };
}

export function createNonlinearTimeScale(
  options: ContextCompressionOptions,
  width: number,
  now: number
): NonlinearTimeScale {
  const recentMs = positive(options.recentDurationHours, 6) * HOUR_MS;
  const transitionMs = positive(options.transitionDurationHours, 18) * HOUR_MS;
  const historicalMs = positive(options.historicalDurationHours, 144) * HOUR_MS;
  const totalMs = recentMs + transitionMs + historicalMs;
  const domainStart = now - totalMs;
  const domainEnd = now;
  const historicalEnd = domainStart + historicalMs;
  const transitionEnd = historicalEnd + transitionMs;
  const project = createLogProjection(domainStart, domainEnd, width, recentMs / 6);

  const zones: TimeZoneRange[] = [
    {
      id: 'historical',
      label: 'Historical',
      start: domainStart,
      end: historicalEnd,
      xStart: project(domainStart),
      xEnd: project(historicalEnd),
    },
    {
      id: 'transition',
      label: 'Transition',
      start: historicalEnd,
      end: transitionEnd,
      xStart: project(historicalEnd),
      xEnd: project(transitionEnd),
    },
    {
      id: 'recent',
      label: 'Recent',
      start: transitionEnd,
      end: domainEnd,
      xStart: project(transitionEnd),
      xEnd: project(domainEnd),
    },
  ];

  const scale: NonlinearTimeScale = {
    domainStart,
    domainEnd,
    width,
    zones,
    x: project,
    zoneFor: (time) => {
      if (time >= zones[2].start) {
        return zones[2];
      }

      if (time >= zones[1].start) {
        return zones[1];
      }

      return zones[0];
    },
  };

  return scale;
}

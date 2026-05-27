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
  domainStartInput: number,
  domainEndInput: number
): NonlinearTimeScale {
  const recentMs = positive(options.recentDurationHours, 6) * HOUR_MS;
  const transitionMs = positive(options.transitionDurationHours, 18) * HOUR_MS;
  const historicalMs = positive(options.historicalDurationHours, 144) * HOUR_MS;
  const totalMs = recentMs + transitionMs + historicalMs;
  const safeDomainEnd = Number.isFinite(domainEndInput) ? domainEndInput : Date.now();
  const fallbackDomainStart = safeDomainEnd - totalMs;
  const requestedDomainStart = Number.isFinite(domainStartInput) ? domainStartInput : fallbackDomainStart;
  const domainEnd = Math.max(safeDomainEnd, requestedDomainStart + 1);
  const domainStart = Math.min(requestedDomainStart, domainEnd - 1);
  const domainMs = domainEnd - domainStart;
  const historicalEnd = domainStart + historicalMs;
  const transitionEnd = historicalEnd + transitionMs;
  const project = createLogProjection(domainStart, domainEnd, width, recentMs / 6);

  const zones: TimeZoneRange[] = [
    {
      id: 'historical',
      label: 'Historical',
      start: domainStart,
      end: Math.min(domainEnd, historicalEnd),
      xStart: project(domainStart),
      xEnd: project(Math.min(domainEnd, historicalEnd)),
    },
    {
      id: 'transition',
      label: 'Transition',
      start: Math.min(domainEnd, historicalEnd),
      end: Math.min(domainEnd, transitionEnd),
      xStart: project(Math.min(domainEnd, historicalEnd)),
      xEnd: project(Math.min(domainEnd, transitionEnd)),
    },
    {
      id: 'recent',
      label: 'Recent',
      start: Math.min(domainEnd, Math.max(domainStart, domainEnd - Math.min(recentMs, domainMs))),
      end: domainEnd,
      xStart: project(Math.min(domainEnd, Math.max(domainStart, domainEnd - Math.min(recentMs, domainMs)))),
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

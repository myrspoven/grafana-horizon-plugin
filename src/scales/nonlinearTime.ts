import { HorizonOptions } from '../types';

export interface NonlinearTimeScale {
  domainStart: number;
  domainEnd: number;
  width: number;
  x: (time: number) => number;
}

const HOUR_MS = 60 * 60 * 1000;
const FALLBACK_RANGE_MS = 7 * 24 * HOUR_MS;

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
  options: HorizonOptions,
  width: number,
  domainStartInput: number,
  domainEndInput: number
): NonlinearTimeScale {
  const focusMs = positive(options.compressionFocusHours, 6) * HOUR_MS;
  const safeDomainEnd = Number.isFinite(domainEndInput) ? domainEndInput : Date.now();
  const fallbackDomainStart = safeDomainEnd - FALLBACK_RANGE_MS;
  const requestedDomainStart = Number.isFinite(domainStartInput) ? domainStartInput : fallbackDomainStart;
  const domainEnd = Math.max(safeDomainEnd, requestedDomainStart + 1);
  const domainStart = Math.min(requestedDomainStart, domainEnd - 1);
  const project = createLogProjection(domainStart, domainEnd, width, focusMs / 6);

  const scale: NonlinearTimeScale = {
    domainStart,
    domainEnd,
    width,
    x: project,
  };

  return scale;
}

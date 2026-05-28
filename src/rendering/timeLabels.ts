import { NonlinearTimeScale } from '../scales/nonlinearTime';

interface LabelCandidate {
  key: string;
  priority: number;
  text: string;
  width: number;
  x: number;
}

export interface TemporalLabel {
  key: string;
  text: string;
  x: number;
}

const HOUR_MS = 60 * 60 * 1000;
const LABEL_GAP = 8;

function startOfLocalDay(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function addLocalDays(time: number, days: number): number {
  const date = new Date(time);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

function nextLocalHour(time: number): number {
  const date = new Date(time);
  date.setMinutes(0, 0, 0);
  const aligned = date.getTime();
  return aligned < time ? aligned + HOUR_MS : aligned;
}

function formatHour(time: number): string {
  const date = new Date(time);
  return `${date.getHours().toString().padStart(2, '0')}:00`;
}

function formatDay(time: number): string {
  const date = new Date(time);
  return `${date.toLocaleString(undefined, { month: 'short' })} ${date.getDate()}`;
}

function estimateTextWidth(text: string): number {
  return text.length * 6.4 + 2;
}

function isYesterday(dayStart: number, now: number): boolean {
  return dayStart === addLocalDays(startOfLocalDay(now), -1);
}

function centeredDayX(scale: NonlinearTimeScale, dayStart: number, dayEnd: number): number {
  const visibleStart = Math.max(scale.domainStart, dayStart);
  const visibleEnd = Math.min(scale.domainEnd, dayEnd);
  return (scale.x(visibleStart) + scale.x(visibleEnd)) / 2;
}

function addDailyCandidates(candidates: LabelCandidate[], scale: NonlinearTimeScale, now: number): void {
  const lastRangeDayStart = startOfLocalDay(scale.domainEnd);
  let dayStart = startOfLocalDay(scale.domainStart);

  while (dayStart < scale.domainEnd) {
    const dayEnd = addLocalDays(dayStart, 1);

    if (dayStart !== lastRangeDayStart && dayEnd > scale.domainStart) {
      const text = isYesterday(dayStart, now) ? 'yesterday' : formatDay(dayStart);
      candidates.push({
        key: `day:${dayStart}`,
        priority: 0,
        text,
        width: estimateTextWidth(text),
        x: centeredDayX(scale, dayStart, dayEnd),
      });
    }

    dayStart = dayEnd;
  }
}

function addHourlyCandidates(candidates: LabelCandidate[], scale: NonlinearTimeScale): void {
  const lastRangeDayStart = startOfLocalDay(scale.domainEnd);
  const hourStart = Math.max(scale.domainStart, lastRangeDayStart);

  for (let time = nextLocalHour(hourStart); time <= scale.domainEnd; time += HOUR_MS) {
    const text = formatHour(time);
    candidates.push({
      key: `hour:${time}`,
      priority: 1,
      text,
      width: estimateTextWidth(text),
      x: scale.x(time),
    });
  }
}

function collides(candidate: LabelCandidate, accepted: LabelCandidate[]): boolean {
  const left = candidate.x - candidate.width / 2 - LABEL_GAP / 2;
  const right = candidate.x + candidate.width / 2 + LABEL_GAP / 2;

  return accepted.some((label) => {
    const labelLeft = label.x - label.width / 2 - LABEL_GAP / 2;
    const labelRight = label.x + label.width / 2 + LABEL_GAP / 2;
    return left < labelRight && right > labelLeft;
  });
}

export function generateTemporalLabels(scale: NonlinearTimeScale, now = Date.now()): TemporalLabel[] {
  const candidates: LabelCandidate[] = [];

  addDailyCandidates(candidates, scale, now);
  addHourlyCandidates(candidates, scale);

  const accepted: LabelCandidate[] = [];

  for (const candidate of candidates.sort((a, b) => a.priority - b.priority || a.x - b.x)) {
    if (candidate.x - candidate.width / 2 < 0 || candidate.x + candidate.width / 2 > scale.width) {
      continue;
    }

    if (!collides(candidate, accepted)) {
      accepted.push(candidate);
    }
  }

  return accepted
    .sort((a, b) => a.x - b.x)
    .map((label) => ({
      key: label.key,
      text: label.text,
      x: label.x,
    }));
}

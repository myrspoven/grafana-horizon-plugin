import { NonlinearTimeScale } from '../scales/nonlinearTime';

export interface TemporalMarker {
  time: number;
  x: number;
  major: boolean;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function startOfLocalDay(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function nextLocalHour(time: number): number {
  const date = new Date(time);
  date.setMinutes(0, 0, 0);
  const aligned = date.getTime();
  return aligned < time ? aligned + HOUR_MS : aligned;
}

function nextLocalDay(time: number): number {
  const dayStart = startOfLocalDay(time);
  return dayStart < time ? dayStart + DAY_MS : dayStart;
}

export function generateTemporalMarkers(scale: NonlinearTimeScale): TemporalMarker[] {
  const markers: TemporalMarker[] = [];
  const todayStart = startOfLocalDay(scale.domainEnd);
  const dailyEnd = Math.min(scale.domainEnd, todayStart - 1);

  for (let time = nextLocalDay(scale.domainStart); time <= dailyEnd; time += DAY_MS) {
    markers.push({
      time,
      x: scale.x(time),
      major: true,
    });
  }

  for (let time = nextLocalHour(Math.max(scale.domainStart, todayStart)); time <= scale.domainEnd; time += HOUR_MS) {
    const date = new Date(time);

    markers.push({
      time,
      x: scale.x(time),
      major: date.getHours() === 0,
    });
  }

  if (markers.length === 0 || markers[0].time !== scale.domainStart) {
    markers.unshift({
      time: scale.domainStart,
      x: scale.x(scale.domainStart),
      major: true,
    });
  }

  if (markers[markers.length - 1].time !== scale.domainEnd) {
    markers.push({
      time: scale.domainEnd,
      x: scale.x(scale.domainEnd),
      major: true,
    });
  }

  return markers.filter((marker, index) => {
    if (index === 0) {
      return true;
    }

    return Math.abs(marker.x - markers[index - 1].x) >= 1;
  });
}

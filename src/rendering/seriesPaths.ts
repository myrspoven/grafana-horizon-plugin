import { LineInterpolation } from '../types';
import { TimeSeriesPoint } from '../data/extractSeries';

export function splitRenderableSegments(points: TimeSeriesPoint[], connectNulls: boolean): TimeSeriesPoint[][] {
  if (connectNulls) {
    const connectedPoints = points.filter((point) => point.value !== null);
    return connectedPoints.length > 0 ? [connectedPoints] : [];
  }

  const segments: TimeSeriesPoint[][] = [];
  let currentSegment: TimeSeriesPoint[] = [];

  for (const point of points) {
    if (point.value === null) {
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
        currentSegment = [];
      }

      continue;
    }

    currentSegment.push(point);
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
}

export function buildLinePath(
  points: TimeSeriesPoint[],
  x: (time: number) => number,
  y: (value: number | null) => number,
  interpolation: LineInterpolation
): string {
  if (points.length === 0) {
    return '';
  }

  const [first, ...rest] = points;
  const commands = [`M ${x(first.time).toFixed(2)} ${y(first.value).toFixed(2)}`];
  let previous = first;

  for (const point of rest) {
    const previousX = x(previous.time);
    const previousY = y(previous.value);
    const pointX = x(point.time);
    const pointY = y(point.value);

    if (interpolation === 'stepAfter') {
      commands.push(`H ${pointX.toFixed(2)}`);
      commands.push(`V ${pointY.toFixed(2)}`);
    } else if (interpolation === 'stepBefore') {
      commands.push(`V ${pointY.toFixed(2)}`);
      commands.push(`H ${pointX.toFixed(2)}`);
    } else if (interpolation === 'smooth') {
      const controlOffset = (pointX - previousX) / 2;
      commands.push(
        `C ${(previousX + controlOffset).toFixed(2)} ${previousY.toFixed(2)} ${(pointX - controlOffset).toFixed(2)} ${pointY.toFixed(2)} ${pointX.toFixed(2)} ${pointY.toFixed(2)}`
      );
    } else {
      commands.push(`L ${pointX.toFixed(2)} ${pointY.toFixed(2)}`);
    }

    previous = point;
  }

  return commands.join(' ');
}

export function buildStepAreaPath(
  points: TimeSeriesPoint[],
  x: (time: number) => number,
  y: (value: number | null) => number,
  baselineY: number,
  interpolation: LineInterpolation
): string {
  if (points.length === 0) {
    return '';
  }

  const linePath = buildLinePath(points, x, y, interpolation);
  if (!linePath) {
    return '';
  }

  const firstX = x(points[0].time);
  const lastX = x(points[points.length - 1].time);

  return `${linePath} L ${lastX.toFixed(2)} ${baselineY.toFixed(2)} L ${firstX.toFixed(2)} ${baselineY.toFixed(2)} Z`;
}

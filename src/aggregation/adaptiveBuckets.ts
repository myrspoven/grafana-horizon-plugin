import { TimeSeries, TimeSeriesPoint } from '../data/extractSeries';
import { NonlinearTimeScale } from '../scales/nonlinearTime';
import { AggregationMode, ContextCompressionOptions } from '../types';

const BUCKET_PIXEL_WIDTH = 2;

interface Bucket {
  time: number;
  timeSum: number;
  sum: number;
  count: number;
  max: number;
}

function aggregateValue(bucket: Bucket, mode: AggregationMode): number {
  if (mode === 'avg') {
    return bucket.sum / bucket.count;
  }

  return bucket.max;
}

function aggregatePoints(
  points: TimeSeriesPoint[],
  scale: NonlinearTimeScale,
  options: ContextCompressionOptions
): TimeSeriesPoint[] {
  const buckets = new Map<string, Bucket>();

  for (const point of points) {
    if (point.value === null || point.time < scale.domainStart || point.time > scale.domainEnd) {
      continue;
    }

    const projectedX = scale.x(point.time);
    const bucketIndex = Math.floor(projectedX / BUCKET_PIXEL_WIDTH);
    const key = `${bucketIndex}`;
    const existing = buckets.get(key);

    if (existing) {
      existing.sum += point.value;
      existing.timeSum += point.time;
      existing.count += 1;
      existing.max = Math.max(existing.max, point.value);
    } else {
      buckets.set(key, {
        time: point.time,
        timeSum: point.time,
        sum: point.value,
        count: 1,
        max: point.value,
      });
    }
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.time - b.time)
    .map((bucket) => ({
      time: bucket.timeSum / bucket.count,
      value: aggregateValue(bucket, options.aggregationMode),
    }));
}

export function aggregateSeries(
  series: TimeSeries[],
  scale: NonlinearTimeScale,
  options: ContextCompressionOptions
): TimeSeries[] {
  return series
    .map((item) => ({
      ...item,
      points: aggregatePoints(item.points, scale, options),
    }))
    .filter((item) => item.points.length > 0);
}

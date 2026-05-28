import { TimeSeries, TimeSeriesPoint } from '../data/extractSeries';
import { NonlinearTimeScale } from '../scales/nonlinearTime';
import { AggregationMode, HorizonOptions } from '../types';

const BUCKET_PIXEL_WIDTH = 2;

interface Bucket {
  time: number;
  timeSum: number;
  sum: number;
  count: number;
  max: number;
  nullCount: number;
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
  options: HorizonOptions
): TimeSeriesPoint[] {
  const buckets = new Map<string, Bucket>();

  for (const point of points) {
    if (point.time < scale.domainStart || point.time > scale.domainEnd) {
      continue;
    }

    const projectedX = scale.x(point.time);
    const bucketIndex = Math.floor(projectedX / BUCKET_PIXEL_WIDTH);
    const key = `${bucketIndex}`;
    const existing = buckets.get(key);

    if (existing) {
      existing.timeSum += point.time;

      if (point.value === null) {
        existing.nullCount += 1;
        continue;
      }

      existing.sum += point.value;
      existing.count += 1;
      existing.max = Math.max(existing.max, point.value);
    } else {
      buckets.set(key, {
        time: point.time,
        timeSum: point.time,
        sum: point.value ?? 0,
        count: point.value === null ? 0 : 1,
        max: point.value ?? 0,
        nullCount: point.value === null ? 1 : 0,
      });
    }
  }

  return Array.from(buckets.values())
    .sort((a, b) => a.time - b.time)
    .map((bucket) => ({
      time: bucket.timeSum / Math.max(1, bucket.count + bucket.nullCount),
      value: bucket.count === 0 ? null : aggregateValue(bucket, options.aggregationMode),
    }));
}

export function aggregateSeries(
  series: TimeSeries[],
  scale: NonlinearTimeScale,
  options: HorizonOptions
): TimeSeries[] {
  return series
    .map((item) => ({
      ...item,
      points: aggregatePoints(item.points, scale, options),
    }))
    .filter((item) => item.points.length > 0);
}

import { TimeSeries, TimeSeriesPoint } from '../data/extractSeries';
import { NonlinearTimeScale } from '../scales/nonlinearTime';
import { AggregationMode, HorizonOptions } from '../types';

const BUCKET_PIXEL_WIDTH = 2;
const GAP_FILL_SAMPLE_INTERVAL_MULTIPLIER = 1.75;

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

function getBucketIndex(time: number, scale: NonlinearTimeScale): number {
  return Math.floor(scale.x(time) / BUCKET_PIXEL_WIDTH);
}

function getBucketInterval(bucketIndex: number, scale: NonlinearTimeScale): { end: number; start: number } {
  const startX = Math.max(0, bucketIndex * BUCKET_PIXEL_WIDTH);
  const endX = Math.min(scale.width, startX + BUCKET_PIXEL_WIDTH);

  return {
    end: scale.invert(endX),
    start: scale.invert(startX),
  };
}

function bucketToPoint(bucket: Bucket, bucketIndex: number, scale: NonlinearTimeScale, options: HorizonOptions): TimeSeriesPoint {
  const interval = getBucketInterval(bucketIndex, scale);

  return {
    intervalEnd: interval.end,
    intervalStart: interval.start,
    time: bucket.timeSum / Math.max(1, bucket.count + bucket.nullCount),
    value: bucket.count === 0 ? 0 : aggregateValue(bucket, options.aggregationMode),
  };
}

function estimateSampleInterval(points: TimeSeriesPoint[], scale: NonlinearTimeScale): number | undefined {
  const visibleTimes = points
    .filter((point) => point.time >= scale.domainStart && point.time <= scale.domainEnd)
    .map((point) => point.time)
    .sort((a, b) => a - b);

  const intervals: number[] = [];

  for (let index = 1; index < visibleTimes.length; index++) {
    const interval = visibleTimes[index] - visibleTimes[index - 1];

    if (interval > 0) {
      intervals.push(interval);
    }
  }

  if (intervals.length === 0) {
    return undefined;
  }

  intervals.sort((a, b) => a - b);

  // Prefer the lower end of observed intervals so occasional long idle periods do not become the assumed cadence.
  return intervals[Math.floor((intervals.length - 1) * 0.2)];
}

function shouldFillMissingBucket(previousBucket: Bucket | undefined, nextBucket: Bucket | undefined, sampleInterval: number | undefined): boolean {
  if (!previousBucket || !nextBucket || !sampleInterval) {
    return false;
  }

  return nextBucket.time - previousBucket.time > sampleInterval * GAP_FILL_SAMPLE_INTERVAL_MULTIPLIER;
}

function aggregatePoints(
  points: TimeSeriesPoint[],
  scale: NonlinearTimeScale,
  options: HorizonOptions
): TimeSeriesPoint[] {
  const buckets = new Map<number, Bucket>();

  for (const point of points) {
    if (point.time < scale.domainStart || point.time > scale.domainEnd) {
      continue;
    }

    const bucketIndex = getBucketIndex(point.time, scale);
    const existing = buckets.get(bucketIndex);

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
      buckets.set(bucketIndex, {
        time: point.time,
        timeSum: point.time,
        sum: point.value ?? 0,
        count: point.value === null ? 0 : 1,
        max: point.value ?? 0,
        nullCount: point.value === null ? 1 : 0,
      });
    }
  }

  if (buckets.size === 0) {
    return [];
  }

  const bucketIndexes = Array.from(buckets.keys());
  const sortedBucketIndexes = bucketIndexes.sort((a, b) => a - b);
  const firstBucketIndex = sortedBucketIndexes[0];
  const lastBucketIndex = sortedBucketIndexes[sortedBucketIndexes.length - 1];
  const sampleInterval = estimateSampleInterval(points, scale);
  const result: TimeSeriesPoint[] = [];
  let previousBucket: Bucket | undefined;
  let nextBucketCursor = 0;

  for (let bucketIndex = firstBucketIndex; bucketIndex <= lastBucketIndex; bucketIndex++) {
    const bucket = buckets.get(bucketIndex);

    while (sortedBucketIndexes[nextBucketCursor] <= bucketIndex) {
      nextBucketCursor += 1;
    }

    const nextBucket = bucket ? bucket : buckets.get(sortedBucketIndexes[nextBucketCursor]);

    if (bucket) {
      result.push(bucketToPoint(bucket, bucketIndex, scale, options));
      previousBucket = bucket;
    } else if (shouldFillMissingBucket(previousBucket, nextBucket, sampleInterval)) {
      const interval = getBucketInterval(bucketIndex, scale);
      result.push({
        intervalEnd: interval.end,
        intervalStart: interval.start,
        time: interval.start + (interval.end - interval.start) / 2,
        value: 0,
      });
    }
  }

  return result.sort((a, b) => a.time - b.time);
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

import { aggregateSeries } from './adaptiveBuckets';
import { createNonlinearTimeScale } from '../scales/nonlinearTime';
import { defaultOptions } from '../types';

const now = Date.UTC(2021, 0, 8, 6);
const hour = 60 * 60 * 1000;
const options = {
  ...defaultOptions,
  compressionFocusHours: 6,
};
const rangeStart = now - 18 * hour;

describe('aggregateSeries', () => {
  it('preserves the maximum value per bucket when max aggregation is selected', () => {
    const scale = createNonlinearTimeScale({ ...options, aggregationMode: 'max' }, 2, rangeStart, now);
    const result = aggregateSeries(
      [
        {
          id: 'a',
          name: 'A',
          points: [
            { time: now - 30 * 60 * 1000, value: 2 },
            { time: now - 20 * 60 * 1000, value: 9 },
            { time: now - 10 * 60 * 1000, value: 3 },
          ],
        },
      ],
      scale,
      { ...options, aggregationMode: 'max' }
    );

    expect(result[0].points).toHaveLength(1);
    expect(result[0].points[0].value).toBe(9);
  });

  it('averages bucket values when average aggregation is selected', () => {
    const scale = createNonlinearTimeScale({ ...options, aggregationMode: 'avg' }, 2, rangeStart, now);
    const result = aggregateSeries(
      [
        {
          id: 'a',
          name: 'A',
          points: [
            { time: now - 30 * 60 * 1000, value: 2 },
            { time: now - 20 * 60 * 1000, value: 9 },
            { time: now - 10 * 60 * 1000, value: 4 },
          ],
        },
      ],
      scale,
      { ...options, aggregationMode: 'avg' }
    );

    expect(result[0].points).toHaveLength(1);
    expect(result[0].points[0].value).toBe(5);
  });

  it('aggregates older data into wider real-time buckets', () => {
    const scale = createNonlinearTimeScale(options, 240, rangeStart, now);
    const tenMinutes = 10 * 60 * 1000;
    const inputPoints = Array.from({ length: 109 }, (_, index) => ({
      time: now - (108 - index) * tenMinutes,
      value: index,
    }));

    const result = aggregateSeries(
      [
        {
          id: 'a',
          name: 'A',
          points: inputPoints,
        },
      ],
      scale,
      options
    );
    const aggregatedPoints = result[0].points;
    const oldBucketCount = aggregatedPoints.filter((point) => point.time < now - 12 * hour).length;
    const recentBucketCount = aggregatedPoints.filter((point) => point.time > now - 6 * hour).length;

    expect(oldBucketCount).toBeLessThan(recentBucketCount);
  });

  it('treats null-only buckets as zero values', () => {
    const scale = createNonlinearTimeScale({ ...options, aggregationMode: 'max' }, 6, rangeStart, now);
    const result = aggregateSeries(
      [
        {
          id: 'a',
          name: 'A',
          points: [
            { time: now - 20 * 60 * 1000, value: null },
            { time: now - 10 * 60 * 1000, value: null },
          ],
        },
      ],
      scale,
      { ...options, aggregationMode: 'max' }
    );

    expect(result[0].points.every((point) => point.value === 0)).toBe(true);
  });

  it('leaves normal sampling cadence gaps untouched', () => {
    const scale = createNonlinearTimeScale({ ...options, aggregationMode: 'max' }, 60, rangeStart, now);
    const inputPoints = Array.from({ length: 12 }, (_, index) => ({
      time: now - (11 - index) * 30 * 60 * 1000,
      value: 5,
    }));

    const result = aggregateSeries(
      [
        {
          id: 'a',
          name: 'A',
          points: inputPoints,
        },
      ],
      scale,
      { ...options, aggregationMode: 'max' }
    );

    expect(result[0].points.every((point) => point.value === 5)).toBe(true);
    expect(result[0].points).toHaveLength(inputPoints.length);
  });

  it('fills empty buckets inside gaps that exceed the detected sample cadence', () => {
    const scale = createNonlinearTimeScale({ ...options, aggregationMode: 'max' }, 120, rangeStart, now);
    const inputPoints = [
      ...Array.from({ length: 4 }, (_, index) => ({
        time: rangeStart + index * hour,
        value: 5,
      })),
      ...Array.from({ length: 4 }, (_, index) => ({
        time: now - (3 - index) * hour,
        value: 10,
      })),
    ];

    const result = aggregateSeries(
      [
        {
          id: 'a',
          name: 'A',
          points: inputPoints,
        },
      ],
      scale,
      { ...options, aggregationMode: 'max' }
    );

    const values = result[0].points.map((point) => point.value);

    expect(values[0]).toBe(5);
    expect(values[values.length - 1]).toBe(10);
    expect(values.slice(1, -1).some((value) => value === 0)).toBe(true);
  });
});

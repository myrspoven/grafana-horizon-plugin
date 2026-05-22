import { aggregateSeries } from './adaptiveBuckets';
import { createNonlinearTimeScale } from '../scales/nonlinearTime';
import { defaultOptions } from '../types';

const now = Date.UTC(2021, 0, 8, 6);
const options = {
  ...defaultOptions,
  recentDurationHours: 6,
  transitionDurationHours: 6,
  historicalDurationHours: 6,
};

describe('aggregateSeries', () => {
  it('preserves the maximum value per bucket when max aggregation is selected', () => {
    const scale = createNonlinearTimeScale({ ...options, aggregationMode: 'max' }, 2, now);
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
    const scale = createNonlinearTimeScale({ ...options, aggregationMode: 'avg' }, 2, now);
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
    const scale = createNonlinearTimeScale(options, 240, now);
    const hour = 60 * 60 * 1000;
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
});

import { createNonlinearTimeScale } from './nonlinearTime';
import { defaultOptions } from '../types';

describe('createNonlinearTimeScale', () => {
  const selectedRange = (to: number) => {
    return {
      from: to - 7 * 24 * 60 * 60 * 1000,
      to,
    };
  };

  it('maps the domain boundaries to the plot edges', () => {
    const now = Date.UTC(2021, 0, 8);
    const range = selectedRange(now);
    const scale = createNonlinearTimeScale(defaultOptions, 1000, range.from, range.to);

    expect(scale.x(scale.domainStart)).toBeCloseTo(0);
    expect(scale.x(scale.domainEnd)).toBeCloseTo(1000);
    expect(scale.domainStart).toBe(range.from);
    expect(scale.domainEnd).toBe(range.to);
  });

  it('allocates more horizontal space to recent time than old time', () => {
    const now = Date.UTC(2021, 0, 8);
    const range = selectedRange(now);
    const scale = createNonlinearTimeScale(defaultOptions, 1000, range.from, range.to);
    const newestHourWidth = scale.x(now) - scale.x(now - 60 * 60 * 1000);
    const oldestHourWidth = scale.x(scale.domainStart + 60 * 60 * 1000) - scale.x(scale.domainStart);

    expect(newestHourWidth).toBeGreaterThan(oldestHourWidth);
  });

  it('is monotonic across the whole domain', () => {
    const now = Date.UTC(2021, 0, 8);
    const range = selectedRange(now);
    const scale = createNonlinearTimeScale(defaultOptions, 1000, range.from, range.to);
    const points = Array.from({ length: 50 }, (_, index) => {
      return scale.domainStart + ((scale.domainEnd - scale.domainStart) / 49) * index;
    });

    const projected = points.map(scale.x);

    for (let index = 1; index < projected.length; index++) {
      expect(projected[index]).toBeGreaterThanOrEqual(projected[index - 1]);
    }
  });

  it('uses the selected Grafana time range as the domain', () => {
    const from = Date.UTC(2021, 0, 1, 12);
    const to = Date.UTC(2021, 0, 2, 18);
    const scale = createNonlinearTimeScale(defaultOptions, 1000, from, to);

    expect(scale.domainStart).toBe(from);
    expect(scale.domainEnd).toBe(to);
  });

  it('inverts plot positions back to time', () => {
    const now = Date.UTC(2021, 0, 8);
    const range = selectedRange(now);
    const scale = createNonlinearTimeScale(defaultOptions, 1000, range.from, range.to);
    const times = [
      scale.domainStart,
      scale.domainStart + (scale.domainEnd - scale.domainStart) * 0.25,
      scale.domainStart + (scale.domainEnd - scale.domainStart) * 0.5,
      scale.domainEnd,
    ];

    for (const time of times) {
      expect(scale.invert(scale.x(time))).toBeCloseTo(time, -2);
    }
  });
});

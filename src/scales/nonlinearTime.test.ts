import { createNonlinearTimeScale } from './nonlinearTime';
import { defaultOptions } from '../types';

describe('createNonlinearTimeScale', () => {
  it('maps the domain boundaries to the plot edges', () => {
    const now = Date.UTC(2021, 0, 8);
    const scale = createNonlinearTimeScale(defaultOptions, 1000, now);

    expect(scale.x(scale.domainStart)).toBeCloseTo(0);
    expect(scale.x(scale.domainEnd)).toBeCloseTo(1000);
  });

  it('allocates more horizontal space to recent time than old time', () => {
    const now = Date.UTC(2021, 0, 8);
    const scale = createNonlinearTimeScale(defaultOptions, 1000, now);
    const newestHourWidth = scale.x(now) - scale.x(now - 60 * 60 * 1000);
    const oldestHourWidth = scale.x(scale.domainStart + 60 * 60 * 1000) - scale.x(scale.domainStart);

    expect(newestHourWidth).toBeGreaterThan(oldestHourWidth);
  });

  it('is monotonic across the whole domain', () => {
    const now = Date.UTC(2021, 0, 8);
    const scale = createNonlinearTimeScale(defaultOptions, 1000, now);
    const points = Array.from({ length: 50 }, (_, index) => {
      return scale.domainStart + ((scale.domainEnd - scale.domainStart) / 49) * index;
    });

    const projected = points.map(scale.x);

    for (let index = 1; index < projected.length; index++) {
      expect(projected[index]).toBeGreaterThanOrEqual(projected[index - 1]);
    }
  });
});

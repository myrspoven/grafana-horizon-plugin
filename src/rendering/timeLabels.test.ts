import { NonlinearTimeScale } from '../scales/nonlinearTime';
import { generateTemporalLabels } from './timeLabels';

function localTime(year: number, month: number, day: number, hour = 0): number {
  return new Date(year, month, day, hour).getTime();
}

function linearScale(domainStart: number, domainEnd: number, width: number): NonlinearTimeScale {
  return {
    domainStart,
    domainEnd,
    width,
    x: (time) => ((time - domainStart) / (domainEnd - domainStart)) * width,
  };
}

function estimateTextWidth(text: string): number {
  return text.length * 6.4 + 2;
}

describe('generateTemporalLabels', () => {
  it('renders hours for the last day in the range', () => {
    const scale = linearScale(localTime(2026, 4, 27), localTime(2026, 4, 28, 10), 900);
    const labels = generateTemporalLabels(scale, localTime(2026, 4, 28, 12));

    expect(labels.some((label) => label.text.endsWith(':00'))).toBe(true);
  });

  it('uses yesterday only for the day before the real current day', () => {
    const scale = linearScale(localTime(2026, 4, 25), localTime(2026, 4, 28, 10), 900);
    const labels = generateTemporalLabels(scale, localTime(2026, 4, 28, 12));

    expect(labels.some((label) => label.text === 'yesterday')).toBe(true);
  });

  it('does not call the second-to-last day yesterday for historical ranges', () => {
    const scale = linearScale(localTime(2026, 4, 19), localTime(2026, 4, 21, 10), 900);
    const labels = generateTemporalLabels(scale, localTime(2026, 4, 28, 12));

    expect(labels.some((label) => label.text === 'yesterday')).toBe(false);
  });

  it('skips labels that would overlap', () => {
    const scale = linearScale(localTime(2026, 4, 24), localTime(2026, 4, 28, 10), 160);
    const labels = generateTemporalLabels(scale, localTime(2026, 4, 28, 12));

    for (let index = 1; index < labels.length; index++) {
      const previous = labels[index - 1];
      const current = labels[index];
      const previousRight = previous.x + estimateTextWidth(previous.text) / 2;
      const currentLeft = current.x - estimateTextWidth(current.text) / 2;

      expect(currentLeft - previousRight).toBeGreaterThanOrEqual(0);
    }
  });
});

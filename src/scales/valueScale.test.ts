import { createValueScale } from './valueScale';

describe('createValueScale', () => {
  it('removes crowded log ticks near the maximum', () => {
    const scale = createValueScale(0, 102, 200, 'log1p');
    const labels = scale.ticks.map((tick) => tick.label);

    expect(labels).toContain('102');
    expect(labels).not.toContain('100');
  });

  it('supports a non-zero lower bound for linear scales', () => {
    const scale = createValueScale(50, 100, 200, 'linear');

    expect(scale.min).toBe(50);
    expect(scale.y(50)).toBe(200);
    expect(scale.y(100)).toBe(0);
  });

  it('supports a non-zero lower bound for log scales', () => {
    const scale = createValueScale(50, 100, 200, 'log1p');

    expect(scale.min).toBe(50);
    expect(scale.y(50)).toBe(200);
    expect(scale.y(100)).toBe(0);
  });

  it('supports negative values for linear scales', () => {
    const scale = createValueScale(-10, 10, 200, 'linear');

    expect(scale.min).toBe(-10);
    expect(scale.max).toBe(10);
    expect(scale.y(-10)).toBe(200);
    expect(scale.y(0)).toBe(100);
    expect(scale.y(10)).toBe(0);
  });

  it('supports negative values for compressed log scales', () => {
    const scale = createValueScale(-100, 100, 200, 'log1p');

    expect(scale.min).toBe(-100);
    expect(scale.max).toBe(100);
    expect(scale.y(-100)).toBe(200);
    expect(scale.y(0)).toBeCloseTo(100);
    expect(scale.y(100)).toBe(0);
  });
});

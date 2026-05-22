import { createValueScale } from './valueScale';

describe('createValueScale', () => {
  it('removes crowded log ticks near the maximum', () => {
    const scale = createValueScale(102, 200, 'log1p');
    const labels = scale.ticks.map((tick) => tick.label);

    expect(labels).toContain('102');
    expect(labels).not.toContain('100');
  });
});

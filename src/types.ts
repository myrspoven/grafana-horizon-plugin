export type AggregationMode = 'max' | 'avg';
export type ColorPalette = 'grafana' | 'classic' | 'cool' | 'warm';
export type LegendPlacement = 'right' | 'bottom';
export type LineStyle = 'solid' | 'dash' | 'dot';
export type YScaleMode = 'linear' | 'log1p';

export interface ContextCompressionOptions {
  recentDurationHours: number;
  transitionDurationHours: number;
  historicalDurationHours: number;
  aggregationMode: AggregationMode;
  colorPalette: ColorPalette;
  legendPlacement: LegendPlacement;
  lineOpacity: number;
  lineStyle: LineStyle;
  yScaleMode: YScaleMode;
  lineWidth: number;
  showLegend: boolean;
}

export const defaultOptions: ContextCompressionOptions = {
  recentDurationHours: 6,
  transitionDurationHours: 18,
  historicalDurationHours: 144,
  aggregationMode: 'max',
  colorPalette: 'grafana',
  legendPlacement: 'right',
  lineOpacity: 0.95,
  lineStyle: 'solid',
  yScaleMode: 'log1p',
  lineWidth: 1.5,
  showLegend: true,
};

export function resolveOptions(options: Partial<ContextCompressionOptions>): ContextCompressionOptions {
  return {
    ...defaultOptions,
    ...options,
  };
}

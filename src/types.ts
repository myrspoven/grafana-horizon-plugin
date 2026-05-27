export type AggregationMode = 'max' | 'avg';
export type ColorPalette = 'grafana' | 'classic' | 'cool' | 'warm';
export type GradientMode = 'none' | 'opacity' | 'hue' | 'scheme';
export type LegendPlacement = 'right' | 'bottom';
export type LineStyle = 'solid' | 'dash' | 'dot';
export type ThresholdDisplay = 'off' | 'lines';
export type YAxisLowerBound = 'zero' | 'seriesMin';
export type YScaleMode = 'linear' | 'log1p';

export interface ContextCompressionOptions {
  recentDurationHours: number;
  transitionDurationHours: number;
  historicalDurationHours: number;
  aggregationMode: AggregationMode;
  colorPalette: ColorPalette;
  fillOpacity: number;
  gradientMode: GradientMode;
  legendPlacement: LegendPlacement;
  lineOpacity: number;
  lineStyle: LineStyle;
  thresholdDisplay: ThresholdDisplay;
  yAxisLowerBound: YAxisLowerBound;
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
  fillOpacity: 0,
  gradientMode: 'none',
  legendPlacement: 'right',
  lineOpacity: 0.95,
  lineStyle: 'solid',
  thresholdDisplay: 'off',
  yAxisLowerBound: 'zero',
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

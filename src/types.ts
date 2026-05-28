export type AggregationMode = 'max' | 'avg';
export type ColorPalette = 'grafana' | 'classic' | 'cool' | 'warm';
export type GradientMode = 'none' | 'opacity' | 'hue' | 'scheme';
export type LegendPlacement = 'right' | 'bottom';
export type LegendSortMode = 'original' | 'alphabetical' | 'valueDesc';
export type LineInterpolation = 'linear' | 'smooth' | 'stepAfter' | 'stepBefore';
export type PointVisibility = 'auto' | 'always' | 'never';
export type YAxisLowerBound = 'zero' | 'seriesMin';
export type YScaleMode = 'linear' | 'log1p';

export interface HorizonOptions {
  compressionFocusHours: number;
  aggregationMode: AggregationMode;
  colorPalette: ColorPalette;
  dayBandOpacity: number;
  legendPlacement: LegendPlacement;
  legendSortMode: LegendSortMode;
  lineOpacity: number;
  yAxisLowerBound: YAxisLowerBound;
  yScaleMode: YScaleMode;
  showLegend: boolean;
  showXAxisLabels: boolean;
}

export const defaultOptions: HorizonOptions = {
  compressionFocusHours: 6,
  aggregationMode: 'max',
  colorPalette: 'grafana',
  dayBandOpacity: 32,
  legendPlacement: 'right',
  legendSortMode: 'original',
  lineOpacity: 0.95,
  yAxisLowerBound: 'zero',
  yScaleMode: 'log1p',
  showLegend: true,
  showXAxisLabels: true,
};

export function resolveOptions(options: Partial<HorizonOptions>): HorizonOptions {
  return {
    ...defaultOptions,
    ...options,
  };
}

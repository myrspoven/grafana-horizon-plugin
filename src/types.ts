export type AggregationMode = 'max' | 'avg';
export type ColorPalette = 'grafana' | 'classic' | 'cool' | 'warm';
export type GradientMode = 'none' | 'opacity' | 'hue' | 'scheme';
export type LegendMode = 'hidden' | 'right' | 'bottom';
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
  enableDragZoom: boolean;
  exploreLeftJson: string;
  externalLinkTemplate: string;
  legendMode: LegendMode;
  legendSortMode: LegendSortMode;
  showTooltip: boolean;
  yAxisLowerBound: YAxisLowerBound;
  yScaleMode: YScaleMode;
  showXAxisLabels: boolean;
}

export const defaultOptions: HorizonOptions = {
  compressionFocusHours: 6,
  aggregationMode: 'max',
  colorPalette: 'grafana',
  dayBandOpacity: 32,
  enableDragZoom: true,
  exploreLeftJson: '',
  externalLinkTemplate: '',
  legendMode: 'right',
  legendSortMode: 'original',
  showTooltip: true,
  yAxisLowerBound: 'zero',
  yScaleMode: 'log1p',
  showXAxisLabels: true,
};

export function resolveOptions(options: Partial<HorizonOptions>): HorizonOptions {
  return {
    ...defaultOptions,
    ...options,
  };
}

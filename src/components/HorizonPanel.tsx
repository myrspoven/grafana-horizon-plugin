import React, { useState } from 'react';
import { FieldColorModeId, getDisplayProcessor, PanelProps, Threshold, ThresholdsMode } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { aggregateSeries } from '../aggregation/adaptiveBuckets';
import {
  extractTimeSeries,
  StandardLineStyle,
  StandardTimeSeriesFieldConfig,
  TimeSeries,
  TimeSeriesPoint,
} from '../data/extractSeries';
import { createNonlinearTimeScale } from '../scales/nonlinearTime';
import { createValueScale } from '../scales/valueScale';
import { generateTemporalMarkers } from '../rendering/markers';
import { generateTemporalLabels } from '../rendering/timeLabels';
import { HorizonPlot, PlotSeriesStyle } from './HorizonPlot';
import { HorizonLegend, HorizonLegendRow } from './HorizonLegend';
import {
  ColorPalette,
  GradientMode,
  HorizonOptions,
  LegendSortMode,
  LineInterpolation,
  PointVisibility,
  resolveOptions,
} from '../types';

interface Props extends PanelProps<HorizonOptions> {}

interface SeriesStats {
  last: number | null;
  max: number | null;
}

interface ThresholdLine {
  color: string;
  key: string;
  label: string;
  value: number;
}

interface DayBand {
  key: string;
  start: number;
  end: number;
}

interface DragState {
  currentX: number;
  mode: 'pan' | 'zoom';
  startX: number;
}

interface HoverState {
  intervalEnd: number;
  intervalStart: number;
  link?: string;
  plotX: number;
  plotY: number;
  seriesName: string;
  value: string;
}

interface ResolvedSeriesStyle {
  barMaxWidth?: number;
  barWidthFactor: number;
  drawStyle: 'bars' | 'line' | 'points';
  fillOpacity: number;
  gradientMode: GradientMode;
  lineDash?: string;
  lineInterpolation: LineInterpolation;
  lineOpacity: number;
  lineWidth: number;
  pointSize: number;
  pointVisibility: PointVisibility;
  spanNulls: boolean;
}

type Theme2 = ReturnType<typeof useTheme2>;

const defaultGraphStyle = {
  barMaxWidth: 18,
  barWidthFactor: 0.6,
  drawStyle: 'line',
  fillOpacity: 0,
  gradientMode: 'none',
  lineInterpolation: 'stepAfter',
  lineOpacity: 0.95,
  lineWidth: 1.5,
  pointSize: 4,
  showPoints: 'auto',
  spanNulls: true,
  stackingMode: 'none',
} as const;

const palettes: Record<ColorPalette, string[]> = {
  grafana: ['#b877d9', '#8f7bd1', '#73bf69', '#f2495c', '#ff9830', '#5794f2', '#fade2a', '#7eb6ff'],
  classic: ['#7eb26d', '#eab839', '#6ed0e0', '#ef843c', '#e24d42', '#1f78c1', '#ba43a9', '#705da0'],
  cool: ['#5794f2', '#56d9d9', '#73bf69', '#8f7bd1', '#33a2a2', '#7eb6ff', '#a352cc', '#70dbed'],
  warm: ['#f2495c', '#ff9830', '#fade2a', '#ff7383', '#f2cc0c', '#efa6b0', '#e02f44', '#ffb357'],
};
let panelInstanceSequence = 0;

const getStyles = () => ({
  wrapper: css`
    font-family:
      Open Sans,
      Inter,
      Helvetica,
      Arial,
      sans-serif;
    position: relative;
    overflow: hidden;
  `,
  empty: css`
    align-items: center;
    display: flex;
    height: 100%;
    justify-content: center;
    opacity: 0.75;
  `,
  svg: css`
    display: block;
    cursor: crosshair;
  `,
  tooltip: css`
    border-radius: 4px;
    box-shadow: 0 2px 8px rgb(0 0 0 / 35%);
    font-size: 11px;
    line-height: 16px;
    max-width: 280px;
    padding: 6px 8px;
    pointer-events: none;
    position: absolute;
    z-index: 2;
  `,
  tooltipTitle: css`
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  tooltipLink: css`
    display: inline-block;
    margin-top: 4px;
    pointer-events: auto;
  `,
});

function getDisplayValue(value: number, item: TimeSeries | undefined, theme: Theme2) {
  const display = item?.display ?? getDisplayProcessor({ field: { config: item?.config }, theme: theme as never });
  return display(value);
}

function formatValue(value: number | null, item: TimeSeries | undefined, theme: Theme2): string {
  if (value === null) {
    return '-';
  }

  return getDisplayValue(value, item, theme).text;
}

function formatTooltipTime(time: number): string {
  return new Date(time).toLocaleString(undefined, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  });
}

function replaceLinkToken(template: string, key: string, value: string | number): string {
  const stringValue = String(value);
  return template
    .replace(new RegExp(`\\$\\{${key}\\}`, 'g'), stringValue)
    .replace(new RegExp(`%24%7B${key}%7D`, 'gi'), encodeURIComponent(stringValue));
}

function applyLinkTokens(
  template: string,
  hover: Omit<HoverState, 'link' | 'plotX' | 'plotY'>,
  dashboardFrom: number,
  dashboardTo: number
): string {
  return [
    ['from', hover.intervalStart],
    ['to', hover.intervalEnd],
    ['fromIso', new Date(hover.intervalStart).toISOString()],
    ['toIso', new Date(hover.intervalEnd).toISOString()],
    ['series', encodeURIComponent(hover.seriesName)],
    ['seriesRaw', hover.seriesName],
    ['value', encodeURIComponent(hover.value)],
    ['valueRaw', hover.value],
    ['dashboardFrom', dashboardFrom],
    ['dashboardTo', dashboardTo],
  ].reduce((url, [key, value]) => replaceLinkToken(url, String(key), value), template);
}

function buildExploreLink(
  leftJson: string,
  hover: Omit<HoverState, 'link' | 'plotX' | 'plotY'>,
  dashboardFrom: number,
  dashboardTo: number
): string | undefined {
  const trimmedJson = leftJson.trim();

  if (!trimmedJson) {
    return undefined;
  }

  return `/explore?left=${applyLinkTokens(trimmedJson, hover, dashboardFrom, dashboardTo)}`;
}

function buildExternalLink(
  template: string,
  hover: Omit<HoverState, 'link' | 'plotX' | 'plotY'>,
  dashboardFrom: number,
  dashboardTo: number
): string | undefined {
  const trimmedTemplate = template.trim();

  if (!trimmedTemplate) {
    return undefined;
  }

  return applyLinkTokens(trimmedTemplate, hover, dashboardFrom, dashboardTo);
}

function getUnitLabel(series: TimeSeries[], theme: Theme2): string | undefined {
  const units = Array.from(
    new Set(
      series
        .map((item) => item.config?.unit)
        .filter((unit): unit is string => Boolean(unit) && unit !== 'none' && unit !== 'short')
    )
  );

  if (units.length !== 1) {
    return undefined;
  }

  const item = series.find((candidate) => candidate.config?.unit === units[0]);
  const displayValue = getDisplayValue(1, item, theme);
  const label = (displayValue.suffix ?? displayValue.prefix ?? units[0]).trim();

  return label || undefined;
}

function getMaxValue(series: TimeSeries[]): number {
  return series.reduce((max, item) => {
    const dataMax = item.points.reduce((seriesMax, point) => Math.max(seriesMax, point.value ?? 0), max);
    return (
      item.thresholds?.steps.reduce((thresholdMax, step) => {
        if (item.thresholds?.mode === ThresholdsMode.Percentage || !Number.isFinite(step.value)) {
          return thresholdMax;
        }

        return Math.max(thresholdMax, step.value);
      }, dataMax) ?? dataMax
    );
  }, 0);
}

function getMinValue(series: TimeSeries[]): number {
  const values = series.flatMap((item) => {
    return item.points.map((point) => point.value).filter((value): value is number => value !== null);
  });

  if (values.length === 0) {
    return 0;
  }

  return Math.min(...values);
}

function getHardMin(series: TimeSeries[]): number | undefined {
  const values = series
    .map((item) => item.config?.min)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  return values.length > 0 ? Math.min(...values) : undefined;
}

function getHardMax(series: TimeSeries[]): number | undefined {
  const values = series
    .map((item) => item.config?.max)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  return values.length > 0 ? Math.max(...values) : undefined;
}

function getSoftMin(series: TimeSeries[]): number | undefined {
  const values = series
    .map((item) => item.fieldConfig?.axisSoftMin)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  return values.length > 0 ? Math.min(...values) : undefined;
}

function getSoftMax(series: TimeSeries[]): number | undefined {
  const values = series
    .map((item) => item.fieldConfig?.axisSoftMax)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  return values.length > 0 ? Math.max(...values) : undefined;
}

function getSeriesStats(points: TimeSeriesPoint[]): SeriesStats {
  const values = points.map((point) => point.value).filter((value): value is number => value !== null);

  if (values.length === 0) {
    return { last: null, max: null };
  }

  return {
    last: values[values.length - 1],
    max: Math.max(...values),
  };
}

function compareNullableDesc(left: number | null, right: number | null): number {
  if (left === right) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  return right - left;
}

function sortLegendSeries(series: TimeSeries[], mode: LegendSortMode): TimeSeries[] {
  if (mode === 'original') {
    return series;
  }

  return [...series].sort((left, right) => {
    if (mode === 'alphabetical') {
      return left.name.localeCompare(right.name);
    }

    const leftStats = getSeriesStats(left.points);
    const rightStats = getSeriesStats(right.points);
    const lastComparison = compareNullableDesc(leftStats.last, rightStats.last);

    if (lastComparison !== 0) {
      return lastComparison;
    }

    const maxComparison = compareNullableDesc(leftStats.max, rightStats.max);

    if (maxComparison !== 0) {
      return maxComparison;
    }

    return left.name.localeCompare(right.name);
  });
}

function shouldRenderSeriesPoints(mode: PointVisibility, points: TimeSeriesPoint[], plotWidth: number): boolean {
  if (mode === 'always') {
    return true;
  }

  if (mode === 'never') {
    return false;
  }

  return points.filter((point) => point.value !== null).length <= Math.max(24, plotWidth / 4);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getPaletteColor(paletteName: ColorPalette, index: number): string {
  const colors = palettes[paletteName] ?? palettes.grafana;
  return colors[index % colors.length];
}

function hashString(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function parseColor(color: string): { b: number; g: number; r: number } | undefined {
  const hex = color.trim();

  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    return {
      r: Number.parseInt(hex[1] + hex[1], 16),
      g: Number.parseInt(hex[2] + hex[2], 16),
      b: Number.parseInt(hex[3] + hex[3], 16),
    };
  }

  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return {
      r: Number.parseInt(hex.slice(1, 3), 16),
      g: Number.parseInt(hex.slice(3, 5), 16),
      b: Number.parseInt(hex.slice(5, 7), 16),
    };
  }

  const rgb = hex.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);

  if (rgb) {
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
    };
  }

  return undefined;
}

function formatRgb({ b, g, r }: { b: number; g: number; r: number }): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function blendChannel(channel: number, target: number, amount: number): number {
  return channel + (target - channel) * amount;
}

function getShadeColor(baseColor: string, seriesIndex: number): string {
  const color = parseColor(baseColor);

  if (!color) {
    return baseColor;
  }

  const shadeSteps = [0, 0.22, -0.18, 0.42, -0.32, 0.62, -0.48];
  const step = shadeSteps[seriesIndex % shadeSteps.length];
  const target = step >= 0 ? 255 : 0;
  const amount = Math.abs(step);

  return formatRgb({
    r: blendChannel(color.r, target, amount),
    g: blendChannel(color.g, target, amount),
    b: blendChannel(color.b, target, amount),
  });
}

function getThemeColor(theme: Theme2, color: string): string {
  if (
    color === 'transparent' ||
    color.startsWith('#') ||
    color.startsWith('rgb') ||
    color.startsWith('hsl') ||
    color.startsWith('var(')
  ) {
    return color;
  }

  return theme.visualization.getColorByName(color);
}

function getSeriesLineColor(item: TimeSeries, paletteName: ColorPalette, seriesIndex: number, theme: Theme2): string {
  const colorConfig = item.config?.color;

  if (colorConfig?.mode === FieldColorModeId.Fixed && colorConfig.fixedColor) {
    return getThemeColor(theme, colorConfig.fixedColor);
  }

  if (colorConfig?.mode === FieldColorModeId.Shades) {
    const baseColor = getThemeColor(theme, colorConfig.fixedColor ?? getPaletteColor(paletteName, 0));
    return getShadeColor(baseColor, seriesIndex);
  }

  if (colorConfig?.mode === FieldColorModeId.PaletteClassic) {
    return getThemeColor(theme, getPaletteColor(paletteName, seriesIndex));
  }

  if (colorConfig?.mode === FieldColorModeId.PaletteClassicByName) {
    return getThemeColor(theme, getPaletteColor(paletteName, hashString(item.name)));
  }

  return getThemeColor(theme, item.color ?? getPaletteColor(paletteName, seriesIndex));
}

function getSeriesFillColor(item: TimeSeries, paletteName: ColorPalette, seriesIndex: number, theme: Theme2): string {
  return getSeriesLineColor(item, paletteName, seriesIndex, theme);
}

function getSeriesPointColor(item: TimeSeries, paletteName: ColorPalette, seriesIndex: number, theme: Theme2): string {
  return getSeriesLineColor(item, paletteName, seriesIndex, theme);
}

function hasSeriesColorOverride(item: TimeSeries): boolean {
  const mode = item.config?.color?.mode;
  return mode === FieldColorModeId.Fixed || mode === FieldColorModeId.Shades;
}

function getGradientStops(
  mode: GradientMode,
  color: string,
  fillOpacity: number,
  paletteName: ColorPalette,
  seriesIndex: number,
  hasColorOverride: boolean
): Array<{ color: string; offset: string; opacity: number }> {
  if (mode === 'opacity') {
    return [
      { color, offset: '0%', opacity: fillOpacity },
      { color, offset: '100%', opacity: 0 },
    ];
  }

  if (mode === 'hue') {
    if (hasColorOverride) {
      return [
        { color, offset: '0%', opacity: fillOpacity },
        { color: getShadeColor(color, 1), offset: '100%', opacity: Math.max(0.08, fillOpacity * 0.35) },
      ];
    }

    return [
      { color: getPaletteColor(paletteName, seriesIndex + 1), offset: '0%', opacity: fillOpacity },
      { color, offset: '100%', opacity: Math.max(0.08, fillOpacity * 0.35) },
    ];
  }

  if (hasColorOverride) {
    return [
      { color: getShadeColor(color, 1), offset: '0%', opacity: fillOpacity },
      { color, offset: '50%', opacity: fillOpacity * 0.65 },
      {
        color: getShadeColor(color, 2),
        offset: '100%',
        opacity: Math.max(0.06, fillOpacity * 0.25),
      },
    ];
  }

  return [
    { color: getPaletteColor(paletteName, seriesIndex), offset: '0%', opacity: fillOpacity },
    { color: getPaletteColor(paletteName, seriesIndex + 1), offset: '50%', opacity: fillOpacity * 0.65 },
    {
      color: getPaletteColor(paletteName, seriesIndex + 2),
      offset: '100%',
      opacity: Math.max(0.06, fillOpacity * 0.25),
    },
  ];
}

function getThresholdValue(
  threshold: Threshold,
  minValue: number,
  maxValue: number,
  mode?: ThresholdsMode
): number | null {
  if (!Number.isFinite(threshold.value)) {
    return null;
  }

  if (mode === ThresholdsMode.Percentage) {
    const percent = threshold.value <= 1 ? threshold.value : threshold.value / 100;
    return minValue + (maxValue - minValue) * percent;
  }

  return threshold.value;
}

function getThresholdLines(series: TimeSeries[], minValue: number, maxValue: number, theme: Theme2): ThresholdLine[] {
  const lines = new Map<string, ThresholdLine>();

  for (const item of series) {
    const thresholds = item.thresholds;

    if (!thresholds) {
      continue;
    }

    for (const threshold of thresholds.steps) {
      const value = getThresholdValue(threshold, minValue, maxValue, thresholds.mode);

      if (value === null || value < minValue || value > maxValue) {
        continue;
      }

      const color = getThemeColor(theme, threshold.color);
      const key = `${value}:${color}`;
      lines.set(key, {
        color,
        key,
        label: formatValue(value, item, theme),
        value,
      });
    }
  }

  return Array.from(lines.values()).sort((a, b) => b.value - a.value);
}

function getCustomLineDash(style: StandardLineStyle | undefined, lineWidth: number): string | undefined {
  if (!style) {
    return undefined;
  }

  if (Array.isArray(style.dash) && style.dash.length > 0) {
    return style.dash.join(' ');
  }

  if (style.fill === 'dash') {
    return `${Math.max(4, lineWidth * 4)} ${Math.max(3, lineWidth * 3)}`;
  }

  if (style.fill === 'dot' || style.fill === 'square') {
    return `${Math.max(1, lineWidth)} ${Math.max(3, lineWidth * 3)}`;
  }

  return undefined;
}

function getResolvedSeriesStyle(
  fieldConfig: StandardTimeSeriesFieldConfig | undefined,
  plotWidth: number,
  points: TimeSeriesPoint[]
): ResolvedSeriesStyle {
  const lineWidth = clamp(fieldConfig?.lineWidth ?? defaultGraphStyle.lineWidth, 0, 10);
  const drawStyle = fieldConfig?.drawStyle ?? defaultGraphStyle.drawStyle;
  const pointVisibility = fieldConfig?.showPoints ?? defaultGraphStyle.showPoints;
  const drawStylePointVisibility = drawStyle === 'points' ? 'always' : pointVisibility;
  const lineOpacity = clamp(fieldConfig?.lineOpacity ?? defaultGraphStyle.lineOpacity, 0, 1);
  const spanNulls = fieldConfig?.spanNulls;

  return {
    barMaxWidth: fieldConfig?.barMaxWidth ?? defaultGraphStyle.barMaxWidth,
    barWidthFactor: clamp(fieldConfig?.barWidthFactor ?? defaultGraphStyle.barWidthFactor, 0.05, 1),
    drawStyle,
    fillOpacity: clamp(fieldConfig?.fillOpacity ?? defaultGraphStyle.fillOpacity, 0, 100) / 100,
    gradientMode: fieldConfig?.gradientMode ?? defaultGraphStyle.gradientMode,
    lineDash: getCustomLineDash(fieldConfig?.lineStyle, lineWidth),
    lineInterpolation: fieldConfig?.lineInterpolation ?? defaultGraphStyle.lineInterpolation,
    lineOpacity,
    lineWidth: drawStyle === 'points' ? 0 : lineWidth,
    pointSize: clamp(fieldConfig?.pointSize ?? defaultGraphStyle.pointSize, 1.5, 12),
    pointVisibility: shouldRenderSeriesPoints(drawStylePointVisibility, points, plotWidth) ? 'always' : 'never',
    spanNulls: typeof spanNulls === 'undefined' ? defaultGraphStyle.spanNulls : Boolean(spanNulls),
  };
}

function getStackingMode(item: TimeSeries): 'none' | 'normal' | 'percent' {
  return item.fieldConfig?.stacking?.mode ?? defaultGraphStyle.stackingMode;
}

function getStackingGroup(item: TimeSeries): string {
  return item.fieldConfig?.stacking?.group ?? '__default';
}

function hasThresholdLines(item: TimeSeries): boolean {
  const fieldMode = item.fieldConfig?.thresholdsStyle?.mode;

  if (fieldMode) {
    return fieldMode === 'line' || fieldMode === 'line+area';
  }

  return false;
}

function stackRenderableSeries(series: TimeSeries[]): TimeSeries[] {
  const percentTotals = new Map<string, number>();

  for (const item of series) {
    if (getStackingMode(item) !== 'percent') {
      continue;
    }

    const group = getStackingGroup(item);

    for (const point of item.points) {
      if (point.value === null) {
        continue;
      }

      const key = `${group}:${point.time}`;
      percentTotals.set(key, (percentTotals.get(key) ?? 0) + point.value);
    }
  }

  const runningTotals = new Map<string, number>();

  return series.map((item) => {
    const stackingMode = getStackingMode(item);

    if (stackingMode === 'none') {
      return item;
    }

    const group = getStackingGroup(item);

    return {
      ...item,
      points: item.points.map((point) => {
        if (point.value === null) {
          return point;
        }

        const key = `${group}:${point.time}`;
        const stackInput =
          stackingMode === 'percent' ? (point.value / Math.max(percentTotals.get(key) ?? 0, 1)) * 100 : point.value;
        const stackedValue = (runningTotals.get(key) ?? 0) + stackInput;
        runningTotals.set(key, stackedValue);

        return {
          ...point,
          value: stackedValue,
        };
      }),
    };
  });
}

function startOfLocalDay(time: number): number {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function addLocalDays(time: number, days: number): number {
  const date = new Date(time);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

function getDayIndex(time: number): number {
  const date = new Date(time);
  return Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86400000);
}

function getAlternatingDayBands(domainStart: number, domainEnd: number): DayBand[] {
  const bands: DayBand[] = [];
  let dayStart = startOfLocalDay(domainStart);

  while (dayStart < domainEnd) {
    const dayEnd = addLocalDays(dayStart, 1);

    if (getDayIndex(dayStart) % 2 === 0) {
      bands.push({
        key: `${dayStart}:${dayEnd}`,
        start: Math.max(domainStart, dayStart),
        end: Math.min(domainEnd, dayEnd),
      });
    }

    dayStart = dayEnd;
  }

  return bands;
}

export const HorizonPanel: React.FC<Props> = ({ options, data, width, height, timeRange, onChangeTimeRange }) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const [panelInstanceId] = useState(() => `panel-${panelInstanceSequence++}`);
  const resolvedOptions = resolveOptions(options);
  const rawSeries = extractTimeSeries(data);
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(() => new Set());
  const [dragState, setDragState] = useState<DragState | undefined>();
  const [hoverState, setHoverState] = useState<HoverState | undefined>();

  if (rawSeries.length === 0) {
    return (
      <div
        className={cx(
          styles.wrapper,
          styles.empty,
          css`
            color: ${theme.colors.text.secondary};
            width: ${width}px;
            height: ${height}px;
          `
        )}
      >
        No numeric time series
      </div>
    );
  }

  const canShowLegend = resolvedOptions.legendMode !== 'hidden' && width >= 360;
  const showRightLegend = canShowLegend && resolvedOptions.legendMode === 'right' && width >= 560;
  const showBottomLegend = canShowLegend && resolvedOptions.legendMode === 'bottom';
  const showLegend = showRightLegend || showBottomLegend;
  const legendWidth = showRightLegend ? Math.min(250, Math.max(190, width * 0.28)) : 0;
  const legendHeight = showBottomLegend ? Math.min(120, Math.max(44, 24 + rawSeries.length * 18)) : 0;
  const xAxisLabelHeight = resolvedOptions.showXAxisLabels ? 16 : 0;
  const yAxisUnitLabel = getUnitLabel(rawSeries, theme);
  const margin = {
    top: 14,
    right: legendWidth + 14,
    bottom: 24 + xAxisLabelHeight + legendHeight,
    left: yAxisUnitLabel ? 52 : 36,
  };
  const plotWidth = Math.max(1, width - margin.left - margin.right);
  const plotHeight = Math.max(1, height - margin.top - margin.bottom);
  const rangeStart = timeRange.from.valueOf();
  const rangeEnd = timeRange.to.valueOf();
  const timeScale = createNonlinearTimeScale(resolvedOptions, plotWidth, rangeStart, rangeEnd);
  const series = aggregateSeries(rawSeries, timeScale, resolvedOptions);
  const seriesIndexById = new Map(series.map((item, index) => [item.id, index]));
  const visibleRawSeries = rawSeries.filter((item) => !hiddenSeries.has(item.id));
  const visibleSeries = series.filter((item) => !hiddenSeries.has(item.id));
  const renderRawSeries = stackRenderableSeries(visibleRawSeries.filter((item) => !item.fieldConfig?.hideFrom?.viz));
  const renderSeries = aggregateSeries(renderRawSeries, timeScale, resolvedOptions);
  const legendSeries = sortLegendSeries(
    series.filter((item) => !item.fieldConfig?.hideFrom?.legend),
    resolvedOptions.legendSortMode
  );

  if (series.length === 0) {
    return (
      <div
        className={cx(
          styles.wrapper,
          styles.empty,
          css`
            color: ${theme.colors.text.secondary};
            width: ${width}px;
            height: ${height}px;
          `
        )}
      >
        No data in selected horizon
      </div>
    );
  }

  const renderSeriesMin = getMinValue(renderSeries);
  const seriesMinValue = resolvedOptions.yAxisLowerBound === 'seriesMin' ? renderSeriesMin : Math.min(0, renderSeriesMin);
  const hardMin = getHardMin(renderSeries);
  const hardMax = getHardMax(renderSeries);
  const softMin = getSoftMin(renderSeries);
  const softMax = getSoftMax(renderSeries);
  const minValue = hardMin ?? (softMin === undefined ? seriesMinValue : Math.min(seriesMinValue, softMin));
  const maxValue = hardMax ?? Math.max(getMaxValue(renderSeries), softMax ?? Number.NEGATIVE_INFINITY);
  const valueScale = createValueScale(minValue, maxValue, plotHeight, resolvedOptions.yScaleMode);
  const temporalMarkers = generateTemporalMarkers(timeScale);
  const temporalLabels = resolvedOptions.showXAxisLabels ? generateTemporalLabels(timeScale) : [];
  const x = (time: number) => margin.left + timeScale.x(time);
  const y = (value: number | null) => margin.top + valueScale.y(value);
  const zeroBaselineY =
    valueScale.min < 0 && valueScale.max > 0 ? y(0) : margin.top + plotHeight;
  const gridColor = theme.colors.border.weak;
  const textColor = theme.colors.text.secondary;
  const dayBands = getAlternatingDayBands(timeScale.domainStart, timeScale.domainEnd);
  const dayBandColor = theme.colors.emphasize(theme.colors.background.secondary, 0.08);
  const dayBandOpacity = clamp(resolvedOptions.dayBandOpacity, 0, 100) / 100;
  const shouldFill = renderSeries.some((item) => {
    return getResolvedSeriesStyle(item.fieldConfig, plotWidth, item.points).fillOpacity > 0;
  });
  const thresholdLines =
    visibleSeries.some((item) => hasThresholdLines(item))
      ? getThresholdLines(
          visibleSeries.filter((item) => hasThresholdLines(item)),
          valueScale.min,
          valueScale.max,
          theme
        )
      : [];
  const legendRows: HorizonLegendRow[] = legendSeries.map((item) => {
    const seriesIndex = seriesIndexById.get(item.id) ?? 0;
    const stats = getSeriesStats(item.points);

    return {
      color: getSeriesLineColor(item, resolvedOptions.colorPalette, seriesIndex, theme),
      id: item.id,
      isHidden: hiddenSeries.has(item.id),
      last: formatValue(stats.last, item, theme),
      max: formatValue(stats.max, item, theme),
      name: item.name,
    };
  });
  const findHoverState = (plotX: number, plotY: number): HoverState | undefined => {
    const hoverTime = timeScale.invert(plotX);
    let bestMatch:
      | {
          point: TimeSeriesPoint;
          score: number;
          series: TimeSeries;
        }
      | undefined;

    for (const item of visibleSeries.filter((seriesItem) => !seriesItem.fieldConfig?.hideFrom?.tooltip)) {
      for (const point of item.points) {
        if (point.value === null) {
          continue;
        }

        const intervalStart = point.intervalStart ?? point.time;
        const intervalEnd = point.intervalEnd ?? point.time;
        const pointX = timeScale.x(point.time);
        const containsHoverTime = hoverTime >= intervalStart && hoverTime <= intervalEnd;
        const xDistance = containsHoverTime ? 0 : Math.abs(pointX - plotX);

        if (!containsHoverTime && xDistance > 18) {
          continue;
        }

        const yDistance = Math.abs(valueScale.y(point.value) - plotY);
        const score = xDistance * 3 + yDistance;

        if (!bestMatch || score < bestMatch.score) {
          bestMatch = {
            point,
            score,
            series: item,
          };
        }
      }
    }

    if (!bestMatch) {
      return undefined;
    }

    const intervalStart = bestMatch.point.intervalStart ?? bestMatch.point.time;
    const intervalEnd = bestMatch.point.intervalEnd ?? bestMatch.point.time;
    const hover = {
      intervalEnd,
      intervalStart,
      plotX,
      plotY,
      seriesName: bestMatch.series.name,
      value: formatValue(bestMatch.point.value, bestMatch.series, theme),
    };

    return {
      ...hover,
      link:
        buildExploreLink(resolvedOptions.exploreLeftJson, hover, rangeStart, rangeEnd) ??
        buildExternalLink(resolvedOptions.externalLinkTemplate, hover, rangeStart, rangeEnd),
    };
  };
  const applyTimeRange = (from: number, to: number) => {
    const safeFrom = Math.round(Math.min(from, to));
    const safeTo = Math.round(Math.max(from, to));

    if (safeTo - safeFrom >= 1000) {
      onChangeTimeRange({
        from: safeFrom,
        to: safeTo,
      });
    }
  };
  const handlePlotPointerDown = (event: React.PointerEvent<SVGSVGElement>, plotX: number) => {
    if (!resolvedOptions.enableDragZoom || event.button !== 0 || event.ctrlKey) {
      return;
    }

    setDragState({
      currentX: plotX,
      mode: event.shiftKey ? 'pan' : 'zoom',
      startX: plotX,
    });
    setHoverState(undefined);
  };
  const handlePlotPointerMove = (event: React.PointerEvent<SVGSVGElement>, plotX: number, plotY: number) => {
    if (dragState) {
      setDragState({
        ...dragState,
        currentX: plotX,
      });
      setHoverState(undefined);
      return;
    }

    if (resolvedOptions.showTooltip) {
      setHoverState(findHoverState(plotX, plotY));
    }
  };
  const handlePlotPointerUp = (_event: React.PointerEvent<SVGSVGElement>, plotX: number) => {
    if (!dragState) {
      return;
    }

    const dragDistance = Math.abs(plotX - dragState.startX);
    const startTime = timeScale.invert(dragState.startX);
    const endTime = timeScale.invert(plotX);

    if (dragDistance >= 8) {
      if (dragState.mode === 'pan') {
        const delta = endTime - startTime;
        applyTimeRange(rangeStart - delta, rangeEnd - delta);
      } else {
        applyTimeRange(startTime, endTime);
      }
    }

    setDragState(undefined);
  };
  const handlePlotDoubleClick = () => {
    if (!resolvedOptions.enableDragZoom) {
      return;
    }

    const range = rangeEnd - rangeStart;
    const center = rangeStart + range / 2;
    applyTimeRange(center - range, center + range);
  };
  const handlePlotClick = (event: React.MouseEvent<SVGSVGElement>, plotX: number, plotY: number) => {
    if (dragState || !event.ctrlKey) {
      return;
    }

    const clickedHover = findHoverState(plotX, plotY);

    if (!clickedHover?.link) {
      return;
    }

    setHoverState(clickedHover);
    window.open(clickedHover.link, '_blank', 'noopener,noreferrer');
  };
  const toggleSeries = (seriesId: string) => {
    setHiddenSeries((previous) => {
      const next = new Set(previous);

      if (next.has(seriesId)) {
        next.delete(seriesId);
      } else {
        next.add(seriesId);
      }

      return next;
    });
  };

  return (
    <div
      data-testid="horizon-panel"
      className={cx(
        styles.wrapper,
        css`
          color: ${theme.colors.text.primary};
          width: ${width}px;
          height: ${height}px;
        `
      )}
    >
      <HorizonPlot
        className={styles.svg}
        dayBandColor={dayBandColor}
        dayBandOpacity={dayBandOpacity}
        dayBands={dayBands}
        getFillColor={(item, seriesIndex) => getSeriesFillColor(item, resolvedOptions.colorPalette, seriesIndex, theme)}
        getGradientStops={(item, color, style, seriesIndex) =>
          getGradientStops(
            style.gradientMode === 'none' ? 'opacity' : style.gradientMode,
            color,
            style.fillOpacity,
            resolvedOptions.colorPalette,
            seriesIndex,
            hasSeriesColorOverride(item)
          )
        }
        getLineColor={(item, seriesIndex) => getSeriesLineColor(item, resolvedOptions.colorPalette, seriesIndex, theme)}
        getPointColor={(item, seriesIndex) => getSeriesPointColor(item, resolvedOptions.colorPalette, seriesIndex, theme)}
        getSeriesIndex={(item) => seriesIndexById.get(item.id) ?? 0}
        getSeriesStyle={(item) => getResolvedSeriesStyle(item.fieldConfig, plotWidth, item.points) as PlotSeriesStyle}
        gridColor={gridColor}
        height={height}
        margin={margin}
        onPlotDoubleClick={handlePlotDoubleClick}
        onPlotClick={handlePlotClick}
        onPlotPointerDown={handlePlotPointerDown}
        onPlotPointerLeave={() => {
          if (!dragState) {
            setHoverState(undefined);
          }
        }}
        onPlotPointerMove={handlePlotPointerMove}
        onPlotPointerUp={handlePlotPointerUp}
        panelInstanceId={panelInstanceId}
        plotHeight={plotHeight}
        plotWidth={plotWidth}
        renderSeries={renderSeries}
        selection={dragState?.mode === 'zoom' ? { endX: dragState.currentX, startX: dragState.startX } : undefined}
        shouldFill={shouldFill}
        temporalLabels={temporalLabels}
        temporalMarkers={temporalMarkers}
        textColor={textColor}
        theme={theme}
        thresholdLines={thresholdLines}
        valueScale={valueScale}
        width={width}
        x={x}
        y={y}
        yAxisUnitLabel={yAxisUnitLabel}
        zeroBaselineY={zeroBaselineY}
      />

      {hoverState && (
        <div
          className={styles.tooltip}
          style={{
            background: theme.colors.background.secondary,
            color: theme.colors.text.primary,
            left: Math.max(4, Math.min(Math.max(4, width - 292), margin.left + hoverState.plotX + 12)),
            top: Math.max(4, Math.min(Math.max(4, height - 92), margin.top + hoverState.plotY + 12)),
          }}
        >
          <div className={styles.tooltipTitle}>{hoverState.seriesName}</div>
          <div>{hoverState.value}</div>
          <div>
            {formatTooltipTime(hoverState.intervalStart)} - {formatTooltipTime(hoverState.intervalEnd)}
          </div>
          {hoverState.link && (
            <a className={styles.tooltipLink} href={hoverState.link} rel="noreferrer" target="_blank">
              Ctrl-click chart to open
            </a>
          )}
        </div>
      )}

      {showLegend && (
        <HorizonLegend
          height={legendHeight}
          isBottom={showBottomLegend}
          marginLeft={margin.left}
          onToggle={toggleSeries}
          rows={legendRows}
          width={legendWidth}
        />
      )}
    </div>
  );
};

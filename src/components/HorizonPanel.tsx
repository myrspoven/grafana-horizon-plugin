import React, { KeyboardEvent, useMemo, useState } from 'react';
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
  `,
  legend: css`
    display: grid;
    gap: 4px;
    grid-template-columns: 1fr 48px 48px;
    overflow: hidden;
    position: absolute;
  `,
  legendHeader: css`
    font-size: 11px;
    font-weight: 600;
    line-height: 16px;
    text-align: right;
  `,
  legendName: css`
    align-items: center;
    display: flex;
    font-size: 11px;
    gap: 8px;
    line-height: 16px;
    min-width: 0;
  `,
  legendSwatch: css`
    flex: 0 0 auto;
    height: 3px;
    width: 14px;
  `,
  legendText: css`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  legendValue: css`
    font-size: 11px;
    line-height: 16px;
    text-align: right;
  `,
  legendToggle: css`
    cursor: pointer;
    user-select: none;

    &:focus-visible {
      outline: 1px solid currentColor;
      outline-offset: 2px;
    }
  `,
  legendHidden: css`
    opacity: 0.38;
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

function splitRenderableSegments(points: TimeSeriesPoint[], connectNulls: boolean): TimeSeriesPoint[][] {
  if (connectNulls) {
    const connectedPoints = points.filter((point) => point.value !== null);
    return connectedPoints.length > 0 ? [connectedPoints] : [];
  }

  const segments: TimeSeriesPoint[][] = [];
  let currentSegment: TimeSeriesPoint[] = [];

  for (const point of points) {
    if (point.value === null) {
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
        currentSegment = [];
      }

      continue;
    }

    currentSegment.push(point);
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
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

function buildLinePath(
  points: TimeSeriesPoint[],
  x: (time: number) => number,
  y: (value: number | null) => number,
  interpolation: LineInterpolation
): string {
  if (points.length === 0) {
    return '';
  }

  const [first, ...rest] = points;
  const commands = [`M ${x(first.time).toFixed(2)} ${y(first.value).toFixed(2)}`];
  let previous = first;

  for (const point of rest) {
    const previousX = x(previous.time);
    const previousY = y(previous.value);
    const pointX = x(point.time);
    const pointY = y(point.value);

    if (interpolation === 'stepAfter') {
      commands.push(`H ${pointX.toFixed(2)}`);
      commands.push(`V ${pointY.toFixed(2)}`);
    } else if (interpolation === 'stepBefore') {
      commands.push(`V ${pointY.toFixed(2)}`);
      commands.push(`H ${pointX.toFixed(2)}`);
    } else if (interpolation === 'smooth') {
      const controlOffset = (pointX - previousX) / 2;
      commands.push(
        `C ${(previousX + controlOffset).toFixed(2)} ${previousY.toFixed(2)} ${(pointX - controlOffset).toFixed(2)} ${pointY.toFixed(2)} ${pointX.toFixed(2)} ${pointY.toFixed(2)}`
      );
    } else {
      commands.push(`L ${pointX.toFixed(2)} ${pointY.toFixed(2)}`);
    }

    previous = point;
  }

  return commands.join(' ');
}

function buildStepAreaPath(
  points: TimeSeriesPoint[],
  x: (time: number) => number,
  y: (value: number | null) => number,
  baselineY: number,
  interpolation: LineInterpolation
): string {
  const linePath = buildLinePath(points, x, y, interpolation);

  if (!linePath) {
    return '';
  }

  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath} L ${x(last.time).toFixed(2)} ${baselineY.toFixed(2)} L ${x(first.time).toFixed(2)} ${baselineY.toFixed(2)} Z`;
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

  if (colorConfig?.mode === FieldColorModeId.Shades) {
    const baseColor = getThemeColor(theme, colorConfig.fixedColor ?? getPaletteColor(paletteName, 0));
    return getShadeColor(baseColor, seriesIndex);
  }

  if (colorConfig?.mode === FieldColorModeId.PaletteClassic) {
    return getThemeColor(theme, getPaletteColor('grafana', seriesIndex));
  }

  if (colorConfig?.mode === FieldColorModeId.PaletteClassicByName) {
    return getThemeColor(theme, getPaletteColor('grafana', hashString(item.name)));
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
        { color: getShadeColor(color, 1), offset: '0%', opacity: fillOpacity },
        { color, offset: '100%', opacity: Math.max(0.08, fillOpacity * 0.35) },
      ];
    }

    return [
      { color: getPaletteColor(paletteName, seriesIndex + 1), offset: '0%', opacity: fillOpacity },
      { color, offset: '100%', opacity: Math.max(0.08, fillOpacity * 0.35) },
    ];
  }

  if (hasColorOverride) {
    return [
      { color: getShadeColor(color, 3), offset: '0%', opacity: fillOpacity },
      { color, offset: '50%', opacity: fillOpacity * 0.65 },
      {
        color: getShadeColor(color, 4),
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

function getSafeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export const HorizonPanel: React.FC<Props> = ({ options, data, width, height, timeRange }) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const resolvedOptions = resolveOptions(options);
  const rawSeries = useMemo(() => extractTimeSeries(data), [data]);
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(() => new Set());

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
  const handleLegendKeyDown = (event: KeyboardEvent<HTMLDivElement>, seriesId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleSeries(seriesId);
    }
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
      <svg
        data-testid="horizon-panel-svg"
        className={styles.svg}
        width={width}
        height={height}
        xmlns="http://www.w3.org/2000/svg"
      >
        {shouldFill && (
          <defs>
            {renderSeries.map((item) => {
              const seriesIndex = seriesIndexById.get(item.id) ?? 0;
              const style = getResolvedSeriesStyle(item.fieldConfig, plotWidth, item.points);
              const color = getSeriesFillColor(item, resolvedOptions.colorPalette, seriesIndex, theme);
              const gradientId = `horizon-fill-${getSafeId(item.id)}`;
              const stops = getGradientStops(
                style.gradientMode === 'none' ? 'opacity' : style.gradientMode,
                color,
                style.fillOpacity,
                resolvedOptions.colorPalette,
                seriesIndex,
                hasSeriesColorOverride(item)
              );

              return (
                <linearGradient
                  key={gradientId}
                  id={gradientId}
                  x1="0"
                  x2="0"
                  y1={margin.top}
                  y2={margin.top + plotHeight}
                  gradientUnits="userSpaceOnUse"
                >
                  {stops.map((stop) => (
                    <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} stopOpacity={stop.opacity} />
                  ))}
                </linearGradient>
              );
            })}
          </defs>
        )}

        <g>
          {dayBands.map((band) => {
            const bandX = x(band.start);
            const bandWidth = Math.max(0, x(band.end) - bandX);

            return bandWidth > 0 ? (
              <rect
                key={band.key}
                x={bandX}
                y={margin.top}
                width={bandWidth}
                height={plotHeight}
                fill={dayBandColor}
                opacity={dayBandOpacity}
              />
            ) : null;
          })}

          {valueScale.ticks.map((tick) => (
            <g key={tick.label}>
              <line
                x1={margin.left}
                x2={margin.left + plotWidth}
                y1={margin.top + tick.y}
                y2={margin.top + tick.y}
                stroke={gridColor}
                strokeOpacity={0.5}
              />
              <text x={margin.left - 8} y={margin.top + tick.y + 4} fill={textColor} fontSize={11} textAnchor="end">
                {tick.label}
              </text>
            </g>
          ))}

          {yAxisUnitLabel && (
            <text
              x={14}
              y={margin.top + plotHeight / 2}
              fill={textColor}
              fontSize={11}
              textAnchor="middle"
              transform={`rotate(-90 14 ${margin.top + plotHeight / 2})`}
            >
              {yAxisUnitLabel}
            </text>
          )}

          {temporalMarkers.map((marker) => (
            <g key={`${marker.time}:${marker.x}`}>
              <line
                x1={x(marker.time)}
                x2={x(marker.time)}
                y1={margin.top}
                y2={margin.top + plotHeight}
                stroke={gridColor}
                strokeOpacity={marker.major ? 0.72 : 0.34}
              />
            </g>
          ))}

          {shouldFill &&
            renderSeries.map((item) => {
              const seriesIndex = seriesIndexById.get(item.id) ?? 0;
              const style = getResolvedSeriesStyle(item.fieldConfig, plotWidth, item.points);
              const color = getSeriesFillColor(item, resolvedOptions.colorPalette, seriesIndex, theme);
              const gradientId = `horizon-fill-${getSafeId(item.id)}`;
              const segments = style.fillOpacity > 0 ? splitRenderableSegments(item.points, style.spanNulls) : [];

              return segments.map((segment, segmentIndex) => {
                const areaPath = buildStepAreaPath(
                  segment,
                  x,
                  y,
                  zeroBaselineY,
                  style.lineInterpolation
                );

                return areaPath ? (
                  <path
                    key={`${item.id}:fill:${segmentIndex}`}
                    d={areaPath}
                    fill={style.gradientMode === 'none' ? color : `url(#${gradientId})`}
                    fillOpacity={style.gradientMode === 'none' ? style.fillOpacity : 1}
                    stroke="none"
                  />
                ) : null;
              });
            })}

          {renderSeries.map((item) => {
            const seriesIndex = seriesIndexById.get(item.id) ?? 0;
            const style = getResolvedSeriesStyle(item.fieldConfig, plotWidth, item.points);
            const color = getSeriesFillColor(item, resolvedOptions.colorPalette, seriesIndex, theme);

            if (style.drawStyle !== 'bars') {
              return null;
            }

            const nonNullPoints = item.points.filter((point) => point.value !== null);
            const automaticWidth = nonNullPoints.length > 0 ? (plotWidth / nonNullPoints.length) * style.barWidthFactor : 1;
            const barWidth = clamp(automaticWidth, 1, style.barMaxWidth ?? 18);
            const baseline = zeroBaselineY;

            return nonNullPoints.map((point) => {
              const barTop = y(point.value);
              const top = Math.min(barTop, baseline);
              const barHeight = Math.max(1, Math.abs(baseline - barTop));

              return (
                <rect
                  key={`${item.id}:bar:${point.time}`}
                  x={x(point.time) - barWidth / 2}
                  y={top}
                  width={barWidth}
                  height={barHeight}
                  fill={color}
                  fillOpacity={Math.max(style.fillOpacity, style.lineOpacity)}
                />
              );
            });
          })}

          {renderSeries.map((item) => {
            const seriesIndex = seriesIndexById.get(item.id) ?? 0;
            const style = getResolvedSeriesStyle(item.fieldConfig, plotWidth, item.points);
            const color = getSeriesLineColor(item, resolvedOptions.colorPalette, seriesIndex, theme);
            const segments =
              style.drawStyle === 'line' && style.lineWidth > 0
                ? splitRenderableSegments(item.points, style.spanNulls)
                : [];

            return segments.map((segment, segmentIndex) => {
              const path = buildLinePath(segment, x, y, style.lineInterpolation);

              return path ? (
                <path
                  key={`${item.id}:line:${segmentIndex}`}
                  d={path}
                  fill="none"
                  stroke={color}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={style.lineDash}
                  strokeOpacity={style.lineOpacity}
                  strokeWidth={style.lineWidth}
                />
              ) : null;
            });
          })}

          {renderSeries.map((item) => {
            const seriesIndex = seriesIndexById.get(item.id) ?? 0;
            const style = getResolvedSeriesStyle(item.fieldConfig, plotWidth, item.points);
            const color = getSeriesPointColor(item, resolvedOptions.colorPalette, seriesIndex, theme);

            if (style.pointVisibility === 'never') {
              return null;
            }

            return item.points
              .filter((point) => point.value !== null)
              .map((point) => (
                <circle
                  key={`${item.id}:point:${point.time}`}
                  cx={x(point.time)}
                  cy={y(point.value)}
                  fill={color}
                  fillOpacity={style.lineOpacity}
                  r={style.pointSize}
                  stroke={theme.colors.background.primary}
                  strokeWidth={Math.max(0.75, style.lineWidth * 0.4)}
                />
              ));
          })}

          {thresholdLines.map((threshold) => {
            const thresholdY = y(threshold.value);

            return (
              <g key={threshold.key}>
                <line
                  x1={margin.left}
                  x2={margin.left + plotWidth}
                  y1={thresholdY}
                  y2={thresholdY}
                  stroke={threshold.color}
                  strokeDasharray="5 4"
                  strokeOpacity={0.78}
                  strokeWidth={1}
                />
                {plotWidth > 140 && (
                  <text
                    x={margin.left + plotWidth - 6}
                    y={thresholdY - 4}
                    fill={threshold.color}
                    fontSize={10}
                    textAnchor="end"
                  >
                    {threshold.label}
                  </text>
                )}
              </g>
            );
          })}

          <line
            x1={margin.left}
            x2={margin.left + plotWidth}
            y1={margin.top + plotHeight}
            y2={margin.top + plotHeight}
            stroke={theme.colors.border.medium}
          />

          {temporalLabels.map((label) => (
            <text
              key={label.key}
              x={margin.left + label.x}
              y={margin.top + plotHeight + 16}
              fill={textColor}
              fontSize={11}
              textAnchor="middle"
            >
              {label.text}
            </text>
          ))}
        </g>
      </svg>

      {showLegend && (
        <div
          data-testid="horizon-legend"
          className={styles.legend}
          style={
            showBottomLegend
              ? {
                  bottom: 4,
                  color: theme.colors.text.secondary,
                  left: margin.left,
                  maxHeight: legendHeight - 6,
                  right: 8,
                }
              : {
                  color: theme.colors.text.secondary,
                  right: 8,
                  top: 8,
                  width: legendWidth,
                }
          }
        >
          <div />
          <div className={styles.legendHeader}>Last</div>
          <div className={styles.legendHeader}>Max</div>

          {legendSeries.map((item) => {
            const seriesIndex = seriesIndexById.get(item.id) ?? 0;
            const color = getSeriesLineColor(item, resolvedOptions.colorPalette, seriesIndex, theme);
            const stats = getSeriesStats(item.points);
            const isHidden = hiddenSeries.has(item.id);
            const toggleClassName = cx(styles.legendToggle, isHidden && styles.legendHidden);

            return (
              <React.Fragment key={item.id}>
                <div
                  aria-pressed={!isHidden}
                  className={cx(styles.legendName, toggleClassName)}
                  onClick={() => toggleSeries(item.id)}
                  onKeyDown={(event) => handleLegendKeyDown(event, item.id)}
                  role="button"
                  tabIndex={0}
                  title={`${isHidden ? 'Show' : 'Hide'} ${item.name}`}
                >
                  <span className={styles.legendSwatch} style={{ background: color }} />
                  <span className={styles.legendText}>{item.name}</span>
                </div>
                <div
                  className={cx(styles.legendValue, toggleClassName)}
                  onClick={() => toggleSeries(item.id)}
                  onKeyDown={(event) => handleLegendKeyDown(event, item.id)}
                  role="button"
                  tabIndex={0}
                  title={`${isHidden ? 'Show' : 'Hide'} ${item.name}`}
                >
                  {formatValue(stats.last, item, theme)}
                </div>
                <div
                  className={cx(styles.legendValue, toggleClassName)}
                  onClick={() => toggleSeries(item.id)}
                  onKeyDown={(event) => handleLegendKeyDown(event, item.id)}
                  role="button"
                  tabIndex={0}
                  title={`${isHidden ? 'Show' : 'Hide'} ${item.name}`}
                >
                  {formatValue(stats.max, item, theme)}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};

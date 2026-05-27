import React, { KeyboardEvent, useMemo, useState } from 'react';
import { PanelProps, Threshold, ThresholdsMode } from '@grafana/data';
import { css, cx } from '@emotion/css';
import { useStyles2, useTheme2 } from '@grafana/ui';

import { aggregateSeries } from '../aggregation/adaptiveBuckets';
import { extractTimeSeries, TimeSeries, TimeSeriesPoint } from '../data/extractSeries';
import { createNonlinearTimeScale } from '../scales/nonlinearTime';
import { createValueScale } from '../scales/valueScale';
import { generateTemporalMarkers } from '../rendering/markers';
import { ColorPalette, ContextCompressionOptions, GradientMode, LineStyle, resolveOptions } from '../types';

interface Props extends PanelProps<ContextCompressionOptions> {}

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

type Theme2 = ReturnType<typeof useTheme2>;

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

function formatValue(value: number | null): string {
  if (value === null) {
    return '-';
  }

  if (Math.abs(value) >= 1000) {
    return `${Math.round(value / 100) / 10}k`;
  }

  return `${Math.round(value * 10) / 10}`;
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

  return Math.max(0, Math.min(...values));
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

function buildStepPath(
  points: TimeSeriesPoint[],
  x: (time: number) => number,
  y: (value: number | null) => number
): string {
  if (points.length === 0) {
    return '';
  }

  const [first, ...rest] = points;
  const commands = [`M ${x(first.time).toFixed(2)} ${y(first.value).toFixed(2)}`];

  for (const point of rest) {
    commands.push(`H ${x(point.time).toFixed(2)}`);
    commands.push(`V ${y(point.value).toFixed(2)}`);
  }

  return commands.join(' ');
}

function buildStepAreaPath(
  points: TimeSeriesPoint[],
  x: (time: number) => number,
  y: (value: number | null) => number,
  baselineY: number
): string {
  const linePath = buildStepPath(points, x, y);

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

function getThemeColor(theme: Theme2, color: string): string {
  if (color.startsWith('#') || color.startsWith('rgb') || color.startsWith('hsl') || color.startsWith('var(')) {
    return color;
  }

  return theme.visualization.getColorByName(color);
}

function getGradientStops(
  mode: GradientMode,
  color: string,
  fillOpacity: number,
  paletteName: ColorPalette,
  seriesIndex: number
): Array<{ color: string; offset: string; opacity: number }> {
  if (mode === 'opacity') {
    return [
      { color, offset: '0%', opacity: fillOpacity },
      { color, offset: '100%', opacity: 0 },
    ];
  }

  if (mode === 'hue') {
    return [
      { color: getPaletteColor(paletteName, seriesIndex + 1), offset: '0%', opacity: fillOpacity },
      { color, offset: '100%', opacity: Math.max(0.08, fillOpacity * 0.35) },
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

function getThresholdValue(threshold: Threshold, minValue: number, maxValue: number, mode?: ThresholdsMode): number | null {
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
        label: formatValue(value),
        value,
      });
    }
  }

  return Array.from(lines.values()).sort((a, b) => b.value - a.value);
}

function getLineDash(style: LineStyle, lineWidth: number): string | undefined {
  if (style === 'dash') {
    return `${Math.max(4, lineWidth * 4)} ${Math.max(3, lineWidth * 3)}`;
  }

  if (style === 'dot') {
    return `${Math.max(1, lineWidth)} ${Math.max(3, lineWidth * 3)}`;
  }

  return undefined;
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

export const ContextCompressionPanel: React.FC<Props> = ({ options, data, width, height, timeRange }) => {
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

  const canShowLegend = resolvedOptions.showLegend && width >= 360;
  const showRightLegend = canShowLegend && resolvedOptions.legendPlacement === 'right' && width >= 560;
  const showBottomLegend = canShowLegend && resolvedOptions.legendPlacement === 'bottom';
  const showLegend = showRightLegend || showBottomLegend;
  const legendWidth = showRightLegend ? Math.min(250, Math.max(190, width * 0.28)) : 0;
  const legendHeight = showBottomLegend ? Math.min(120, Math.max(44, 24 + rawSeries.length * 18)) : 0;
  const margin = { top: 14, right: legendWidth + 14, bottom: 24 + legendHeight, left: 36 };
  const plotWidth = Math.max(1, width - margin.left - margin.right);
  const plotHeight = Math.max(1, height - margin.top - margin.bottom);
  const rangeStart = timeRange.from.valueOf();
  const rangeEnd = timeRange.to.valueOf();
  const timeScale = createNonlinearTimeScale(resolvedOptions, plotWidth, rangeStart, rangeEnd);
  const series = aggregateSeries(rawSeries, timeScale, resolvedOptions);
  const visibleSeries = series.filter((item) => !hiddenSeries.has(item.id));

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

  const minValue = resolvedOptions.yAxisLowerBound === 'seriesMin' ? getMinValue(visibleSeries) : 0;
  const valueScale = createValueScale(minValue, getMaxValue(visibleSeries), plotHeight, resolvedOptions.yScaleMode);
  const temporalMarkers = generateTemporalMarkers(timeScale);
  const x = (time: number) => margin.left + timeScale.x(time);
  const y = (value: number | null) => margin.top + valueScale.y(value);
  const gridColor = theme.colors.border.weak;
  const textColor = theme.colors.text.secondary;
  const dayBands = getAlternatingDayBands(timeScale.domainStart, timeScale.domainEnd);
  const lineOpacity = clamp(resolvedOptions.lineOpacity, 0.1, 1);
  const fillOpacity = clamp(resolvedOptions.fillOpacity, 0, 100) / 100;
  const lineDash = getLineDash(resolvedOptions.lineStyle, resolvedOptions.lineWidth);
  const shouldFill = fillOpacity > 0;
  const effectiveFillOpacity = shouldFill ? fillOpacity : 0;
  const thresholdLines =
    resolvedOptions.thresholdDisplay === 'lines'
      ? getThresholdLines(visibleSeries, valueScale.min, valueScale.max, theme)
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
            {visibleSeries.map((item) => {
              const seriesIndex = series.findIndex((seriesItem) => seriesItem.id === item.id);
              const color = item.color ?? getPaletteColor(resolvedOptions.colorPalette, seriesIndex);
              const gradientId = `horizon-fill-${getSafeId(item.id)}`;
              const stops = getGradientStops(
                resolvedOptions.gradientMode === 'none' ? 'opacity' : resolvedOptions.gradientMode,
                color,
                effectiveFillOpacity,
                resolvedOptions.colorPalette,
                seriesIndex
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
                fill={theme.colors.background.secondary}
                opacity={0.32}
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
            visibleSeries.map((item) => {
              const seriesIndex = series.findIndex((seriesItem) => seriesItem.id === item.id);
              const color = item.color ?? getPaletteColor(resolvedOptions.colorPalette, seriesIndex);
              const areaPath = buildStepAreaPath(item.points, x, y, margin.top + plotHeight);
              const gradientId = `horizon-fill-${getSafeId(item.id)}`;

              return areaPath ? (
                <path
                  key={`${item.id}:fill`}
                  d={areaPath}
                  fill={resolvedOptions.gradientMode === 'none' ? color : `url(#${gradientId})`}
                  fillOpacity={resolvedOptions.gradientMode === 'none' ? effectiveFillOpacity : 1}
                  stroke="none"
                />
              ) : null;
            })}

          {visibleSeries.map((item) => {
            const seriesIndex = series.findIndex((seriesItem) => seriesItem.id === item.id);
            const color = item.color ?? getPaletteColor(resolvedOptions.colorPalette, seriesIndex);
            const path = buildStepPath(item.points, x, y);

            return path ? (
              <path
                key={item.id}
                d={path}
                fill="none"
                stroke={color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={lineDash}
                strokeOpacity={lineOpacity}
                strokeWidth={resolvedOptions.lineWidth}
              />
            ) : null;
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

          {series.map((item, index) => {
            const color = item.color ?? getPaletteColor(resolvedOptions.colorPalette, index);
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
                  {formatValue(stats.last)}
                </div>
                <div
                  className={cx(styles.legendValue, toggleClassName)}
                  onClick={() => toggleSeries(item.id)}
                  onKeyDown={(event) => handleLegendKeyDown(event, item.id)}
                  role="button"
                  tabIndex={0}
                  title={`${isHidden ? 'Show' : 'Hide'} ${item.name}`}
                >
                  {formatValue(stats.max)}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
};

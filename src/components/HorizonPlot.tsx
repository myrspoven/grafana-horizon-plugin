import React, { MouseEvent, PointerEvent } from 'react';

import { TimeSeries } from '../data/extractSeries';
import { TemporalMarker } from '../rendering/markers';
import { TemporalLabel } from '../rendering/timeLabels';
import { buildLinePath, buildStepAreaPath, splitRenderableSegments } from '../rendering/seriesPaths';
import { LineInterpolation } from '../types';

interface PlotMargin {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

interface PlotValueScale {
  min: number;
  max: number;
  ticks: Array<{
    label: string;
    y: number;
  }>;
}

interface PlotDayBand {
  end: number;
  key: string;
  start: number;
}

interface PlotThresholdLine {
  color: string;
  key: string;
  label: string;
  value: number;
}

export interface PlotSeriesStyle {
  barMaxWidth?: number;
  barWidthFactor: number;
  drawStyle: 'bars' | 'line' | 'points';
  fillOpacity: number;
  gradientMode: 'none' | 'opacity' | 'hue' | 'scheme';
  lineDash?: string;
  lineInterpolation: LineInterpolation;
  lineOpacity: number;
  lineWidth: number;
  pointSize: number;
  pointVisibility: 'auto' | 'always' | 'never';
  spanNulls: boolean;
}

interface GradientStop {
  color: string;
  offset: string;
  opacity: number;
}

interface PlotTheme {
  colors: {
    background: {
      primary: string;
    };
    border: {
      medium: string;
    };
  };
}

interface HorizonPlotProps {
  className: string;
  dayBandColor: string;
  dayBandOpacity: number;
  dayBands: PlotDayBand[];
  getFillColor: (item: TimeSeries, seriesIndex: number) => string;
  getGradientStops: (item: TimeSeries, color: string, style: PlotSeriesStyle, seriesIndex: number) => GradientStop[];
  getLineColor: (item: TimeSeries, seriesIndex: number) => string;
  getPointColor: (item: TimeSeries, seriesIndex: number) => string;
  getSeriesIndex: (item: TimeSeries) => number;
  getSeriesStyle: (item: TimeSeries) => PlotSeriesStyle;
  gridColor: string;
  height: number;
  margin: PlotMargin;
  onPlotClick?: (event: MouseEvent<SVGSVGElement>, plotX: number, plotY: number) => void;
  onPlotDoubleClick?: () => void;
  onPlotPointerDown?: (event: PointerEvent<SVGSVGElement>, plotX: number, plotY: number) => void;
  onPlotPointerLeave?: () => void;
  onPlotPointerMove?: (event: PointerEvent<SVGSVGElement>, plotX: number, plotY: number) => void;
  onPlotPointerUp?: (event: PointerEvent<SVGSVGElement>, plotX: number, plotY: number) => void;
  panelInstanceId: string;
  plotHeight: number;
  plotWidth: number;
  renderSeries: TimeSeries[];
  selection?: {
    endX: number;
    startX: number;
  };
  shouldFill: boolean;
  temporalLabels: TemporalLabel[];
  temporalMarkers: TemporalMarker[];
  textColor: string;
  theme: PlotTheme;
  thresholdLines: PlotThresholdLine[];
  valueScale: PlotValueScale;
  width: number;
  x: (time: number) => number;
  y: (value: number | null) => number;
  yAxisUnitLabel?: string;
  zeroBaselineY: number;
}

function getSafeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '-');
}

export function HorizonPlot({
  className,
  dayBandColor,
  dayBandOpacity,
  dayBands,
  getFillColor,
  getGradientStops,
  getLineColor,
  getPointColor,
  getSeriesIndex,
  getSeriesStyle,
  gridColor,
  height,
  margin,
  onPlotClick,
  onPlotDoubleClick,
  onPlotPointerDown,
  onPlotPointerLeave,
  onPlotPointerMove,
  onPlotPointerUp,
  panelInstanceId,
  plotHeight,
  plotWidth,
  renderSeries,
  selection,
  shouldFill,
  temporalLabels,
  temporalMarkers,
  textColor,
  theme,
  thresholdLines,
  valueScale,
  width,
  x,
  y,
  yAxisUnitLabel,
  zeroBaselineY,
}: HorizonPlotProps) {
  const getPlotPosition = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      plotX: Math.max(0, Math.min(plotWidth, event.clientX - rect.left - margin.left)),
      plotY: Math.max(0, Math.min(plotHeight, event.clientY - rect.top - margin.top)),
    };
  };
  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    const { plotX, plotY } = getPlotPosition(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    onPlotPointerDown?.(event, plotX, plotY);
  };
  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const { plotX, plotY } = getPlotPosition(event);
    onPlotPointerMove?.(event, plotX, plotY);
  };
  const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
    const { plotX, plotY } = getPlotPosition(event);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onPlotPointerUp?.(event, plotX, plotY);
  };
  const handleClick = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const plotX = Math.max(0, Math.min(plotWidth, event.clientX - rect.left - margin.left));
    const plotY = Math.max(0, Math.min(plotHeight, event.clientY - rect.top - margin.top));
    onPlotClick?.(event, plotX, plotY);
  };
  const selectionX = selection ? Math.min(selection.startX, selection.endX) : 0;
  const selectionWidth = selection ? Math.abs(selection.endX - selection.startX) : 0;

  return (
    <svg
      data-testid="horizon-panel-svg"
      className={className}
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      onClick={handleClick}
      onDoubleClick={onPlotDoubleClick}
      onPointerDown={handlePointerDown}
      onPointerLeave={onPlotPointerLeave}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {shouldFill && (
        <defs>
          {renderSeries.map((item) => {
            const seriesIndex = getSeriesIndex(item);
            const style = getSeriesStyle(item);
            const color = getFillColor(item, seriesIndex);
            const gradientId = `horizon-fill-${panelInstanceId}-${getSafeId(item.id)}`;
            const stops = getGradientStops(item, color, style, seriesIndex);

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
            const seriesIndex = getSeriesIndex(item);
            const style = getSeriesStyle(item);
            const color = getFillColor(item, seriesIndex);
            const gradientId = `horizon-fill-${panelInstanceId}-${getSafeId(item.id)}`;
            const segments = style.fillOpacity > 0 ? splitRenderableSegments(item.points, style.spanNulls) : [];

            return segments.map((segment, segmentIndex) => {
              const areaPath = buildStepAreaPath(segment, x, y, zeroBaselineY, style.lineInterpolation);

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
          const seriesIndex = getSeriesIndex(item);
          const style = getSeriesStyle(item);
          const color = getFillColor(item, seriesIndex);

          if (style.drawStyle !== 'bars') {
            return null;
          }

          const nonNullPoints = item.points.filter((point) => point.value !== null);
          const automaticWidth = nonNullPoints.length > 0 ? (plotWidth / nonNullPoints.length) * style.barWidthFactor : 1;
          const barWidth = Math.min(style.barMaxWidth ?? 18, Math.max(1, automaticWidth));

          return nonNullPoints.map((point) => {
            const barTop = y(point.value);
            const top = Math.min(barTop, zeroBaselineY);
            const barHeight = Math.max(1, Math.abs(zeroBaselineY - barTop));

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
          const seriesIndex = getSeriesIndex(item);
          const style = getSeriesStyle(item);
          const color = getLineColor(item, seriesIndex);
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
          const seriesIndex = getSeriesIndex(item);
          const style = getSeriesStyle(item);
          const color = getPointColor(item, seriesIndex);

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

        {selection && selectionWidth > 2 && (
          <rect
            x={margin.left + selectionX}
            y={margin.top}
            width={selectionWidth}
            height={plotHeight}
            fill={theme.colors.border.medium}
            opacity={0.22}
            pointerEvents="none"
          />
        )}
      </g>
    </svg>
  );
}

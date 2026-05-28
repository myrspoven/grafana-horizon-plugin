import { DataFrame, Field, FieldColorModeId, FieldType, PanelData, ThresholdsConfig } from '@grafana/data';

export type StandardDrawStyle = 'bars' | 'line' | 'points';
export type StandardGradientMode = 'hue' | 'none' | 'opacity' | 'scheme';
export type StandardLineInterpolation = 'linear' | 'smooth' | 'stepAfter' | 'stepBefore';
export type StandardPointVisibility = 'always' | 'auto' | 'never';
export type StandardStackingMode = 'none' | 'normal' | 'percent';
export type StandardThresholdsStyleMode = 'area' | 'line' | 'line+area' | 'off' | 'series';
export type StandardTransform = 'constant' | 'negative-Y';

export interface StandardLineStyle {
  dash?: number[];
  fill?: 'dash' | 'dot' | 'solid' | 'square';
}

export interface StandardHideFromConfig {
  legend?: boolean;
  tooltip?: boolean;
  viz?: boolean;
}

export interface StandardStackingConfig {
  group?: string;
  mode?: StandardStackingMode;
}

export interface StandardThresholdsStyleConfig {
  mode?: StandardThresholdsStyleMode;
}

export interface StandardTimeSeriesFieldConfig {
  axisSoftMax?: number;
  axisSoftMin?: number;
  barMaxWidth?: number;
  barWidthFactor?: number;
  drawStyle?: StandardDrawStyle;
  fillOpacity?: number;
  gradientMode?: StandardGradientMode;
  hideFrom?: StandardHideFromConfig;
  fillColor?: string;
  lineInterpolation?: StandardLineInterpolation;
  lineColor?: string;
  lineStyle?: StandardLineStyle;
  lineWidth?: number;
  pointColor?: string;
  pointSize?: number;
  showPoints?: StandardPointVisibility;
  spanNulls?: boolean | number;
  stacking?: StandardStackingConfig;
  thresholdsStyle?: StandardThresholdsStyleConfig;
  transform?: StandardTransform;
}

export interface TimeSeriesPoint {
  time: number;
  value: number | null;
}

export interface TimeSeries {
  id: string;
  name: string;
  color?: string;
  fieldConfig?: StandardTimeSeriesFieldConfig;
  labels?: Record<string, string>;
  points: TimeSeriesPoint[];
  thresholds?: ThresholdsConfig;
}

function readValue(values: unknown, index: number): unknown {
  if (values && typeof (values as { get?: (index: number) => unknown }).get === 'function') {
    return (values as { get: (index: number) => unknown }).get(index);
  }

  return (values as ArrayLike<unknown>)[index];
}

function fieldLength(field: Field): number {
  return field.values?.length ?? 0;
}

function toMillis(value: unknown): number | null {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function getSeriesName(frame: DataFrame, field: Field): string {
  const configuredName = field.config?.displayName ?? field.config?.displayNameFromDS;
  if (configuredName) {
    return configuredName;
  }

  if (field.name && field.name !== 'Value') {
    return field.name;
  }

  return frame.name || field.name || frame.refId || 'Series';
}

function getSeriesColor(field: Field): string | undefined {
  const color = field.config?.color;

  if (color?.mode === FieldColorModeId.Fixed && color.fixedColor) {
    return color.fixedColor;
  }

  return undefined;
}

function getTimeSeriesFieldConfig(field: Field): StandardTimeSeriesFieldConfig | undefined {
  const custom = field.config.custom;

  if (!custom || typeof custom !== 'object') {
    return undefined;
  }

  return custom as StandardTimeSeriesFieldConfig;
}

function applyTransform(value: number | null, fieldConfig: StandardTimeSeriesFieldConfig | undefined): number | null {
  if (value === null) {
    return null;
  }

  if (fieldConfig?.transform === 'negative-Y') {
    return -value;
  }

  return value;
}

export function extractTimeSeries(data: PanelData): TimeSeries[] {
  const series: TimeSeries[] = [];

  for (const frame of data.series) {
    const timeField = frame.fields.find((field) => field.type === FieldType.time);
    const valueFields = frame.fields.filter((field) => field.type === FieldType.number);

    if (!timeField || valueFields.length === 0) {
      continue;
    }

    for (const valueField of valueFields) {
      const fieldConfig = getTimeSeriesFieldConfig(valueField);
      const length = Math.min(fieldLength(timeField), fieldLength(valueField));
      const points: TimeSeriesPoint[] = [];

      for (let index = 0; index < length; index++) {
        const time = toMillis(readValue(timeField.values, index));
        if (time === null) {
          continue;
        }

        points.push({
          time,
          value: applyTransform(toNumber(readValue(valueField.values, index)), fieldConfig),
        });
      }

      if (points.length === 0) {
        continue;
      }

      points.sort((a, b) => a.time - b.time);

      series.push({
        id: `${frame.refId ?? frame.name ?? 'frame'}:${valueField.name}:${series.length}`,
        name: getSeriesName(frame, valueField),
        color: getSeriesColor(valueField),
        fieldConfig,
        labels: valueField.labels,
        points,
        thresholds: valueField.config.thresholds,
      });
    }
  }

  return series;
}

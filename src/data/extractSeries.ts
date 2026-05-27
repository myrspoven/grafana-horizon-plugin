import { DataFrame, Field, FieldType, PanelData, ThresholdsConfig } from '@grafana/data';

export interface TimeSeriesPoint {
  time: number;
  value: number | null;
}

export interface TimeSeries {
  id: string;
  name: string;
  color?: string;
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
  return field.config?.color?.fixedColor;
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
      const length = Math.min(fieldLength(timeField), fieldLength(valueField));
      const points: TimeSeriesPoint[] = [];

      for (let index = 0; index < length; index++) {
        const time = toMillis(readValue(timeField.values, index));
        if (time === null) {
          continue;
        }

        points.push({
          time,
          value: toNumber(readValue(valueField.values, index)),
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
        labels: valueField.labels,
        points,
        thresholds: valueField.config.thresholds,
      });
    }
  }

  return series;
}

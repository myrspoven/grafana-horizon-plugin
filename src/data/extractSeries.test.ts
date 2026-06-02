import { FieldColorModeId, FieldType, PanelData } from '@grafana/data';

import { extractTimeSeries } from './extractSeries';

function panelDataWithColor(mode: FieldColorModeId, fixedColor?: string): PanelData {
  return {
    series: [
      {
        fields: [
          {
            config: {},
            name: 'Time',
            type: FieldType.time,
            values: [1000, 2000],
          },
          {
            config: {
              color: {
                fixedColor,
                mode,
              },
            },
            name: 'Value',
            type: FieldType.number,
            values: [1, 2],
          },
        ],
        length: 2,
        name: 'Series',
        refId: 'A',
      },
    ],
    state: 'Done',
    timeRange: {} as PanelData['timeRange'],
  } as PanelData;
}

describe('extractTimeSeries', () => {
  it('uses a fixed field color as an explicit series color override', () => {
    const series = extractTimeSeries(panelDataWithColor(FieldColorModeId.Fixed, '#ff00aa'));

    expect(series[0].color).toBe('#ff00aa');
  });

  it('does not treat palette field colors as explicit series color overrides', () => {
    const series = extractTimeSeries(panelDataWithColor(FieldColorModeId.PaletteClassic, '#ff00aa'));

    expect(series[0].color).toBeUndefined();
  });

  it('uses a single Prometheus label value as the series name before datasource display names', () => {
    const data = panelDataWithColor(FieldColorModeId.PaletteClassic);
    data.series[0].fields[1].labels = {
      outcome: 'success',
    };
    data.series[0].fields[1].config.displayNameFromDS = 'prod_optimizer_process_count_w_outcome_total';

    const series = extractTimeSeries(data);

    expect(series[0].name).toBe('success');
  });

  it('uses all label values as the series name when a Prometheus field has multiple labels', () => {
    const data = panelDataWithColor(FieldColorModeId.PaletteClassic);
    data.series[0].fields[1].labels = {
      environment: 'prod',
      outcome: 'failed',
    };

    const series = extractTimeSeries(data);

    expect(series[0].name).toBe('prod failed');
  });

  it('preserves Grafana TimeSeries custom field config from imported panels', () => {
    const data = panelDataWithColor(FieldColorModeId.PaletteClassic);
    data.series[0].fields[1].config.custom = {
      drawStyle: 'points',
      fillOpacity: 42,
      lineInterpolation: 'smooth',
      lineWidth: 0,
      showPoints: 'always',
      spanNulls: false,
      stacking: {
        mode: 'normal',
      },
    };

    const series = extractTimeSeries(data);

    expect(series[0].fieldConfig).toMatchObject({
      drawStyle: 'points',
      fillOpacity: 42,
      lineInterpolation: 'smooth',
      lineWidth: 0,
      showPoints: 'always',
      spanNulls: false,
      stacking: {
        mode: 'normal',
      },
    });
  });

  it('applies the standard negative-y transform', () => {
    const data = panelDataWithColor(FieldColorModeId.PaletteClassic);
    data.series[0].fields[1].config.custom = {
      transform: 'negative-Y',
    };

    const series = extractTimeSeries(data);

    expect(series[0].points.map((point) => point.value)).toEqual([-1, -2]);
  });
});

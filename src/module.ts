import { FieldColorModeId, FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { StandardTimeSeriesFieldConfig } from './data/extractSeries';
import { HorizonPanel } from './components/HorizonPanel';
import { HorizonOptions, defaultOptions } from './types';

export const plugin = new PanelPlugin<HorizonOptions, StandardTimeSeriesFieldConfig>(HorizonPanel)
  .useFieldConfig({
    standardOptions: {
      [FieldConfigProperty.Color]: {
        defaultValue: {
          mode: FieldColorModeId.PaletteClassic,
        },
        settings: {
          byValueSupport: false,
          bySeriesSupport: true,
        },
      },
      [FieldConfigProperty.Thresholds]: {},
    },
    useCustomConfig: (builder) => {
      const graphStyles = ['Graph styles'];
      const lineStyles = ['Graph styles', 'Lines'];
      const fillStyles = ['Graph styles', 'Fill'];
      const pointStyles = ['Graph styles', 'Points'];
      const barStyles = ['Graph styles', 'Bars'];
      const stacking = ['Stacking'];
      const axis = ['Axis'];
      const thresholds = ['Thresholds'];
      const advanced = ['Advanced'];

      builder
        .addRadio({
          path: 'drawStyle',
          name: 'Style',
          category: graphStyles,
          defaultValue: 'line',
          settings: {
            options: [
              { value: 'line', label: 'Lines' },
              { value: 'bars', label: 'Bars' },
              { value: 'points', label: 'Points' },
            ],
          },
        })
        .addRadio({
          path: 'lineInterpolation',
          name: 'Line interpolation',
          category: lineStyles,
          defaultValue: 'stepAfter',
          settings: {
            options: [
              { value: 'linear', label: 'Linear' },
              { value: 'smooth', label: 'Smooth' },
              { value: 'stepAfter', label: 'Step after' },
              { value: 'stepBefore', label: 'Step before' },
            ],
          },
        })
        .addSliderInput({
          path: 'lineWidth',
          name: 'Line width',
          category: lineStyles,
          defaultValue: 1.5,
          settings: {
            min: 0,
            max: 10,
            step: 0.5,
          },
        })
        .addSliderInput({
          path: 'lineOpacity',
          name: 'Line opacity',
          category: lineStyles,
          defaultValue: 0.95,
          settings: {
            min: 0,
            max: 1,
            step: 0.05,
          },
        })
        .addRadio({
          path: 'lineStyle.fill',
          name: 'Line style',
          category: lineStyles,
          defaultValue: 'solid',
          settings: {
            options: [
              { value: 'solid', label: 'Solid' },
              { value: 'dash', label: 'Dash' },
              { value: 'dot', label: 'Dots' },
            ],
          },
        })
        .addSliderInput({
          path: 'fillOpacity',
          name: 'Fill opacity',
          category: fillStyles,
          defaultValue: 0,
          settings: {
            min: 0,
            max: 100,
            step: 1,
          },
        })
        .addRadio({
          path: 'gradientMode',
          name: 'Gradient mode',
          category: fillStyles,
          defaultValue: 'none',
          settings: {
            options: [
              { value: 'none', label: 'None' },
              { value: 'opacity', label: 'Opacity' },
              { value: 'hue', label: 'Hue' },
              { value: 'scheme', label: 'Scheme' },
            ],
          },
        })
        .addBooleanSwitch({
          path: 'spanNulls',
          name: 'Connect null values',
          category: lineStyles,
          defaultValue: true,
        })
        .addRadio({
          path: 'showPoints',
          name: 'Show points',
          category: pointStyles,
          defaultValue: 'auto',
          settings: {
            options: [
              { value: 'auto', label: 'Auto' },
              { value: 'always', label: 'Always' },
              { value: 'never', label: 'Never' },
            ],
          },
        })
        .addSliderInput({
          path: 'pointSize',
          name: 'Point size',
          category: pointStyles,
          defaultValue: 4,
          settings: {
            min: 1,
            max: 40,
            step: 1,
          },
        })
        .addSliderInput({
          path: 'barWidthFactor',
          name: 'Bar width factor',
          category: barStyles,
          defaultValue: 0.6,
          settings: {
            min: 0.05,
            max: 1,
            step: 0.05,
          },
        })
        .addSliderInput({
          path: 'barMaxWidth',
          name: 'Bar max width',
          category: barStyles,
          defaultValue: 18,
          settings: {
            min: 1,
            max: 100,
            step: 1,
          },
        })
        .addRadio({
          path: 'stacking',
          name: 'Stack series',
          category: stacking,
          defaultValue: { mode: 'none' },
          settings: {
            options: [
              { value: { mode: 'none' }, label: 'Off' },
              { value: { mode: 'normal' }, label: 'Normal' },
              { value: { mode: 'percent' }, label: '100%' },
            ],
          },
        })
        .addNumberInput({
          path: 'axisSoftMin',
          name: 'Soft min',
          category: axis,
        })
        .addNumberInput({
          path: 'axisSoftMax',
          name: 'Soft max',
          category: axis,
        })
        .addRadio({
          path: 'thresholdsStyle.mode',
          name: 'Show thresholds',
          category: thresholds,
          defaultValue: 'off',
          settings: {
            options: [
              { value: 'off', label: 'Off' },
              { value: 'line', label: 'As lines' },
              { value: 'line+area', label: 'As lines and area' },
            ],
          },
        })
        .addRadio({
          path: 'transform',
          name: 'Transform',
          category: advanced,
          settings: {
            options: [
              { value: undefined, label: 'None' },
              { value: 'negative-Y', label: 'Negative Y' },
            ],
          },
        });
    },
  })
  .setPanelOptions((builder) => {
    const horizon = ['Horizon'];
    const timeline = ['Timeline'];
    const yAxis = ['Y-axis'];
    const colors = ['Colors'];
    const legend = ['Legend'];

    return builder
      .addSliderInput({
        path: 'compressionFocusHours',
        name: 'Compression focus (hours)',
        category: horizon,
        defaultValue: defaultOptions.compressionFocusHours,
        settings: {
          min: 1,
          max: 168,
          step: 1,
        },
      })
      .addRadio({
        path: 'aggregationMode',
        defaultValue: defaultOptions.aggregationMode,
        name: 'Bucket aggregation',
        category: horizon,
        settings: {
          options: [
            {
              value: 'max',
              label: 'Max',
            },
            {
              value: 'avg',
              label: 'Average',
            },
          ],
        },
      })
      .addRadio({
        path: 'yScaleMode',
        defaultValue: defaultOptions.yScaleMode,
        name: 'Y-axis scale',
        category: yAxis,
        settings: {
          options: [
            {
              value: 'log1p',
              label: 'Compressed log1p',
            },
            {
              value: 'linear',
              label: 'Linear',
            },
          ],
        },
      })
      .addRadio({
        path: 'yAxisLowerBound',
        defaultValue: defaultOptions.yAxisLowerBound,
        name: 'Y-axis lower bound',
        category: yAxis,
        settings: {
          options: [
            {
              value: 'zero',
              label: 'Zero',
            },
            {
              value: 'seriesMin',
              label: 'Series minimum',
            },
          ],
        },
      })
      .addRadio({
        path: 'colorPalette',
        defaultValue: defaultOptions.colorPalette,
        name: 'Color palette',
        category: colors,
        settings: {
          options: [
            {
              value: 'grafana',
              label: 'Grafana',
            },
            {
              value: 'classic',
              label: 'Classic',
            },
            {
              value: 'cool',
              label: 'Cool',
            },
            {
              value: 'warm',
              label: 'Warm',
            },
          ],
        },
      })
      .addBooleanSwitch({
        path: 'showXAxisLabels',
        name: 'Show X-axis labels',
        category: timeline,
        defaultValue: defaultOptions.showXAxisLabels,
      })
      .addSliderInput({
        path: 'dayBandOpacity',
        name: 'Day band brightness',
        category: timeline,
        defaultValue: defaultOptions.dayBandOpacity,
        settings: {
          min: 0,
          max: 100,
          step: 1,
        },
      })
      .addRadio({
        path: 'legendMode',
        defaultValue: defaultOptions.legendMode,
        name: 'Legend',
        category: legend,
        settings: {
          options: [
            {
              value: 'hidden',
              label: 'Hidden',
            },
            {
              value: 'right',
              label: 'Right',
            },
            {
              value: 'bottom',
              label: 'Bottom',
            },
          ],
        },
      })
      .addRadio({
        path: 'legendSortMode',
        defaultValue: defaultOptions.legendSortMode,
        name: 'Legend order',
        category: legend,
        settings: {
          options: [
            {
              value: 'original',
              label: 'Query order',
            },
            {
              value: 'alphabetical',
              label: 'Alphabetical',
            },
            {
              value: 'valueDesc',
              label: 'Last value, then max',
            },
          ],
        },
      });
  });

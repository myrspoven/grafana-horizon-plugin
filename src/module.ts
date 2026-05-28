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
      const stacking = ['Stacking'];
      const axis = ['Axis'];
      const visibility = ['Visibility'];
      const thresholds = ['Thresholds'];

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
          category: graphStyles,
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
          category: graphStyles,
          defaultValue: 1.5,
          settings: {
            min: 0,
            max: 10,
            step: 0.5,
          },
        })
        .addRadio({
          path: 'lineStyle',
          name: 'Line style',
          category: graphStyles,
          defaultValue: { fill: 'solid' },
          settings: {
            options: [
              { value: { fill: 'solid' }, label: 'Solid' },
              { value: { fill: 'dash' }, label: 'Dash' },
              { value: { fill: 'dot' }, label: 'Dots' },
            ],
          },
        })
        .addSliderInput({
          path: 'fillOpacity',
          name: 'Fill opacity',
          category: graphStyles,
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
          category: graphStyles,
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
          category: graphStyles,
          defaultValue: true,
        })
        .addRadio({
          path: 'showPoints',
          name: 'Show points',
          category: graphStyles,
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
          category: graphStyles,
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
          category: graphStyles,
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
          category: graphStyles,
          defaultValue: 18,
          settings: {
            min: 1,
            max: 100,
            step: 1,
          },
        })
        .addColorPicker({
          path: 'lineColor',
          name: 'Line color',
          category: graphStyles,
        })
        .addColorPicker({
          path: 'fillColor',
          name: 'Fill color',
          category: graphStyles,
        })
        .addColorPicker({
          path: 'pointColor',
          name: 'Point color',
          category: graphStyles,
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
        .addBooleanSwitch({
          path: 'hideFrom.viz',
          name: 'Hide in visualization',
          category: visibility,
          defaultValue: false,
        })
        .addBooleanSwitch({
          path: 'hideFrom.legend',
          name: 'Hide in legend',
          category: visibility,
          defaultValue: false,
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
          category: graphStyles,
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
    return builder
      .addSliderInput({
        path: 'compressionFocusHours',
        name: 'Compression focus (hours)',
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
      .addSliderInput({
        path: 'lineOpacity',
        name: 'Line opacity',
        defaultValue: defaultOptions.lineOpacity,
        settings: {
          min: 0,
          max: 1,
          step: 0.05,
        },
      })
      .addBooleanSwitch({
        path: 'showLegend',
        name: 'Show legend',
        defaultValue: defaultOptions.showLegend,
      })
      .addBooleanSwitch({
        path: 'showXAxisLabels',
        name: 'Show X-axis labels',
        defaultValue: defaultOptions.showXAxisLabels,
      })
      .addSliderInput({
        path: 'dayBandOpacity',
        name: 'Day band brightness',
        defaultValue: defaultOptions.dayBandOpacity,
        settings: {
          min: 0,
          max: 100,
          step: 1,
        },
      })
      .addRadio({
        path: 'legendPlacement',
        defaultValue: defaultOptions.legendPlacement,
        name: 'Legend placement',
        settings: {
          options: [
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

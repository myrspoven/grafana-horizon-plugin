import { PanelPlugin } from '@grafana/data';
import { ContextCompressionPanel } from './components/ContextCompressionPanel';
import { ContextCompressionOptions, defaultOptions } from './types';

export const plugin = new PanelPlugin<ContextCompressionOptions>(ContextCompressionPanel).setPanelOptions((builder) => {
  return builder
    .addNumberInput({
      path: 'recentDurationHours',
      name: 'Recent duration (hours)',
      defaultValue: defaultOptions.recentDurationHours,
    })
    .addNumberInput({
      path: 'transitionDurationHours',
      name: 'Transition duration (hours)',
      defaultValue: defaultOptions.transitionDurationHours,
    })
    .addNumberInput({
      path: 'historicalDurationHours',
      name: 'Historical duration (hours)',
      defaultValue: defaultOptions.historicalDurationHours,
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
    .addNumberInput({
      path: 'lineWidth',
      name: 'Line width',
      defaultValue: defaultOptions.lineWidth,
    })
    .addNumberInput({
      path: 'lineOpacity',
      name: 'Line opacity',
      defaultValue: defaultOptions.lineOpacity,
      settings: {
        min: 0.1,
        max: 1,
        step: 0.05,
      },
    })
    .addRadio({
      path: 'lineStyle',
      defaultValue: defaultOptions.lineStyle,
      name: 'Line style',
      settings: {
        options: [
          {
            value: 'solid',
            label: 'Solid',
          },
          {
            value: 'dash',
            label: 'Dash',
          },
          {
            value: 'dot',
            label: 'Dot',
          },
        ],
      },
    })
    .addBooleanSwitch({
      path: 'showLegend',
      name: 'Show legend',
      defaultValue: defaultOptions.showLegend,
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
    });
});

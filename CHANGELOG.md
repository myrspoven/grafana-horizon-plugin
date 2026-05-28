# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html) for release tags.

## [Unreleased]

No changes yet.

## [0.0.16] - 2026-05-28

### Added

- Field default/override options for connecting null values, point visibility, stacked series rendering, and legend sorting.
- Grafana TimeSeries-style field override support for draw style, interpolation, line/fill/point styling, stacking, soft axis bounds, visibility, thresholds style, and negative-Y transform.
- Optional collision-aware X-axis labels with hourly labels for the last range day and day labels for older visible days.
- Day band brightness option for tuning alternating background stripe intensity.

## [0.0.15] - 2026-05-27

### Added

- Grafana field config support for per-series color overrides and thresholds.
- Fill opacity and gradient mode panel options for area styling.
- Optional dashed threshold lines rendered from Grafana field thresholds.
- Y-axis lower bound option for zero-based or visible-minimum scaling.
- Alternating day background bands across the nonlinear timeline.
- Nonlinear grid markers and day bands now follow Grafana's selected time range.
- Removed legacy transition/historical horizon options and renamed recent duration to compression focus.
- Line interpolation options and bounded sliders for numeric graph style settings.

## [0.0.1] - 2026-05-25

### Added

- Initial Horizon panel implementation.
- Continuous nonlinear time projection.
- Automatic screen-space aggregation.
- Configurable Y-axis scale, palette, line styling, and legend placement.
- Clickable legend rows for local series visibility.
- Provisioned local demo dashboard.
- Open-source release documentation and GitHub release workflow.

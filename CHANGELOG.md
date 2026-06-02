# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html) for release tags.

## [Unreleased]

No changes yet.

## [0.1.0] - 2026-06-02

### Added

- Added public README content for Myrspoven and company GitHub organization publishing.
- Added plugin manifest screenshots for overview, tooltip, and long-range examples.

### Changed

- Updated the plugin logo to better represent nonlinear historical time compression.
- Prepared package metadata for the first public company release.

## [0.0.24] - 2026-06-02

### Added

- Added Ctrl-wheel zoom around the cursor using a non-passive wheel listener so the page does not zoom at the same time.
- Added y-axis click toggling between compressed log1p and linear scale.

### Changed

- Removed double-click zoom-out now that wheel zoom is available.
- Reduced reserved bottom chart space below the x-axis labels.

## [0.0.23] - 2026-06-02

### Added

- Added hover tooltips with bucket interval details and formatted values.
- Added drag-to-zoom, Shift-drag pan, and double-click zoom-out interactions.
- Added Ctrl-click external link support with bucket, dashboard, series, and value template variables.
- Added a multiline Explore left JSON editor that builds relative `/explore?left=...` links from a JSON object.

### Changed

- Split legend rendering, SVG plot rendering, and series path generation into smaller modules.

### Fixed

- Preserved bucket interval metadata during adaptive aggregation so hover links can target the visible bucket range.

## [0.0.22] - 2026-05-29

### Fixed

- Replaced React `useId` usage with a React 17-compatible panel instance ID for Grafana 9.x compatibility.

## [0.0.21] - 2026-05-29

### Fixed

- SVG gradient fills now use panel-instance-scoped IDs so edit mode cannot collide with another rendered panel copy.
- The panel color palette option now applies to Grafana palette color modes instead of always falling back to the Grafana palette.

### Changed

- Updated low-risk frontend build and test tooling dependencies.

## [0.0.20] - 2026-05-29

### Fixed

- Gradient and fill style changes now update immediately while editing a panel.
- Gradient hue and scheme modes now keep fixed color override series in the override color family.
- Prometheus label values are now used as legend names before datasource display names.

## [0.0.19] - 2026-05-29

### Fixed

- Gradient hue and scheme modes now derive from fixed color overrides when present.

## [0.0.18] - 2026-05-29

### Fixed

- Missing buckets inside sparse series are rendered as zero only when the gap is larger than the detected sample cadence.
- Negative-Y transformed series now render on value scales that include negative values.
- Standard field unit, decimals, min, and max settings now affect legend formatting and y-axis bounds.
- Removed custom line, fill, and point color settings so colors are controlled through Grafana standard color options and overrides.
- Merged legend visibility and placement into one legend mode setting.
- Removed default visibility switches that could hide every series from the chart or legend at once.
- Reorganized panel and field settings into logical groups.
- Moved line opacity into graph style field settings after line width.
- Moved shared units from repeated legend values to a rotated Y-axis label.
- Resolved Grafana named color presets before rendering series colors.
- Added support for Grafana's shades color scheme mode.
- Distinguished Grafana classic palette ordering from classic palette by series name.

### Changed

- Declared Grafana compatibility now targets Grafana 9.2.0 and newer while production testing remains on Grafana 9.x.

## [0.0.17] - 2026-05-28

### Fixed

- Missing buckets inside sparse series are rendered as zero values instead of interpolating across long gaps.

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

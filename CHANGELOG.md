# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html) for release tags.

## [Unreleased]

### Added

- Grafana field config support for per-series color overrides and thresholds.
- Fill opacity and gradient mode panel options for area styling.
- Optional dashed threshold lines rendered from Grafana field thresholds.
- Y-axis lower bound option for zero-based or visible-minimum scaling.
- Alternating day background bands across the nonlinear timeline.
- Nonlinear grid markers and day bands now follow Grafana's selected time range.

## [0.0.1] - 2026-05-25

### Added

- Initial Horizon panel implementation.
- Continuous nonlinear time projection.
- Automatic screen-space aggregation.
- Configurable Y-axis scale, palette, line styling, and legend placement.
- Clickable legend rows for local series visibility.
- Provisioned local demo dashboard.
- Open-source release documentation and GitHub release workflow.

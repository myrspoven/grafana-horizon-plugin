# Design Notes

This project started as an experiment in nonlinear time for passive Grafana dashboards.

Traditional time series panels use one linear X-axis resolution. That works well for focused troubleshooting, but it forces wallboard-style dashboards to choose between recent detail and historical context. The Horizon Panel instead gives the recent past more horizontal space while still keeping older history visible.

## Original Goals

- Preserve recent operational detail.
- Keep enough historical context to spot baseline shifts.
- Make drift, cliffs, and regime changes visible without interaction.
- Work well on TV/NOC-style dashboards.
- Avoid relying on zooming, brushing, hover, or shared crosshair behavior.

## Current Rendering Model

The current implementation uses a continuous `log1p(age)` time projection rather than the original three-zone sketch. This avoids hard visual breaks while still compressing older history progressively.

The chart adds:

- hourly vertical markers for the current day;
- daily markers for older history;
- a slightly lighter background for the current day;
- screen-space aggregation, where older compressed data naturally lands in wider real-time buckets.

## Data Model

Grafana data frames are normalized into one or more numeric time series. The panel is primarily tested with Prometheus count/throughput data, but it is not Prometheus-specific.

The expected input is:

- a time field;
- one or more numeric value fields.

## Future Ideas

- Change-point annotations for baseline shifts.
- Historical comparison overlays, such as yesterday or last week.
- Better adaptive time labels once the marker model settles.
- More complete Grafana option parity.
- Performance tuning for very dense multi-series dashboards.

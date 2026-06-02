# Horizon

Focus and compressed-context timeline panel for passive operational Grafana dashboards.

The panel renders every numeric time series Grafana passes to it, applies automatic screen-space aggregation that grows in real time as history is compressed, projects the selected Grafana time range onto a continuous `log1p(age)` X-axis, and supports a zero-safe `log1p` Y-axis for count-heavy operational data.

It includes panel-level controls for horizon, aggregation mode, palette, Y-axis lower bound, X-axis labels, legend placement and ordering, day band brightness, and line opacity. Alternating day bands help scan compressed history. Grafana field defaults and overrides can set per-series colors, thresholds, and common TimeSeries graph style settings. Legend rows can be clicked to hide or show individual series locally.

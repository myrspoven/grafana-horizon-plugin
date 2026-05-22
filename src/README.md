# Context Compression

Focus and compressed-context timeline panel for passive operational Grafana dashboards.

The panel renders every numeric time series Grafana passes to it, applies automatic screen-space aggregation that grows in real time as history is compressed, projects time onto a continuous `log1p(age)` X-axis, and supports a zero-safe `log1p` Y-axis for count-heavy operational data. It includes panel-level controls for palette, legend placement, line width, line opacity, and line style.

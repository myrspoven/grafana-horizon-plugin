# Horizon Panel

`myrspoven-horizon-panel` is a Grafana panel plugin for time series where the recent past needs much more screen space than older history.

It renders a continuous nonlinear time axis using a `log1p(age)` projection: recent data stays detailed, older data is progressively compressed, and the chart keeps enough historical context to make shifts and baseline changes visible on passive operational dashboards.

## Features

- Continuous nonlinear X-axis with current time at the right edge.
- Automatic screen-space aggregation, so older compressed history is grouped into larger real-time buckets.
- Multiple numeric time series from Grafana data frames, including Prometheus query results.
- Configurable aggregation mode: max or average.
- Linear or zero-safe `log1p` Y-axis.
- Optional Y-axis lower bound at zero or the smallest visible series value.
- Hourly vertical markers for the current day and daily markers for older history.
- Optional collision-aware X-axis labels with hours for the last range day and day labels for older history.
- Alternating day background bands for easier temporal scanning.
- Grafana field color overrides with palette fallback.
- Legend placement and ordering, line width, line opacity, fill opacity, gradient mode, line style, null connection, point visibility, stacking, and common Grafana TimeSeries field override options.
- Grafana field thresholds rendered as optional dashed threshold lines.
- Clickable legend rows for temporarily showing or hiding series.

## Status

This plugin is early and currently optimized for operational throughput/count dashboards. The rendering model is intentionally experimental, so expect visual behavior and option names to evolve before a stable public release.

## Requirements

- Node.js 22 or newer.
- npm 10 or newer.
- Docker, for the local Grafana development server.
- Grafana 12.3.0 or newer.

## Development

Install dependencies:

```bash
npm install
```

Run the checks used by CI:

```bash
npm run ci
```

Build the plugin:

```bash
npm run build
```

Start a local Grafana instance with the plugin and provisioned demo dashboard:

```bash
npm run server
```

Then open [http://localhost:3000](http://localhost:3000). The default development credentials from the Grafana plugin scaffold are `admin` / `admin`.

For faster frontend iteration, run the webpack watcher in a second terminal:

```bash
npm run dev
```

## Using the Panel

Add the **Horizon** visualization to a Grafana panel and query any data source that returns a time field plus one or more numeric fields. Prometheus range queries work through Grafana's normal data frame pipeline.

Useful options:

- The Grafana dashboard time range controls how far back the panel renders data.
- **Compression focus** controls how much recent time receives the most horizontal space.
- **Aggregation** chooses max or average for automatic buckets.
- **Y-axis scale** switches between linear and `log1p`.
- **Y-axis lower bound** keeps the baseline at zero or at the visible series minimum.
- **Palette** controls fallback colors when Grafana field colors are not set.
- **Legend placement** moves the legend to the right or bottom.
- **Legend order** keeps query order, sorts alphabetically, or sorts by last value and then max value.
- **Show X-axis labels** toggles hourly and daily labels on the nonlinear timeline.
- **Day band brightness** tunes the alternating background stripe intensity.
- **Line opacity** tunes the global line/point opacity.
- Graph styling such as line interpolation, line style, line width, fill opacity, gradient mode, connect null values, show points, stack series, and threshold display is configured through Grafana field defaults or field overrides.

Series-specific colors are configured with Grafana field overrides: add an override for a field, choose **Standard options > Color scheme**, and set a single color. Thresholds use Grafana's standard field threshold editor. Field defaults and overrides also support TimeSeries-style settings such as draw style, line interpolation, line width, fill opacity, gradient mode, line style, connect null values, show points, point size, stacking, soft axis bounds, hide-from-visualization, and negative-Y transform where they fit the nonlinear renderer.

Legend clicks hide or show a series within the panel. This is local display state and does not change the Grafana query.

## Installing from a Release ZIP

Download the release ZIP for the plugin version you want, then extract it into your Grafana plugin directory and restart Grafana.

Example:

```bash
unzip myrspoven-horizon-panel-0.0.1.zip -d /var/lib/grafana/plugins
sudo systemctl restart grafana-server
```

The ZIP contains the plugin directory itself. After restart, Grafana should find `myrspoven-horizon-panel`.

Unsigned plugins are not loaded by default in production Grafana. Until the plugin is signed or published in the Grafana plugin catalog, local/private Grafana instances must explicitly allow it:

```bash
GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=myrspoven-horizon-panel
```

## Releases

Release builds are handled by GitHub Actions.

1. Update `package.json` and `CHANGELOG.md`.
2. Create a version tag:

   ```bash
   npm version patch
   ```

3. Push the tag:

   ```bash
   git push origin main --follow-tags
   ```

Pushing a `vX.Y.Z` tag runs `.github/workflows/release.yml`, which builds the plugin ZIP using Grafana's official plugin build action. To sign release builds, add a repository secret named `GRAFANA_ACCESS_POLICY_TOKEN`.

## Repository Notes

The local Prometheus export files used while developing the demo dashboard are ignored by Git. Do not commit private production data exports.

The original concept memo is preserved in [docs/design-notes.md](docs/design-notes.md).

## License

Apache-2.0. See [LICENSE](LICENSE).

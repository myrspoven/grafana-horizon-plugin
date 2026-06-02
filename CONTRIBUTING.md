# Contributing

Thanks for taking a look at Horizon Panel.

## Development Setup

```bash
npm install
npm run build
npm run server
```

Open [http://localhost:3000](http://localhost:3000) and use the provisioned demo dashboard to exercise the panel.

## Checks

Run the same core checks as CI before opening a pull request:

```bash
npm run ci
```

Focused commands are also available:

```bash
npm run typecheck
npm run lint
npm run test:ci
npm run build
```

## Pull Requests

- Keep changes focused.
- Add or update tests when changing projection, aggregation, or rendering behavior.
- Do not commit private Grafana, Prometheus, or production data exports.
- Do not edit files under `.config`; those are managed by Grafana plugin tooling.

## Release Notes

User-visible changes should be added to `CHANGELOG.md` under the unreleased section.

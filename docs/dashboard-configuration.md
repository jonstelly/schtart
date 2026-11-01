# Dashboard configuration

Each user's layout is one complete YAML document. It replaces the whole active layout; pages are never merged with another document. Users without a saved override follow the current database-backed server default. Resetting an override makes the user follow that current default again.

The authenticated configuration API is:

- `GET /api/configuration` returns `{ yaml, source, configuration }`, where `source` is `default` or `user` and `configuration` is the parsed layout.
- `PUT /api/configuration` accepts `{ "yaml": "..." }` and replaces the caller's complete layout only after YAML and schema validation succeeds.
- `DELETE /api/configuration` removes the caller's override and returns the current default.

The bundled default is seeded into PostgreSQL only when no server default exists. A seed or user override is durable across process restarts. The database associates every override with its authenticated user; clients cannot select another user's record.

## Version 1 format

All four pages are required, and unknown keys are rejected at every level. Each page has one to three ordered columns; each column contains one to eight ordered widgets, and a page has at most twelve widgets total.

```yaml
version: 1
pages:
  home:
    columns:
      - - widget: welcome
        - widget: news-headlines
          count: 3
      - - widget: sports-scores
          league: NHL
        - widget: system-status
  news:
    columns:
      - - widget: news-headlines
          count: 5
  sports:
    columns:
      - - widget: sports-scores
          league: NBA
  monitoring:
    columns:
      - - widget: system-status
```

## Registered widgets

| Widget | Allowed parameters | Default behavior |
| --- | --- | --- |
| `welcome` | none | A short personal welcome. |
| `news-headlines` | `count`: integer from 1 to 5 | Shows up to three illustrative headlines. |
| `sports-scores` | `league`: `NHL`, `NBA`, or `MLB` | Shows example scores; no live sports data. |
| `system-status` | none | Shows illustrative application, database, and scheduler statuses. |

These widgets deliberately render local example content only. Configuration cannot declare new widget code, templates, URLs, feeds, fetches, or executable YAML tags. Unknown widget names, parameters, pages, and invalid layouts are rejected with validation errors. A failed save leaves the existing override untouched.

## Adding a widget

Future widget authors should add a widget to the server-side configuration schema, add its typed configuration to `src/lib/dashboard.ts`, provide a reusable renderer and clearly marked sample content, then update the bundled default only when the default layout should use it. Update this contract and add validator coverage for any parameters. Widget implementations must not turn user configuration into arbitrary execution or network access.

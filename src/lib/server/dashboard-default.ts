/** Bundled starter layout, inserted only when the database has no server default yet. */
export const DEFAULT_DASHBOARD_YAML = `version: 1
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
          league: NHL
  monitoring:
    columns:
      - - widget: system-status
`;

import { describe, expect, it } from 'vitest';
import { DEFAULT_DASHBOARD_YAML } from './dashboard-default';
import { validateDashboardConfiguration } from './dashboard-configuration';

const validConfiguration = `version: 1
pages:
  home:
    columns:
      - - widget: welcome
        - widget: news-headlines
          count: 2
  news:
    columns:
      - - widget: news-headlines
          count: 4
  sports:
    columns:
      - - widget: sports-scores
          league: NHL
  monitoring:
    columns:
      - - widget: system-status
`;

describe('dashboard configuration validation', () => {
	it('parses a complete configuration using registered widgets and their parameters', () => {
		const result = validateDashboardConfiguration(validConfiguration);

		expect(result.success).toBe(true);
		if (!result.success) throw new Error('Expected the example configuration to be valid.');
		expect(result.configuration.pages.home.columns[0]).toEqual([
			{ widget: 'welcome' },
			{ widget: 'news-headlines', count: 2 }
		]);
	});

	it('keeps the bundled Home page curated from the same registered widgets as themed pages', () => {
		const result = validateDashboardConfiguration(DEFAULT_DASHBOARD_YAML);
		expect(result.success).toBe(true);
		if (!result.success) throw new Error('The bundled dashboard default must remain valid.');

		const homeWidgets = result.configuration.pages.home.columns.flat().map(({ widget }) => widget);
		expect(homeWidgets).toContain('news-headlines');
		expect(homeWidgets).toContain('sports-scores');
		expect(homeWidgets).toContain('system-status');
		expect(result.configuration.pages.news.columns.flat().map(({ widget }) => widget)).toContain('news-headlines');
		expect(result.configuration.pages.sports.columns.flat().map(({ widget }) => widget)).toContain('sports-scores');
		expect(result.configuration.pages.monitoring.columns.flat().map(({ widget }) => widget)).toContain('system-status');
	});

	it('returns a readable syntax error for malformed YAML', () => {
		const result = validateDashboardConfiguration('version: [1\n');

		expect(result.success).toBe(false);
		if (result.success) throw new Error('Expected malformed YAML to be rejected.');
		expect(result.errors.join(' ')).toMatch(/line|YAML/i);
	});

	it('rejects unknown widgets, arbitrary parameters, and invalid layouts', () => {
		const result = validateDashboardConfiguration(`version: 1
pages:
  home:
    columns:
      - - widget: custom
  news: { columns: [] }
  sports: { columns: [[{ widget: sports-scores, league: curling, url: https://example.test/feed }]] }
  monitoring: { columns: [[{ widget: system-status, interval: 5 }]] }
`);

		expect(result.success).toBe(false);
		if (result.success) throw new Error('Expected invalid configuration to be rejected.');
		expect(result.errors.join('\n')).toMatch(/widget|url|columns|league|interval/i);
	});

	it('rejects duplicate mapping keys instead of silently accepting the last value', () => {
		const result = validateDashboardConfiguration(`${validConfiguration}\npages: {}`);

		expect(result.success).toBe(false);
		if (result.success) throw new Error('Expected duplicate YAML keys to be rejected.');
		expect(result.errors.join(' ')).toMatch(/duplicate|key/i);
	});

	it('does not resolve YAML aliases into configuration values', () => {
		const result = validateDashboardConfiguration(`version: 1
pages:
  home:
    columns: &shared [[{ widget: welcome }]]
  news:
    columns: *shared
  sports: { columns: [[{ widget: sports-scores }]] }
  monitoring: { columns: [[{ widget: system-status }]] }
`);

		expect(result.success).toBe(false);
		if (result.success) throw new Error('Expected aliased YAML to be rejected.');
		expect(result.errors.join(' ')).toMatch(/alias/i);
	});
});

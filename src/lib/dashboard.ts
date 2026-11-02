export const DASHBOARD_PAGES = ['home', 'news', 'sports', 'monitoring'] as const;
export type DashboardPageName = (typeof DASHBOARD_PAGES)[number];

export const DASHBOARD_PAGE_LABELS: Record<DashboardPageName, string> = {
	home: 'Home',
	news: 'News',
	sports: 'Sports',
	monitoring: 'Monitoring'
};

export type DashboardWidgetConfiguration =
	| { widget: 'welcome' }
	| { widget: 'news-headlines'; count?: number }
	| { widget: 'sports-scores'; league?: 'NHL' | 'NBA' | 'MLB' }
	| { widget: 'system-status' };

export interface DashboardPageConfiguration {
	columns: DashboardWidgetConfiguration[][];
}

export interface DashboardConfiguration {
	version: 1;
	pages: Record<DashboardPageName, DashboardPageConfiguration>;
}

export interface EffectiveDashboardConfiguration {
	yaml: string;
	source: 'default' | 'user';
	configuration: DashboardConfiguration;
}

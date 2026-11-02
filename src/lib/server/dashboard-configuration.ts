import { parseDocument } from 'yaml';
import { z } from 'zod';
import type { DashboardConfiguration as DashboardContract } from '../dashboard';

const pageNames = ['home', 'news', 'sports', 'monitoring'] as const;

const widgetSchema = z.discriminatedUnion('widget', [
	z.object({ widget: z.literal('welcome') }).strict(),
	z
		.object({
			widget: z.literal('news-headlines'),
			count: z.number().int().min(1).max(5).optional()
		})
		.strict(),
	z
		.object({ widget: z.literal('sports-scores'), league: z.enum(['NHL', 'NBA', 'MLB']).optional() })
		.strict(),
	z.object({ widget: z.literal('system-status') }).strict()
]);

const columnSchema = z.array(widgetSchema).min(1, 'A column must contain at least one widget.').max(8);
const pageSchema = z.object({ columns: z.array(columnSchema).min(1).max(3) }).strict();
const dashboardConfigurationSchema = z.object({
	version: z.literal(1),
	pages: z
		.object({
			home: pageSchema,
			news: pageSchema,
			sports: pageSchema,
			monitoring: pageSchema
		})
		.strict()
	})
	.strict()
	.superRefine(({ pages }, context) => {
		for (const name of pageNames) {
			const widgetCount = pages[name].columns.reduce((total, column) => total + column.length, 0);
			if (widgetCount > 12) {
				context.addIssue({
					code: 'custom',
					path: ['pages', name, 'columns'],
					message: 'A page can contain at most 12 widgets.'
				});
			}
		}
	});

export type DashboardConfiguration = z.infer<typeof dashboardConfigurationSchema>;

const MAX_CONFIGURATION_LENGTH = 32_000;

/** Parse and validate a complete YAML dashboard configuration without executing YAML tags. */
export function validateDashboardConfiguration(source: string):
	| { success: true; configuration: DashboardConfiguration }
	| { success: false; errors: string[] } {
	if (source.length > MAX_CONFIGURATION_LENGTH) {
		return {
			success: false,
			errors: [`Configuration must be no larger than ${MAX_CONFIGURATION_LENGTH} characters.`]
		};
	}

	let document;
	try {
		document = parseDocument(source, { uniqueKeys: true, schema: 'core' });
	} catch (error) {
		return { success: false, errors: [`YAML could not be parsed: ${errorMessage(error)}`] };
	}

	if (document.errors.length > 0) {
		return {
			success: false,
			errors: document.errors.map((error) => `YAML could not be parsed: ${error.message}`)
		};
	}

	let value: unknown;
	try {
		value = document.toJS({ maxAliasCount: 0 });
	} catch (error) {
		return { success: false, errors: [`YAML could not be parsed: ${errorMessage(error)}`] };
	}

	const result = dashboardConfigurationSchema.safeParse(value);
	if (!result.success) {
		return {
			success: false,
			errors: result.error.issues.map(
				({ path, message }) => `${path.join('.') || 'configuration'}: ${message}`
			)
		};
	}

	return { success: true, configuration: result.data satisfies DashboardContract };
}

function errorMessage(error: unknown) {
	return error instanceof Error ? error.message : 'invalid document';
}

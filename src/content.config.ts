import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const STATUSES = ['Planned', 'In progress', 'Installed', 'Bench-tested', 'Verified', 'Retired'] as const;
export const CATEGORIES = [
	'Software and Automation',
	'Vehicle Upfit and 12V',
	'Radio and Emergency Comms',
	'Business Systems',
	'Fabrication and 3D Printing',
] as const;

// YAML turns bare dates into Date objects; keep them as YYYY-MM-DD strings (or "TBD").
const day = z
	.union([z.string(), z.date()])
	.transform((d) => (typeof d === 'string' ? d : d.toISOString().slice(0, 10)));

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema({
			extend: z.object({
				status: z.enum(STATUSES).optional(),
				category: z.enum(CATEGORIES).optional(),
				started: day.optional(),
				updated: day.optional(),
				summary: z.string().optional(),
				// true on the top-level page of a project, so it appears in the /projects/ grid.
				project: z.boolean().optional(),
			}),
		}),
	}),
};

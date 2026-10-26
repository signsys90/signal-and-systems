// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// Update `site` when the custom domain is live. Until then the free pages.dev address is used.
export default defineConfig({
	site: 'https://signal-and-systems.pages.dev',
	integrations: [
		starlight({
			title: 'Signal & Systems',
			description: 'Systems built in the field and in the business. Build logs and project documentation by William A. Atkins, KR4JSQ.',
			logo: { src: './src/assets/mark.svg', alt: 'Signal & Systems' },
			favicon: '/favicon.svg',
			customCss: [
				'@fontsource/inter/400.css',
				'@fontsource/inter/600.css',
				'@fontsource/space-grotesk/600.css',
				'@fontsource/jetbrains-mono/400.css',
				'./src/styles/custom.css',
			],
			social: [
				{ icon: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/in/william-atkins-8a8786226' },
			],
			lastUpdated: true,
			head: [
				// Cloudflare Web Analytics: enable it in the Cloudflare Pages dashboard (one click, no script needed),
				// or paste the beacon snippet here with your token.
			],
			sidebar: [
				{ label: 'Home', link: '/' },
				{
					label: 'Projects',
					items: [
						{ label: 'All projects', link: '/projects/' },
						{
							label: 'Software and Automation',
							items: [
								{ label: 'Responder ID Scanner', link: '/projects/responder-id-scanner/' },
								{ label: 'AI Outbound Sales Platform', link: '/projects/ai-outbound-platform/' },
								{ label: 'Signal & Systems Website', link: '/projects/signal-and-systems-site/' },
							],
						},
						{
							label: 'Vehicle Upfit and 12V',
							items: [{ label: 'F-150 Upfit', items: [{ autogenerate: { directory: 'projects/f150-upfit' } }] }],
						},
						{
							label: 'Radio and Emergency Comms',
							items: [{ label: 'Mobile Ham Radio Install', link: '/projects/mobile-ham-radio/' }],
						},
						{
							label: 'Business Systems',
							items: [
								{ label: 'SaniGLAZE Opportunity Map', link: '/projects/saniglaze-opportunity-map/' },
								{ label: 'SaniGLAZE Trade Show Map', link: '/projects/saniglaze-trade-show-map/' },
								{ label: 'AI-Assisted Executive Search', link: '/projects/ai-assisted-executive-search/' },
							],
						},
						{ label: 'Fabrication and 3D Printing', items: [], collapsed: true },
					],
				},
				{ label: 'Build Log', items: [{ autogenerate: { directory: 'log' } }] },
				{ label: 'Reference', items: [{ autogenerate: { directory: 'reference' } }] },
				{ label: 'About', link: '/about/' },
				{ label: 'Contact', link: '/contact/' },
				{ label: 'Privacy', link: '/privacy/' },
			],
		}),
	],
});

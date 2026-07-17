// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import starlight from '@astrojs/starlight';
import lucode from 'lucode-starlight';

const journeyPathPackageRoot =
	'/Users/zavalit/Projects/openuji/specs/solid-oidc/journey-graph/packages/journey-path';
const workspaceRoot =
	'/Users/zavalit/Projects/openuji/funding/applications/fediversity/UJG-FedA11y';

// https://astro.build/config
export default defineConfig({
	vite: {
		resolve: {
			dedupe: ['react', 'react-dom'],
		},
		ssr: {
			noExternal: ['@openuji/journey-path'],
		},
		server: {
			fs: {
				allow: [workspaceRoot, journeyPathPackageRoot],
			},
		},
	},
	integrations: [
		react(),
		starlight({
			title: 'UJG-FedA11y',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/openuji/UJG-FedA11y' }],
			plugins: [
				lucode({
				navLinks: [
					{ label: 'Docs', link: '/docs' },
			
				],
				}),
			],
		}),
	],
});

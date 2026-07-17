// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import lucode from 'lucode-starlight';


// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'UJG-FedA11y',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/withastro/starlight' }],
			components: {
				Hero: './src/components/Hero.astro',
			},
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

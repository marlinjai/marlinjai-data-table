import { defineConfig } from '@marlinjai/clearify';

export default defineConfig({
  name: 'Data Table',
  docsDir: './docs',
  // Clearify 2 requires a production siteUrl to emit llms.txt. This repo's docs are
  // published through the ERP-suite hub, so no standalone URL is claimed here.
  generateLlmsTxt: false,
  hubProject: {
    hubUrl: 'https://docs.lumitra.co',
    hubName: 'ERP Suite',
    description: 'Notion-like database React components & adapters',
    status: 'active',
    icon: '📊',
    tags: ['react', 'components'],
    group: 'Libraries',
  },
});

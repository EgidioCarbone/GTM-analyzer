import { SSDModule } from '../types';
import manifest from './fibra.manifest.json';

export const fibraModule: SSDModule = {
  meta: {
    id: 'fibra',
    title: 'Fibra',
    description: 'Test verticali per funnel Fibra con focus su CMP, menu e lead form.',
    tags: ['CMP', 'Lead', 'Navigation'],
    accentColor: '#2563eb',
    icon: 'Antenna',
  },
  supportedHosts: [
    'fibra.aruba.it',
    'fibra-preprod.example.com',
  ],
  defaultUrls: [
    'https://fibra.aruba.it/',
  ],
  configFields: [],
  defaultConfig: {},
  manifest,
};

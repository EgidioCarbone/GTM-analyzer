import { SSDModule } from '../types';
import manifest from './actalis.manifest.json';

export const actalisModule: SSDModule = {
  meta: {
    id: 'actalis',
    title: 'Actalis',
    description: 'Pipeline verticale per flussi Actalis focalizzata su journey SSL.',
    tags: ['SSL', 'Navigation'],
    accentColor: '#0ea5e9',
    icon: 'ShieldCheck',
  },
  supportedHosts: [
    'www.actalis.com',
  ],
  defaultUrls: [
    'https://www.actalis.com/',
    'https://www.actalis.com/it/abbonamento',
  ],
  configFields: [],
  defaultConfig: {},
  manifest,
};

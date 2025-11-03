import { SSDModule } from '../types';

export const genertelModule: SSDModule = {
  meta: {
    id: 'genertel',
    title: 'Genertel',
    description: 'Scenario verticalizzato per journey preventivo Genertel e validazioni tracking.',
    tags: ['Quote', 'Tracking', 'Form'],
    accentColor: '#f97316',
    icon: 'Shield',
  },
  supportedHosts: [
    'www.genertel.it',
    'preventivi.genertel.it',
  ],
  defaultUrls: [
    'https://www.genertel.it/',
    'https://preventivi.genertel.it/',
  ],
  configFields: [
    {
      id: 'productLine',
      label: 'Linea prodotto',
      type: 'select',
      required: true,
      options: [
        { value: 'auto', label: 'Auto' },
        { value: 'casa', label: 'Casa' },
        { value: 'moto', label: 'Moto' },
      ],
      defaultValue: 'auto',
    },
    {
      id: 'useDemoAccount',
      label: 'Usa account demo',
      type: 'checkbox',
      defaultValue: true,
      helperText: 'Se deselezionato il runner richiederà credenziali manuali prima di proseguire.',
    },
    {
      id: 'trackingDataset',
      label: 'Dataset tracking atteso',
      type: 'textarea',
      helperText: 'JSON con eventi attesi per la linea selezionata. Lascia vuoto per usare il default del modulo.',
    },
  ],
  defaultConfig: {
    productLine: 'auto',
    useDemoAccount: true,
  },
};

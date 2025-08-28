// Test per verificare i miglioramenti UX della Variable Quality Card
import { analyzeVariableQuality } from './services/variableQualityService';

// Test data che dovrebbe mostrare tutti i miglioramenti UX
const testContainerWithIssues = {
  variable: [
    {
      variableId: 'var_1',
      name: 'DLV - items',
      type: 'v',
      parameter: [
        { key: 'dataLayerVariable', value: 'items' },
        { key: 'dataLayerVersion', value: 2 }
        // Missing defaultValue - should trigger warning
      ]
    },
    {
      variableId: 'var_2',
      name: 'DLV - ecommerce',
      type: 'v',
      parameter: [
        { key: 'dataLayerVariable', value: 'ecommerce' },
        { key: 'dataLayerVersion', value: 2 }
        // Missing defaultValue - should trigger warning
      ]
    },
    {
      variableId: 'var_3',
      name: 'Lookup - Country',
      type: 'lookup',
      parameter: [
        { key: 'inputVariable', value: '{{Country}}' }
        // Missing defaultTable - should trigger critical issue
      ]
    },
    {
      variableId: 'var_4',
      name: 'Lookup - Region',
      type: 'lookup',
      parameter: [
        { key: 'inputVariable', value: '{{Region}}' }
        // Missing defaultTable - should trigger critical issue
      ]
    },
    {
      variableId: 'var_5',
      name: 'CSS - Button',
      type: 'css',
      parameter: [
        { key: 'selector', value: '.css-1ab23cd .btn' }
      ]
    },
    {
      variableId: 'var_6',
      name: 'CSS - Modal',
      type: 'css',
      parameter: [
        { key: 'selector', value: '.Mui-xyz789 .modal' }
      ]
    },
    {
      variableId: 'var_7',
      name: 'JS - Dynamic',
      type: 'js',
      parameter: [
        { key: 'javascript', value: 'eval("some code")' }
      ]
    },
    {
      variableId: 'var_8',
      name: 'JS - Unsafe',
      type: 'js',
      parameter: [
        { key: 'javascript', value: 'document.write("test")' }
      ]
    },
    {
      variableId: 'var_9',
      name: 'Regex - Bad',
      type: 'regex',
      parameter: [
        { key: 'pattern', value: '[invalid regex' }
      ]
    },
    {
      variableId: 'var_10',
      name: 'Unused Var 1',
      type: 'v',
      parameter: []
    },
    {
      variableId: 'var_11',
      name: 'Unused Var 2',
      type: 'v',
      parameter: []
    },
    {
      variableId: 'var_12',
      name: 'Unused Var 3',
      type: 'v',
      parameter: []
    },
    {
      variableId: 'var_13',
      name: 'Duplicate Name',
      type: 'v',
      parameter: []
    },
    {
      variableId: 'var_14',
      name: 'duplicate name', // Case-insensitive duplicate
      type: 'v',
      parameter: []
    }
  ],
  tag: [
    {
      tagId: 'tag_1',
      name: 'GA4 Config',
      type: 'gaawc',
      parameter: [
        { key: 'measurementId', value: 'G-XXXXXXXXXX' }
      ]
    }
  ]
};

console.log('🧪 Testing improved Variable Quality Card UX...');

const result = analyzeVariableQuality(testContainerWithIssues);

console.log('📊 Expected improvements:');
console.log('✅ Category badges should show:');
console.log('  - ⚠️ DLV senza fallback (2)');
console.log('  - ❌ Lookup senza default (2)');
console.log('  - 🎯 Selettori fragili (2)');
console.log('  - ⚡ JS non sicuro (2)');
console.log('  - 🚫 Regex malformate (1)');
console.log('  - 🔄 Duplicati (1)');

console.log('✅ Sub-scores should show:');
console.log('  - DLV: ~50% (due to missing fallbacks)');
console.log('  - Lookup: 0% (due to missing defaults)');
console.log('  - Igiene: ~20% (due to unused and duplicates)');

console.log('✅ Examples should show:');
console.log('  - DLV - items → DLV senza fallback');
console.log('  - Lookup - Country → Lookup senza default');
console.log('  - JS - Dynamic → JS con eval o document.write');

console.log('✅ CTA should be: "❌ Esamina Lookup senza default" (most critical)');

console.log('\n📈 Actual results:');
console.log('Stats:', result.variable_quality.stats);
console.log('Breakdown:', result.variable_quality.breakdown);
console.log('Issues count:', result.variable_quality.issues.length);
console.log('Top issues:', result.variable_quality.issues.slice(0, 3).map(i => `${i.name} → ${i.reason}`));

export { testContainerWithIssues, result };

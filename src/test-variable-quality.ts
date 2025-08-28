// Test for Variable Quality Service - can be run in browser console
import { analyzeVariableQuality, runVariableQualityTests } from './services/variableQualityService';

// Test data that should trigger various issues
const testContainer = {
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
      name: 'Lookup - Country',
      type: 'lookup',
      parameter: [
        { key: 'inputVariable', value: '{{Country}}' }
        // Missing defaultTable - should trigger critical issue
      ]
    },
    {
      variableId: 'var_3',
      name: 'CSS - Button',
      type: 'css',
      parameter: [
        { key: 'selector', value: '.css-1ab23cd .btn' }
      ]
    },
    {
      variableId: 'var_4',
      name: 'JS - Dynamic',
      type: 'js',
      parameter: [
        { key: 'javascript', value: 'eval("some code")' }
      ]
    },
    {
      variableId: 'var_5',
      name: 'Unused Var 1',
      type: 'v',
      parameter: []
    },
    {
      variableId: 'var_6',
      name: 'Unused Var 2',
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

// Run the tests
console.log('🧪 Running Variable Quality Tests...');
const testResult = runVariableQualityTests();
console.log('Built-in tests result:', testResult);

// Test with sample data
console.log('🧪 Testing with sample data...');
const result = analyzeVariableQuality(testContainer);
console.log('Sample analysis result:', result);

// Expected results:
// - 1 DLV without fallback (major issue)
// - 1 Lookup without default (critical issue)  
// - 1 CSS fragile selector (minor issue)
// - 1 JS unsafe code (critical issue)
// - 2 unused variables (hygiene issue)
// - Total score should be low due to critical issues

export { testContainer, result };

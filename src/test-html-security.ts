// Test per verificare l'implementazione HTML Security
import { analyzeHtmlSecurity, runHtmlSecurityTests } from './services/htmlSecurityService';

// Test data che dovrebbe mostrare tutti i tipi di problemi
const testContainerWithHtmlIssues = {
  tag: [
    {
      tagId: 'tag_1',
      name: 'HTML – Widget Partner',
      type: 'html',
      html: 'eval("some code"); fetch("http://cdn.example.com/lib.js");'
    },
    {
      tagId: 'tag_2',
      name: 'HTML – AB Test',
      type: 'html',
      html: 'setInterval(function() { console.log("test"); }, 200);'
    },
    {
      tagId: 'tag_3',
      name: 'HTML – PostMessage',
      type: 'html',
      html: 'window.postMessage(data, "*");'
    },
    {
      tagId: 'tag_4',
      name: 'HTML – Custom Widget',
      type: 'html',
      html: 'console.log("custom widget");',
      firingTriggerId: ['trg_1']
    },
    {
      tagId: 'tag_5',
      name: 'HTML – XSS Risk',
      type: 'html',
      html: 'document.getElementById("content").innerHTML += userInput;'
    },
    {
      tagId: 'tag_6',
      name: 'HTML – PII Risk',
      type: 'html',
      html: 'fetch("https://api.example.com?email=" + userEmail);'
    },
    {
      tagId: 'tag_7',
      name: 'HTML – No Try Catch',
      type: 'html',
      html: `function complexOperation() {
        var data = getData();
        var processed = processData(data);
        var result = calculateResult(processed);
        return result;
      }`
    },
    {
      tagId: 'tag_8',
      name: 'GA4 Config',
      type: 'gaawc',
      parameter: [
        { key: 'measurementId', value: 'G-XXXXXXXXXX' }
      ]
    }
  ],
  trigger: [
    {
      triggerId: 'trg_1',
      name: 'All Pages',
      type: 'PAGEVIEW'
    }
  ]
};

console.log('🧪 Testing HTML Security implementation...');

// Run the built-in tests
const testResult = runHtmlSecurityTests();
console.log('Built-in tests result:', testResult);

// Test with sample data
console.log('🧪 Testing with sample data...');
const result = analyzeHtmlSecurity(testContainerWithHtmlIssues);

console.log('📊 Expected results:');
console.log('✅ Should detect:');
console.log('  - 1 critical: eval + HTTP request');
console.log('  - 1 major: tight interval');
console.log('  - 1 minor: postMessage star');
console.log('  - 1 minor: timing PAGEVIEW');
console.log('  - 1 critical: innerHTML injection');
console.log('  - 1 critical: PII in URL');
console.log('  - 1 minor: no try/catch');

console.log('✅ Third parties should include:');
console.log('  - cdn.example.com');
console.log('  - api.example.com');

console.log('✅ Score should be low due to critical issues');

console.log('\n📈 Actual results:');
console.log('Stats:', result.html_security);
console.log('Third parties:', result.html_security.third_parties);
console.log('Details count:', result.html_security.details.length);
console.log('Top issues:', result.html_security.details.slice(0, 3).map(d => `${d.name} (${d.severity})`));

export { testContainerWithHtmlIssues, result };

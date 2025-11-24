const fs = require('fs');
const p = 'c:/Users/f.vidorni/Desktop/Progetto AI/src/pages/PlanPage.tsx';
const bak = p + '.bak';
try {
  fs.copyFileSync(p, bak);
  let s = fs.readFileSync(p, 'utf8');
  // Fix duplicate className opening quotes
  s = s.replace(/className=\"\"/g, 'className=\"');
  // Fix closing double quotes followed by >
  s = s.replace(/\"\">/g, '\">');
  // Remove stray occurrences of double double-quotes before a word (e.g. ""Pronto)
  s = s.replace(/\"\"(?=[A-Za-zÀ-ÖØ-öø-ÿ])/g, '\"');
  fs.writeFileSync(p, s, 'utf8');
  console.log('patched file and saved backup to', bak);
} catch (e) {
  console.error('patch failed', e);
  process.exit(1);
}

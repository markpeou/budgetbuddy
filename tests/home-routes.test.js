// Every journey, question and calculator on the site pages must point at a
// real route: a deep link into the calculator (#go/…) or a placeholder (#soon/…).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const src = fs.readFileSync(path.join(__dirname, '..', 'home.js'), 'utf8');
const noop = () => {};
const fakeEl = () => ({ addEventListener: noop, appendChild: (c) => c, setAttribute: noop, querySelector: () => null, dataset: {}, classList: { toggle: noop, remove: noop, contains: () => false } });
const sandbox = {
  window: { matchMedia: () => ({ matches: false }), addEventListener: noop, scrollTo: noop },
  document: { getElementById: () => null, querySelectorAll: () => [], querySelector: () => null, addEventListener: noop, createElement: fakeEl, body: { dataset: {}, classList: { toggle: noop, remove: noop, contains: () => false } }, activeElement: null },
  location: { hash: '#home' },
  requestAnimationFrame: noop,
  CustomEvent: function () {},
  Event: function () {},
};
vm.runInNewContext(src, sandbox);
const { TOOLS, GO, JOURNEYS, QUESTIONS, SOON } = sandbox.window.BudgetHome;
const TABS = ['income', 'expenses', 'spending', 'summary'];

const check = (item, where) => {
  if (item.soon) assert.ok(SOON[item.soon], `${where}: unknown placeholder ${item.soon}`);
  else assert.ok(GO[item.go], `${where}: unknown route ${item.go}`);
};
JOURNEYS.forEach((g) => g.items.forEach((i) => {
  check(i, i.q);
  if (!i.soon) assert.ok(TOOLS[i.tool] && !TOOLS[i.tool].soon, `${i.q}: tool ${i.tool}`);
}));
QUESTIONS.forEach((q) => check(q, q.q));
Object.entries(TOOLS).forEach(([id, t]) => (t.soon ? assert.ok(SOON[id], id) : assert.ok(GO[t.go], id)));
Object.entries(GO).forEach(([id, g]) => {
  assert.ok(TABS.includes(g.tab), `${id}: tab ${g.tab}`);
  assert.ok(g.q && g.guide, `${id}: needs a title and guidance`);
});
Object.values(SOON).forEach((s) => assert.ok(GO[s.link.go], `placeholder link ${s.link.go}`));
assert.strictEqual(JOURNEYS.length, 3);
assert.strictEqual(QUESTIONS.length, 6);
console.log(`✓ home routes: ${JOURNEYS.reduce((n, g) => n + g.items.length, 0)} journeys, ${QUESTIONS.length} questions, ${Object.keys(TOOLS).length} calculators all resolve`);

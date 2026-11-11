// Every journey, question and calculator card must open something real:
// the budget planner (#go/<id>) or a journey calculator (#tool/<id>[/<preset>])
// whose preset exists — no dead links, no placeholders.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const noop = () => {};
const fakeEl = () => ({ addEventListener: noop, appendChild: (c) => c, setAttribute: noop, querySelector: () => null, dataset: {}, classList: { toggle: noop, remove: noop, contains: () => false } });
const win = { matchMedia: () => ({ matches: false }), addEventListener: noop, scrollTo: noop };
const sandbox = {
  window: win,
  document: { getElementById: () => null, querySelectorAll: () => [], querySelector: () => null, addEventListener: noop, createElement: fakeEl, body: { dataset: {}, classList: { toggle: noop, remove: noop, contains: () => false } }, activeElement: null },
  location: { hash: '#home' },
  localStorage: { getItem: () => null, setItem: noop },
  sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
  requestAnimationFrame: noop,
  CustomEvent: function () {},
  Event: function () {},
};
sandbox.self = win;
vm.createContext(sandbox);
vm.runInContext(read('journey-core.js'), sandbox);
win.JourneyCore = sandbox.self.JourneyCore || win.JourneyCore;
vm.runInContext(read('journeys.js'), sandbox);
vm.runInContext(read('home.js'), sandbox);

const { TOOLS } = win.BudgetTools;
const { CALCULATORS, GO, JOURNEYS, QUESTIONS } = win.BudgetHome;

function resolves(to, where) {
  const [kind, id, preset] = to.split('/');
  if (kind === 'go') return assert.ok(GO[id], `${where}: unknown planner link ${to}`);
  assert.strictEqual(kind, 'tool', `${where}: unexpected link ${to}`);
  assert.ok(TOOLS[id], `${where}: unknown calculator ${id}`);
  if (preset) assert.ok(TOOLS[id].presets[preset], `${where}: unknown preset ${to}`);
}

let n = 0;
JOURNEYS.forEach((g) => g.items.forEach((i) => { resolves(i.to, i.q); n++; }));
QUESTIONS.forEach((q) => resolves(q.to, q.q));
CALCULATORS.forEach((c) => resolves(c.to, c.name));

// Every calculator is reachable from the Calculators page.
Object.keys(TOOLS).forEach((id) => assert.ok(CALCULATORS.some((c) => c.to === `tool/${id}`), `${id} missing from Calculators`));
// Every preset title is a real question.
Object.values(TOOLS).forEach((t) => Object.values(t.presets).forEach((p) => assert.ok(p.q && p.q.endsWith('?'), `${t.name}: preset needs a question`)));

assert.strictEqual(JOURNEYS.length, 4);
assert.strictEqual(n, 17);
assert.strictEqual(QUESTIONS.length, 6);
console.log(`✓ home routes: ${n} journeys, ${QUESTIONS.length} questions, ${CALCULATORS.length} calculators all open a real calculator`);

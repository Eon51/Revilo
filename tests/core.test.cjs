const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

function loadTypeScript(relativePath) {
  const filename = path.join(process.cwd(), relativePath);
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(output, filename);
  return loaded.exports;
}

const { generatePlan } = loadTypeScript('lib/planner.ts');
const { scheduleCard } = loadTypeScript('lib/review.ts');

function dateOffset(days) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

test('planner respects blocked dates and daily availability', () => {
  const blockedDate = dateOffset(1);
  const plan = generatePlan(
    [{ id: 'exam', date: dateOffset(3), chapters: [{ id: 'chapter', difficulty: 2 }] }],
    { 0: 60, 1: 60, 2: 60, 3: 60, 4: 60, 5: 60, 6: 60 },
    [blockedDate],
  );
  const dailyTotals = new Map();
  for (const session of plan) {
    assert.notEqual(session.date, blockedDate);
    dailyTotals.set(session.date, (dailyTotals.get(session.date) ?? 0) + session.duration);
  }
  for (const minutes of dailyTotals.values()) assert.ok(minutes <= 60);
});

test('planner skips exams in the past', () => {
  const plan = generatePlan(
    [{ id: 'exam', date: dateOffset(-1), chapters: [{ id: 'chapter', difficulty: 2 }] }],
    { 0: 120, 1: 120, 2: 120, 3: 120, 4: 120, 5: 120, 6: 120 },
  );
  assert.deepEqual(plan, []);
});

test('SM-2 advances review intervals and resets failed cards', () => {
  const reviewedAt = new Date('2026-01-01T00:00:00.000Z');
  const initial = { easeFactor: 2.5, interval: 0, repetitions: 0, nextReviewAt: '2026-01-01' };
  const first = scheduleCard(initial, 5, reviewedAt);
  assert.equal(first.interval, 1);
  assert.equal(first.repetitions, 1);

  const second = scheduleCard(first, 5, reviewedAt);
  assert.equal(second.interval, 6);
  assert.equal(second.repetitions, 2);

  const failed = scheduleCard(second, 0, reviewedAt);
  assert.equal(failed.interval, 1);
  assert.equal(failed.repetitions, 0);
});

test('SM-2 rejects ratings outside its supported range', () => {
  assert.throws(() => scheduleCard(
    { easeFactor: 2.5, interval: 0, repetitions: 0, nextReviewAt: '2026-01-01' },
    6,
  ), RangeError);
});

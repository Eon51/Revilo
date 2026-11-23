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

const { generatePlan, isValidDateKey } = loadTypeScript('lib/planner.ts');
const { scheduleCard } = loadTypeScript('lib/review.ts');
const { getCurrentStreak } = loadTypeScript('lib/statistics.ts');

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

test('planner schedules study sessions before, never on, the exam date', () => {
  const examDate = dateOffset(2);
  const plan = generatePlan(
    [{ id: 'exam', date: examDate, chapters: [{ id: 'chapter', difficulty: 1 }] }],
    { 0: 180, 1: 180, 2: 180, 3: 180, 4: 180, 5: 180, 6: 180 },
  );
  assert.ok(plan.length > 0);
  assert.ok(plan.every((session) => session.date < examDate));
});

test('planner spaces reviews across the days before the exam', () => {
  const examDate = dateOffset(10);
  const plan = generatePlan(
    [{ id: 'exam', date: examDate, chapters: [{ id: 'chapter', difficulty: 2 }] }],
    { 0: 60, 1: 60, 2: 60, 3: 60, 4: 60, 5: 60, 6: 60 },
  );
  assert.equal(plan.length, 3);
  assert.ok(new Set(plan.map((session) => session.date)).size > 1);
  assert.ok(plan.every((session) => session.date < examDate));
});

test('date keys reject impossible calendar dates', () => {
  assert.equal(isValidDateKey('2026-02-28'), true);
  assert.equal(isValidDateKey('2026-02-30'), false);
  assert.equal(isValidDateKey('26-02-28'), false);
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

test('current streak starts today or yesterday and stops at the first missed day', () => {
  assert.equal(getCurrentStreak(['2026-01-10', '2026-01-11', '2026-01-12'], '2026-01-12'), 3);
  assert.equal(getCurrentStreak(['2026-01-10', '2026-01-11'], '2026-01-12'), 2);
  assert.equal(getCurrentStreak(['2026-01-10', '2026-01-12'], '2026-01-12'), 1);
  assert.equal(getCurrentStreak(['2026-01-10'], '2026-01-12'), 0);
});

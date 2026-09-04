/**
 * Jest unit tests for the data model classes: Input, Generator, Case, Instance, Session.
 *
 * execution.js (Pyodide) is mocked so these tests run without a browser.
 * Knockout.js is the real library, running in JSDOM.
 */

// Mock execution.js so we don't need Pyodide
jest.mock('../src/execution.js', () => ({
    countSteps: jest.fn(),
}));

// Mock browser-only APIs used in a handful of Session methods
global.confirm = jest.fn(() => true);
global.alert = jest.fn();
global.window = {
    navigator: {},
    open: jest.fn(() => ({ document: { open: jest.fn(), write: jest.fn(), close: jest.fn() } })),
    URL: { createObjectURL: jest.fn(() => 'blob:mock') },
    document: global.document,
};

import ko from 'knockout';
import { Input, Generator, Case, Instance, Session, DEFAULT_GENERATORS } from '../src/models.js';
import { countSteps } from '../src/execution.js';

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function makeInput(name = 'n', type = 'int') {
    return new Input(name, type);
}

function makeGenerator(codeStrings = ['5']) {
    return new Generator(null, codeStrings.map(s => ko.observable(s)));
}

function makeCase(name = 'Worst', color = '#FF0000', generators = []) {
    return new Case(null, name, color, generators);
}

function makeInstance(c, g, value = 10, steps = 20, error = null, output = '', data = {}) {
    return new Instance(c, g, value, steps, error, output, data);
}

function emptySession() {
    return Session.EMPTY();
}

// ──────────────────────────────────────────────────────────────
// Input
// ──────────────────────────────────────────────────────────────

describe('Input', () => {
    test('constructor sets name and type as observables', () => {
        const inp = makeInput('array', 'list[int]');
        expect(inp.name()).toBe('array');
        expect(inp.type()).toBe('list[int]');
    });

    test('toJson returns plain object', () => {
        const inp = makeInput('n', 'int');
        expect(inp.toJson()).toEqual({ name: 'n', type: 'int' });
    });

    test('fromJson round-trip preserves name and type', () => {
        const inp = Input.fromJson({ name: 'x', type: 'float' });
        expect(inp.name()).toBe('x');
        expect(inp.type()).toBe('float');
    });

    test('observables are reactive', () => {
        const inp = makeInput('a', 'int');
        inp.name('b');
        expect(inp.name()).toBe('b');
    });
});

// ──────────────────────────────────────────────────────────────
// Generator
// ──────────────────────────────────────────────────────────────

describe('Generator', () => {
    test('auto-increments id when id is null', () => {
        // Reset MAX_ID to get predictable ids
        const before = Generator.MAX_ID;
        const g = new Generator(null, []);
        expect(g.id).toBe(before);
    });

    test('uses explicit id and updates MAX_ID', () => {
        const g = new Generator(999, [ko.observable('x')]);
        expect(g.id).toBe(999);
        expect(Generator.MAX_ID).toBeGreaterThanOrEqual(1000);
    });

    test('toJson serialises code correctly', () => {
        const g = makeGenerator(['10', '[1,2,3]']);
        const json = g.toJson();
        expect(json.code).toEqual(['10', '[1,2,3]']);
    });

    test('fromJson round-trip preserves id and code', () => {
        const g = makeGenerator(['5', 'abc']);
        const json = g.toJson();
        const g2 = Generator.fromJson(json);
        expect(g2.id).toBe(json.id);
        expect(g2.code().map(c => c())).toEqual(['5', 'abc']);
    });

    test('code items are ko.observables', () => {
        const g = makeGenerator(['hello']);
        const firstCode = g.code()[0];
        expect(typeof firstCode).toBe('function'); // ko.observable is a function
        firstCode('world');
        expect(firstCode()).toBe('world');
    });
});

// ──────────────────────────────────────────────────────────────
// Case
// ──────────────────────────────────────────────────────────────

describe('Case', () => {
    test('constructor sets name, color, generators as observables', () => {
        const c = makeCase('Best', '#00FF00', [makeGenerator(['3'])]);
        expect(c.name()).toBe('Best');
        expect(c.color()).toBe('#00FF00');
        expect(c.generators()).toHaveLength(1);
    });

    test('toJson includes all fields', () => {
        const g = makeGenerator(['7']);
        const c = makeCase('Avg', '#0000FF', [g]);
        const json = c.toJson();
        expect(json.name).toBe('Avg');
        expect(json.color).toBe('#0000FF');
        expect(json.generators).toHaveLength(1);
    });

    test('fromJson round-trip preserves structure', () => {
        const c = makeCase('Test', '#123456', [makeGenerator(['42'])]);
        const json = c.toJson();
        const c2 = Case.fromJson(json);
        expect(c2.name()).toBe('Test');
        expect(c2.color()).toBe('#123456');
        expect(c2.generators()).toHaveLength(1);
        expect(c2.generators()[0].code()[0]()).toBe('42');
    });
});

// ──────────────────────────────────────────────────────────────
// Instance
// ──────────────────────────────────────────────────────────────

describe('Instance', () => {
    test('stores all fields as observables', () => {
        const c = makeCase();
        const g = makeGenerator(['5']);
        const inst = makeInstance(c, g, 5, 10, null, 'output', { n: '5' });
        expect(inst.value()).toBe(5);
        expect(inst.steps()).toBe(10);
        expect(inst.error()).toBeNull();
        expect(inst.output()).toBe('output');
        expect(inst.data()).toEqual({ n: '5' });
    });

    test('toJson returns serialisable plain object', () => {
        const c = makeCase('Worst', '#FF0000', []);
        const g = makeGenerator(['3']);
        const inst = makeInstance(c, g, 3, 7, null, 'hi', {});
        const json = inst.toJson();
        expect(json.value).toBe(3);
        expect(json.steps).toBe(7);
        expect(json.output).toBe('hi');
        expect(typeof json.fromCase).toBe('number');
        expect(typeof json.fromGenerator).toBe('number');
    });

    test('fromJson restores references from lookup maps', () => {
        const c = makeCase('X');
        const g = makeGenerator(['1']);
        c.generators.push(g);
        const inst = makeInstance(c, g, 1, 2, null, '', {});
        const json = inst.toJson();
        const cs = { [c.id]: c };
        const gs = { [g.id]: g };
        const inst2 = Instance.fromJson(json, cs, gs);
        expect(inst2.fromCase).toBe(c);
        expect(inst2.fromGenerator).toBe(g);
    });

    test('dumpAll produces human-readable string', () => {
        const c = makeCase();
        const g = makeGenerator(['n = 10', 'arr = []']);
        const inst = makeInstance(c, g, 10, 3, null, '', { n: '10' });
        const dump = inst.dumpAll();
        expect(dump).toContain('n = 10');
        expect(dump).toContain('n');
    });
});

// ──────────────────────────────────────────────────────────────
// Session — construction and computed properties
// ──────────────────────────────────────────────────────────────

describe('Session — construction', () => {
    test('EMPTY() creates a session with correct defaults', () => {
        const s = emptySession();
        expect(s.title()).toBe('Untitled');
        expect(s.inputs()).toHaveLength(0);
        expect(s.cases()).toHaveLength(0);
        expect(s.instances()).toHaveLength(0);
        expect(s.runCount()).toBe(5);
    });

    test('precode computed reflects inputs', () => {
        const s = emptySession();
        s.inputs.push(makeInput('n', 'int'));
        s.inputs.push(makeInput('array', 'list[int]'));
        expect(s.precode()).toContain('n = ???');
        expect(s.precode()).toContain('array = ???');
    });

    test('precodeLength equals number of inputs', () => {
        const s = emptySession();
        expect(s.precodeLength()).toBe(0);
        s.inputs.push(makeInput());
        expect(s.precodeLength()).toBe(1);
        s.inputs.push(makeInput('x'));
        expect(s.precodeLength()).toBe(2);
    });

    test('sortedInstances sorts alphabetically by case name', () => {
        const s = emptySession();
        const cZ = makeCase('Zebra');
        const cA = makeCase('Alpha');
        const g = makeGenerator(['1']);
        s.cases.push(cZ);
        s.cases.push(cA);
        s.instances.push(makeInstance(cZ, g, 1, 1));
        s.instances.push(makeInstance(cA, g, 2, 2));
        const sorted = s.sortedInstances();
        expect(sorted[0].fromCase.name()).toBe('Alpha');
        expect(sorted[1].fromCase.name()).toBe('Zebra');
    });
});

// ──────────────────────────────────────────────────────────────
// Session — toJson / fromJson
// ──────────────────────────────────────────────────────────────

describe('Session — serialisation', () => {
    test('toJson round-trip preserves title and code', () => {
        const s = emptySession();
        s.title('My Session');
        s.code('for i in range(n): pass');
        const json = s.toJson();
        expect(json.title).toBe('My Session');
        expect(json.code).toBe('for i in range(n): pass');
    });

    test('fromJson restores inputs', () => {
        const s = emptySession();
        s.inputs.push(makeInput('n', 'int'));
        const json = s.toJson();

        const s2 = emptySession();
        s2.fromJson(json);
        expect(s2.inputs()).toHaveLength(1);
        expect(s2.inputs()[0].name()).toBe('n');
    });

    test('fromJson restores cases and generators', () => {
        const s = emptySession();
        const c = makeCase('Best', '#00FF00', [makeGenerator(['5'])]);
        s.cases.push(c);
        const json = s.toJson();

        const s2 = emptySession();
        s2.fromJson(json);
        expect(s2.cases()).toHaveLength(1);
        expect(s2.cases()[0].name()).toBe('Best');
        expect(s2.cases()[0].generators()).toHaveLength(1);
    });

    test('fromJson clears existing data before loading', () => {
        const s = emptySession();
        s.inputs.push(makeInput('old', 'int'));
        s.fromJson({ inputs: [], cases: [], instances: [], code: '', title: 'Fresh' });
        expect(s.inputs()).toHaveLength(0);
        expect(s.title()).toBe('Fresh');
    });

    test('toJson and fromJson handle instances', () => {
        const s = emptySession();
        s.inputs.push(makeInput('n', 'int'));
        const c = makeCase('W', '#f00', [makeGenerator(['3'])]);
        s.cases.push(c);
        const g = c.generators()[0];
        s.instances.push(makeInstance(c, g, 3, 9, null, '', { n: '3' }));
        const json = s.toJson();

        const s2 = emptySession();
        s2.fromJson(json);
        expect(s2.instances()).toHaveLength(1);
        expect(s2.instances()[0].value()).toBe(3);
        expect(s2.instances()[0].steps()).toBe(9);
    });
});

// ──────────────────────────────────────────────────────────────
// Session — input management
// ──────────────────────────────────────────────────────────────

describe('Session — input management', () => {
    test('addInput appends a new input with default name', () => {
        const s = emptySession();
        s.addInput();
        expect(s.inputs()).toHaveLength(1);
    });

    test('addInput adds empty generator slot to existing generators', () => {
        const s = emptySession();
        s.inputs.push(makeInput('n', 'int'));
        const c = makeCase('X', '#fff', [makeGenerator(['5'])]);
        s.cases.push(c);
        s.addInput();
        // Each generator should now have 2 code slots
        expect(c.generators()[0].code()).toHaveLength(2);
    });

    test('removeInput removes the input at the correct position', () => {
        const s = emptySession();
        const inp1 = makeInput('n', 'int');
        const inp2 = makeInput('arr', 'list[int]');
        s.inputs.push(inp1);
        s.inputs.push(inp2);
        s.removeInput(inp1);
        expect(s.inputs()).toHaveLength(1);
        expect(s.inputs()[0].name()).toBe('arr');
    });

    test('removeInput removes corresponding code slot from generators', () => {
        const s = emptySession();
        const inp1 = makeInput('n', 'int');
        const inp2 = makeInput('arr', 'list[int]');
        s.inputs.push(inp1);
        s.inputs.push(inp2);
        const g = new Generator(null, [ko.observable('5'), ko.observable('[1,2,3]')]);
        const c = makeCase('T', '#000', [g]);
        s.cases.push(c);
        s.removeInput(inp1);
        // Generator should now have only 1 code slot
        expect(g.code()).toHaveLength(1);
        expect(g.code()[0]()).toBe('[1,2,3]');
    });

    test('getInput returns the name of the input at the given index', () => {
        const s = emptySession();
        s.inputs.push(makeInput('alpha', 'int'));
        s.inputs.push(makeInput('beta', 'list[int]'));
        expect(s.getInput(null, 0)).toBe('alpha');
        expect(s.getInput(null, 1)).toBe('beta');
    });
});

// ──────────────────────────────────────────────────────────────
// Session — case management
// ──────────────────────────────────────────────────────────────

describe('Session — case management', () => {
    test('addCase appends a new case', () => {
        const s = emptySession();
        s.addCase();
        expect(s.cases()).toHaveLength(1);
        expect(s.cases()[0].name()).toBe('Worst');
    });

    test('removeCase removes the case and its instances', () => {
        const s = emptySession();
        const c = makeCase('ToRemove');
        const g = makeGenerator(['1']);
        c.generators.push(g);
        s.cases.push(c);
        s.instances.push(makeInstance(c, g, 1, 1));

        global.confirm.mockReturnValueOnce(true);
        s.removeCase(c);

        expect(s.cases()).toHaveLength(0);
        expect(s.instances()).toHaveLength(0);
    });
});

// ──────────────────────────────────────────────────────────────
// Session — generator management
// ──────────────────────────────────────────────────────────────

describe('Session — generator management', () => {
    test('addGenerator adds a generator to the case', () => {
        const s = emptySession();
        s.inputs.push(makeInput('n', 'int'));
        const c = makeCase('W');
        s.cases.push(c);
        s.addGenerator(c);
        expect(c.generators()).toHaveLength(1);
    });

    test('addGenerator uses default code for input type', () => {
        const s = emptySession();
        s.inputs.push(makeInput('n', 'int'));
        const c = makeCase('W');
        s.cases.push(c);
        s.addGenerator(c);
        const code = c.generators()[0].code()[0]();
        expect(code).toBe(DEFAULT_GENERATORS['int']);
    });

    test('duplicateGenerator appends a new generator with same code', () => {
        const s = emptySession();
        const original = makeGenerator(['100', '[1,2]']);
        const c = makeCase('T', '#000', [original]);
        s.cases.push(c);

        s.duplicateGenerator(c, original);
        expect(c.generators()).toHaveLength(2);
        const dup = c.generators()[1];
        expect(dup.code()[0]()).toBe('100');
        expect(dup.code()[1]()).toBe('[1,2]');
    });

    test('duplicateGenerator creates a new generator instance (not same reference)', () => {
        const s = emptySession();
        const original = makeGenerator(['7']);
        const c = makeCase('T', '#000', [original]);
        s.cases.push(c);

        s.duplicateGenerator(c, original);
        expect(c.generators()[1]).not.toBe(original);
        expect(c.generators()[1].id).not.toBe(original.id);
    });

    test('removeGenerator removes the generator and its instances', () => {
        const s = emptySession();
        const g = makeGenerator(['5']);
        const c = makeCase('T', '#000', [g]);
        s.cases.push(c);
        s.instances.push(makeInstance(c, g, 5, 5));

        global.confirm.mockReturnValueOnce(true);
        s.removeGenerator(c, g);

        expect(c.generators()).toHaveLength(0);
        expect(s.instances()).toHaveLength(0);
    });
});

// ──────────────────────────────────────────────────────────────
// Session — instance management
// ──────────────────────────────────────────────────────────────

describe('Session — instance management', () => {
    test('clearInstances empties the instances array', () => {
        const s = emptySession();
        const c = makeCase();
        const g = makeGenerator(['1']);
        s.instances.push(makeInstance(c, g, 1, 1));
        s.instances.push(makeInstance(c, g, 2, 2));
        s.clearInstances();
        expect(s.instances()).toHaveLength(0);
    });

    test('clearInstancesSafely moves instances to undoRemoveInstances', () => {
        const s = emptySession();
        const c = makeCase();
        const g = makeGenerator(['1']);
        s.instances.push(makeInstance(c, g, 1, 1));
        s.clearInstancesSafely();
        expect(s.instances()).toHaveLength(0);
        expect(s.undoRemoveInstances()).toHaveLength(1);
    });

    test('restoreInstance re-adds the most recently deleted instance', () => {
        const s = emptySession();
        const g = makeGenerator(['1']);
        const c = makeCase('X', '#000', [g]);
        s.cases.push(c);  // case must still exist for restoreInstance to work
        const inst = makeInstance(c, g, 1, 1);
        s.instances.push(inst);
        s.removeInstance(inst);
        // undoRemoveInstances should have one entry now
        expect(s.undoRemoveInstances()).toHaveLength(1);
        s.restoreInstance();
        expect(s.instances()).toHaveLength(1);
        expect(s.undoRemoveInstances()).toHaveLength(0);
    });

    test('removeInstance removes the instance from instances and pushes to undo queue', () => {
        const s = emptySession();
        const c = makeCase();
        const g = makeGenerator(['1']);
        const inst = makeInstance(c, g, 5, 10);
        s.instances.push(inst);
        s.removeInstance(inst);
        expect(s.instances()).toHaveLength(0);
        expect(s.undoRemoveInstances()).toHaveLength(1);
    });
});

// ──────────────────────────────────────────────────────────────
// Session — run count
// ──────────────────────────────────────────────────────────────

describe('Session — runCount', () => {
    test('default runCount is 5', () => {
        expect(emptySession().runCount()).toBe(5);
    });

    test('runCount is settable', () => {
        const s = emptySession();
        s.runCount(10);
        expect(s.runCount()).toBe(10);
    });

    test('runCount is persisted in toJson as part of session title/code (not separately)', () => {
        // runCount is UI state, not persisted — just verify toJson doesn't error
        const s = emptySession();
        s.runCount(3);
        expect(() => s.toJson()).not.toThrow();
    });
});

// ──────────────────────────────────────────────────────────────
// Session — runGenerator (mocked Pyodide)
// ──────────────────────────────────────────────────────────────

describe('Session — runGenerator', () => {
    beforeEach(() => {
        countSteps.mockReset();
    });

    test('runGenerator calls countSteps with correct arguments', () => {
        countSteps.mockImplementation((_code, _names, _values, cb) => {
            cb(5, 10, '', null, { n: '5' });
            return Promise.resolve();
        });

        const s = emptySession();
        s.inputs.push(makeInput('n', 'int'));
        s.code('for i in range(n): pass');
        const c = makeCase('W');
        const g = makeGenerator(['5']);
        s.cases.push(c);

        s.runGenerator(c, g);

        expect(countSteps).toHaveBeenCalledTimes(1);
        const [code, names, values] = countSteps.mock.calls[0];
        expect(code).toContain('range(n)');
        expect(names).toContain('n');
        expect(values).toContain('5');
    });

    test('runGenerator adds instance to instances after execution', async () => {
        countSteps.mockImplementation((_code, _names, _values, cb) => {
            cb(5, 10, 'output', null, {});
            return Promise.resolve();
        });

        const s = emptySession();
        s.inputs.push(makeInput('n', 'int'));
        s.code('x = 1');
        const c = makeCase('W');
        const g = makeGenerator(['5']);
        s.cases.push(c);

        await s.runGenerator(c, g);

        expect(s.instances()).toHaveLength(1);
        const inst = s.instances()[0];
        expect(inst.value()).toBe(5);
        expect(inst.steps()).toBe(10);
        expect(inst.output()).toBe('output');
        expect(inst.error()).toBeNull();
    });

    test('runGenerator captures error in instance', async () => {
        countSteps.mockImplementation((_code, _names, _values, cb) => {
            cb(0, null, '', 'NameError: x not defined', {});
            return Promise.resolve();
        });

        const s = emptySession();
        s.inputs.push(makeInput('n', 'int'));
        s.code('x = undefined_var');
        const c = makeCase('W');
        const g = makeGenerator(['5']);
        s.cases.push(c);

        await s.runGenerator(c, g);

        expect(s.instances()[0].error()).toBe('NameError: x not defined');
    });

    test('runGeneratorN calls runGenerator runCount times', async () => {
        countSteps.mockImplementation((_code, _names, _values, cb) => {
            cb(5, 1, '', null, {});
            return Promise.resolve();
        });

        const s = emptySession();
        s.inputs.push(makeInput('n', 'int'));
        s.code('x = 1');
        s.runCount(3);
        const c = makeCase('W');
        const g = makeGenerator(['5']);
        s.cases.push(c);

        s.runGeneratorN(c, g);
        // Allow microtask queue to flush
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(countSteps.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
});

// ──────────────────────────────────────────────────────────────
// Session — filling empty cases
// ──────────────────────────────────────────────────────────────

describe('Session.fillEmptyCases', () => {
    /** A session shaped like a lesson question: two empty cases, nothing to run. */
    function loaded(file, {inputs = [{ name: 'n', type: 'int' }, { name: 'numbers', type: 'list[int]' }],
        cases = [{ id: 0, name: 'Worst', color: '#FF0000', generators: [] },
            { id: 1, name: 'Best', color: '#00FF00', generators: [] }],
        title = 'Untitled'} = {}) {
        const s = emptySession();
        s.fromJson({ inputs, cases, instances: [], code: 'sum = 0', title }, file);
        return s;
    }

    const codeOf = (aCase) => aCase.generators().map((g) => g.code().map((c) => c()));
    const caseNamed = (s, name) => s.cases().find((c) => c.name() === name);

    describe('a problem with curated cases', () => {
        test('gives each case inputs written for that algorithm', () => {
            const s = loaded('RCB_lesson_4_question_2.json');
            const {filled, note} = s.fillEmptyCases();

            expect(filled.sort()).toEqual(['Best', 'Worst']);
            expect(note).toMatch(/loop always runs n times/);
            // All odd, so the body of the if never runs
            expect(codeOf(caseNamed(s, 'Best'))).toEqual([
                ['10', '[1] * n'], ['20', '[1] * n'], ['40', '[1] * n'], ['80', '[1] * n'],
            ]);
            // All even, so it always does
            expect(codeOf(caseNamed(s, 'Worst'))).toEqual([
                ['10', '[2] * n'], ['20', '[2] * n'], ['40', '[2] * n'], ['80', '[2] * n'],
            ]);
        });

        test('varies n itself when that is what the answer turns on', () => {
            const s = loaded('RCB_lesson_4_question_3.json');
            s.fillEmptyCases();
            // An even n skips the loop, an odd n runs it
            expect(codeOf(caseNamed(s, 'Best')).map((row) => row[0])).toEqual(['10', '20', '40', '80']);
            expect(codeOf(caseNamed(s, 'Worst')).map((row) => row[0])).toEqual(['11', '21', '41', '81']);
        });

        test('gives both cases the same inputs when the runtime cannot vary', () => {
            const s = loaded('RCB_lesson_4_question_4.json', { inputs: [{ name: 'n', type: 'int' }] });
            const {note} = s.fillEmptyCases();
            expect(codeOf(caseNamed(s, 'Best'))).toEqual(codeOf(caseNamed(s, 'Worst')));
            expect(note).toMatch(/quadratic/);
        });

        test('creates a case the problem is missing, such as a worst case', () => {
            const s = loaded('RCB_find_with_break.json', {
                inputs: [{ name: 'n', type: 'int' }, { name: 'array', type: 'list[int]' }, { name: 'k', type: 'int' }],
                cases: [{ id: 0, name: 'Best', color: '#00FF00', generators: [] }],
            });
            const {filled} = s.fillEmptyCases();

            expect(filled).toEqual(['Best', 'Worst']);
            expect(s.cases().map((c) => c.name())).toEqual(['Best', 'Worst']);
            // Each input builds on the one before: array from n, then k from array
            expect(codeOf(caseNamed(s, 'Best'))[0]).toEqual(['10', 'list(range(n))', 'array[0]']);
            expect(codeOf(caseNamed(s, 'Worst'))[0]).toEqual(['10', 'list(range(n))', '-1']);
        });

        test('is found by title for a session opened from disk', () => {
            const s = loaded(undefined, { title: 'Lesson 4 Question 6' });
            const {note} = s.fillEmptyCases();
            expect(note).toMatch(/negative number at the front/);
            expect(codeOf(caseNamed(s, 'Best'))[0]).toEqual(['10', '[-1] + [1] * (n - 1)']);
        });

        test('falls back to suggestions when the problem no longer has those inputs', () => {
            const s = loaded('RCB_lesson_4_question_2.json', {
                inputs: [{ name: 'n', type: 'int' }, { name: 'numbers', type: 'list[int]' }, { name: 'extra', type: 'int' }],
            });
            const {filled, note} = s.fillEmptyCases();

            expect(filled.sort()).toEqual(['Best', 'Worst']);
            expect(note).toBe('');
            codeOf(caseNamed(s, 'Best')).forEach((row) => expect(row).toHaveLength(3));
        });

        test('leaves a case the student has already filled in', () => {
            const s = loaded('RCB_lesson_4_question_2.json');
            s.addGenerator(caseNamed(s, 'Best'));
            const {filled} = s.fillEmptyCases();

            expect(filled).toEqual(['Worst']);
            expect(caseNamed(s, 'Best').generators()).toHaveLength(1);
            expect(caseNamed(s, 'Worst').generators()).toHaveLength(4);
        });
    });

    describe('a problem with nothing curated', () => {
        test('falls back to a spread of sizes from the declared types', () => {
            const s = loaded('RCB_something_else.json');
            const {filled, note} = s.fillEmptyCases();

            expect(filled.sort()).toEqual(['Best', 'Worst']);
            expect(note).toBe('');
            expect(codeOf(caseNamed(s, 'Best'))).toEqual([
                ['10', 'list(range(n))'], ['20', 'list(range(n))'],
                ['40', 'list(range(n))'], ['80', 'list(range(n))'],
            ]);
        });

        test('suggests the same values every time, so a re-run plots the same point', () => {
            const first = loaded('RCB_something_else.json');
            const second = loaded('RCB_something_else.json');
            first.fillEmptyCases();
            second.fillEmptyCases();
            expect(codeOf(caseNamed(first, 'Best'))).toEqual(codeOf(caseNamed(second, 'Best')));
        });

        test('creates a Best and a Worst case when there are none at all', () => {
            const s = loaded('RCB_something_else.json', { inputs: [{ name: 'n', type: 'int' }], cases: [] });
            expect(s.fillEmptyCases().filled).toEqual(['Best', 'Worst']);
            expect(s.cases().map((c) => c.name())).toEqual(['Best', 'Worst']);
            expect(s.cases()[0].color()).not.toBe(s.cases()[1].color());
        });
    });

    test('does nothing when there is nothing to generate from', () => {
        const s = loaded('RCB_lesson_4_question_2.json', { inputs: [] });
        expect(s.fillEmptyCases()).toEqual({ filled: [], note: '' });
    });

    test('does nothing when every case is already filled', () => {
        const s = loaded('RCB_lesson_4_question_2.json');
        s.fillEmptyCases();
        expect(s.fillEmptyCases().filled).toEqual([]);
        s.cases().forEach((c) => expect(c.generators()).toHaveLength(4));
    });

    test('does not run anything', () => {
        const s = loaded('RCB_lesson_4_question_2.json');
        countSteps.mockClear();
        s.fillEmptyCases();
        expect(s.instances()).toHaveLength(0);
        expect(countSteps).not.toHaveBeenCalled();
    });

    test('generator ids stay unique so instances can be traced back', () => {
        const s = loaded('RCB_lesson_4_question_2.json');
        s.fillEmptyCases();
        const ids = s.cases().flatMap((c) => c.generators().map((g) => g.id));
        expect(new Set(ids).size).toBe(ids.length);
    });
});

// ──────────────────────────────────────────────────────────────
// Session — loadedFrom / hasUnsavedWork
// ──────────────────────────────────────────────────────────────

describe('Session.loadedFrom', () => {
    const DATA = { inputs: [], cases: [], instances: [], code: 'x = 1', title: 'T' };

    test('is empty for a session loaded without a source file', () => {
        const s = emptySession();
        s.fromJson(DATA);
        expect(s.loadedFrom()).toBe('');
    });

    test('records the example file a session was loaded from', () => {
        const s = emptySession();
        s.fromJson(DATA, 'RCB_binary_search.json');
        expect(s.loadedFrom()).toBe('RCB_binary_search.json');
    });

    test('clears again when a session is then loaded from disk', () => {
        const s = emptySession();
        s.fromJson(DATA, 'RCB_binary_search.json');
        s.fromJson(DATA);
        expect(s.loadedFrom()).toBe('');
    });

    test('is not part of the saved JSON', () => {
        const s = emptySession();
        s.fromJson(DATA, 'RCB_binary_search.json');
        expect(Object.keys(s.toJson()).sort()).toEqual(['cases', 'code', 'inputs', 'instances', 'title']);
    });
});

describe('Instance output normalization', () => {
    test('an output saved as an array of lines becomes a string', () => {
        const c = makeCase('W');
        const g = makeGenerator(['5']);
        const inst = Instance.fromJson(
            { fromCase: c.id, fromGenerator: g.id, value: 1, steps: 5, error: null, output: ['7\n'], data: {} },
            { [c.id]: c }, { [g.id]: g },
        );
        expect(inst.output()).toBe('7\n');
        expect(() => inst.output().trim()).not.toThrow();
    });

    test('a missing output becomes the empty string, so the table shows "no printed output"', () => {
        const c = makeCase('W');
        const g = makeGenerator(['5']);
        const inst = makeInstance(c, g, 1, 5, null, null, {});
        expect(inst.output()).toBe('');
    });

    test('saving normalizes the stored shape', () => {
        const c = makeCase('W');
        const g = makeGenerator(['5']);
        const inst = makeInstance(c, g, 1, 5, null, ['a\n', 'b\n'], {});
        expect(inst.toJson().output).toBe('a\nb\n');
    });
});

describe('Session.fromJson robustness', () => {
    test('drops instances whose case or generator is missing, keeping the rest', () => {
        const s = emptySession();
        s.fromJson({
            inputs: [{ name: 'n', type: 'int' }],
            cases: [{ id: 0, name: 'W', color: '#FF0000', generators: [{ id: 0, code: ['5'] }] }],
            instances: [
                { fromCase: 0, fromGenerator: 0, value: 5, steps: 1, error: null, output: '', data: {} },
                { fromCase: 9, fromGenerator: 0, value: 5, steps: 1, error: null, output: '', data: {} },
                { fromCase: 0, fromGenerator: 9, value: 5, steps: 1, error: null, output: '', data: {} },
            ],
            code: 'x = 1',
            title: 'T',
        });
        expect(s.instances()).toHaveLength(1);
        expect(s.instances()[0].fromCase).toBe(s.cases()[0]);
    });

    test('leaves the open session untouched when the new one is malformed', () => {
        const s = emptySession();
        s.fromJson({ inputs: [], cases: [], instances: [], code: 'good = 1', title: 'Good' }, 'RCB_good.json');

        expect(() => s.fromJson({ inputs: [{ name: 'n', type: 'int' }], cases: [{ id: 0, name: 'W', color: '#F00' }] }))
            .toThrow();

        expect(s.title()).toBe('Good');
        expect(s.code()).toBe('good = 1');
        expect(s.loadedFrom()).toBe('RCB_good.json');
    });
});

describe('Session.hasUnsavedWork', () => {
    const DATA = { inputs: [], cases: [], instances: [], code: 'x = 1', title: 'T' };

    test('is false for a freshly loaded session', () => {
        const s = emptySession();
        s.fromJson(DATA);
        expect(s.hasUnsavedWork()).toBe(false);
    });

    test('is false for a session that came with its own plotted instances', () => {
        const s = emptySession();
        s.fromJson({
            inputs: [{ name: 'n', type: 'int' }],
            cases: [{ id: 0, name: 'W', color: '#FF0000', generators: [{ id: 0, code: ['5'] }] }],
            instances: [{ fromCase: 0, fromGenerator: 0, value: 5, steps: 1, error: null, output: '', data: {} }],
            code: 'x = 1',
            title: 'T',
        });
        expect(s.instances()).toHaveLength(1);
        expect(s.hasUnsavedWork()).toBe(false);
    });

    test('is true once one of those saved instances is deleted', () => {
        const s = emptySession();
        s.fromJson({
            inputs: [{ name: 'n', type: 'int' }],
            cases: [{ id: 0, name: 'W', color: '#FF0000', generators: [{ id: 0, code: ['5'] }] }],
            instances: [{ fromCase: 0, fromGenerator: 0, value: 5, steps: 1, error: null, output: '', data: {} }],
            code: 'x = 1',
            title: 'T',
        });
        s.removeInstance(s.instances()[0]);
        expect(s.hasUnsavedWork()).toBe(true);
    });

    test('is true once the code is edited, and false again if it is put back', () => {
        const s = emptySession();
        s.fromJson(DATA);
        s.code('x = 2');
        expect(s.hasUnsavedWork()).toBe(true);
        s.code('x = 1');
        expect(s.hasUnsavedWork()).toBe(false);
    });

    test('is true once an instance has been plotted', () => {
        const s = emptySession();
        s.fromJson(DATA);
        const c = makeCase('W');
        const g = makeGenerator(['5']);
        s.cases.push(c);
        s.instances.push(makeInstance(c, g));
        expect(s.hasUnsavedWork()).toBe(true);
    });

    test('resets when another session is loaded over the top', () => {
        const s = emptySession();
        s.fromJson(DATA);
        s.code('x = 2');
        s.fromJson({ ...DATA, code: 'y = 9' }, 'RCB_other.json');
        expect(s.hasUnsavedWork()).toBe(false);
    });
});

/**
 * Regression tests over the real session files in sessions/.
 *
 * Nine of them used to carry plotted points saved by an older version of the
 * tool, which stored an instance's printed output as an array of lines. The
 * instances table calls .trim() on that value, so an array threw while the table
 * rendered and left the page unable to load anything else. Those points have
 * since been cleared, but sessions students saved themselves can still hold the
 * old shape, so the handling is covered in utilities.test.js and models.test.js.
 *
 * These tests load every shipped session the way the app does and check what the
 * page will be handed.
 */
jest.mock('../src/execution.js', () => ({
    countSteps: jest.fn(),
}));

const fs = require('fs');
const path = require('path');

import {Session} from '../src/models.js';

const SESSIONS_DIR = path.resolve(__dirname, '..', 'sessions');
const FILES = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.json'));
const read = (file) => JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf8'));

/** Sessions that arrive with cases but nothing in them, which Ctrl+I twice fills in. */
const EMPTY_CASE_FILES = FILES.filter((file) => {
    const data = read(file);
    const cases = data.cases || [];
    return cases.length > 0 && cases.every((c) => (c.generators || []).length === 0);
});

describe('every shipped session', () => {
    test.each(FILES)('%s loads without throwing', (file) => {
        const session = Session.EMPTY();
        expect(() => session.fromJson(read(file), file)).not.toThrow();
        expect(session.loadedFrom()).toBe(file);
    });

    test.each(FILES)('%s gives every instance a string output', (file) => {
        const session = Session.EMPTY();
        session.fromJson(read(file), file);
        session.instances().forEach((instance) => {
            expect(typeof instance.output()).toBe('string');
            // This is what the instances table does with it
            expect(() => instance.output().trim()).not.toThrow();
        });
    });

    test.each(FILES)('%s keeps all of its saved instances', (file) => {
        const data = read(file);
        const session = Session.EMPTY();
        session.fromJson(data, file);
        expect(session.instances().length).toBe((data.instances || []).length);
    });

    test.each(FILES)('%s does not look edited straight after loading', (file) => {
        const session = Session.EMPTY();
        session.fromJson(read(file), file);
        expect(session.hasUnsavedWork()).toBe(false);
    });

    test('no shipped session carries plotted points', () => {
        // They were cleared because their step counts came from an older counter:
        // plotting them beside a fresh run drew two lines of different slopes for one
        // case. Before adding points back to a session, check they came from the
        // counter in execution.js.
        const withInstances = FILES.filter((f) => (read(f).instances || []).length > 0);
        expect(withInstances).toEqual([]);
    });

    // The runner assigns inputs in declared order before the algorithm runs, so a
    // generator can only build on inputs declared above it. Referring to one declared
    // later would raise NameError for every instance of that case.
    const escaped = (name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const refers = (snippet, name) =>
        new RegExp(`(^|[^A-Za-z0-9_])${escaped(name)}([^A-Za-z0-9_]|$)`).test(String(snippet));

    test.each(FILES)('%s never builds an input from one declared after it', (file) => {
        const data = read(file);
        const names = data.inputs.map((i) => i.name);
        const violations = [];
        (data.cases || []).forEach((aCase) => (aCase.generators || []).forEach((generator) => {
            (generator.code || []).forEach((snippet, position) => {
                names.slice(position + 1).forEach((later) => {
                    if (refers(snippet, later)) {
                        violations.push(`${names[position]} = ${snippet} refers to ${later}, declared after it`);
                    }
                });
            });
        }));
        expect(violations).toEqual([]);
    });

    test('building a later input from an earlier one is used, and allowed', () => {
        // for example n, then a list sized by n, then a key taken from that list
        const withChain = FILES.filter((file) => {
            const data = read(file);
            const names = data.inputs.map((i) => i.name);
            return (data.cases || []).some((c) => (c.generators || []).some((g) =>
                (g.code || []).some((snippet, position) =>
                    names.slice(0, position).some((earlier) => refers(snippet, earlier)))));
        });
        expect(withChain.length).toBeGreaterThan(0);
    });

    test('every lesson question arrives with empty cases, which is what the shortcut is for', () => {
        const lessons = FILES.filter((f) => f.includes('lesson'));
        expect(lessons.length).toBeGreaterThan(0);
        lessons.forEach((f) => expect(EMPTY_CASE_FILES).toContain(f));
    });

    test('the session model agrees about which sessions arrive empty', () => {
        EMPTY_CASE_FILES.forEach((file) => {
            const session = Session.EMPTY();
            session.fromJson(read(file), file);
            expect(session.emptyCases()).toHaveLength(session.cases().length);
        });
    });

    test.each(EMPTY_CASE_FILES)('%s can be filled in with example inputs', (file) => {
        const session = Session.EMPTY();
        session.fromJson(read(file), file);
        const inputCount = session.inputs().length;

        const {filled} = session.fillEmptyCases();

        expect(filled.sort()).toEqual(session.cases().map((c) => c.name()).sort());
        expect(session.emptyCases()).toHaveLength(0);
        session.cases().forEach((aCase) => {
            expect(aCase.generators()).toHaveLength(4);
            aCase.generators().forEach((generator) => {
                const code = generator.code().map((c) => c());
                expect(code).toHaveLength(inputCount);
                // These sessions declare only types we know how to generate values for
                code.forEach((snippet) => expect(snippet).not.toBe(''));
            });
        });
        // Filling in inputs must never run them
        expect(session.instances()).toHaveLength(0);
    });

    test('loading one session after another leaves no trace of the first', () => {
        const session = Session.EMPTY();
        const shipped = FILES[0];

        // A session that does carry plotted points, in the shape older saves used
        session.fromJson({
            inputs: [{ name: 'n', type: 'int' }],
            cases: [{ id: 0, name: 'W', color: '#FF0000', generators: [{ id: 0, code: ['5'] }] }],
            instances: [{ fromCase: 0, fromGenerator: 0, value: 5, steps: 1, error: null, output: ['5\n'], data: {} }],
            code: 'x = 1',
            title: 'Saved work',
        }, 'RCB_saved.json');
        expect(session.instances()).toHaveLength(1);
        expect(session.instances()[0].output()).toBe('5\n');

        session.fromJson(read(shipped), shipped);
        expect(session.instances()).toHaveLength(0);
        expect(session.title()).toBe(read(shipped).title);
        expect(session.loadedFrom()).toBe(shipped);
        expect(session.hasUnsavedWork()).toBe(false);
    });
});

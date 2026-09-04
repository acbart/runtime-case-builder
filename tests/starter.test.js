/**
 * Tests for the built-in starter session (src/starter.js) and the helpers in
 * src/examples.js.
 */
jest.mock('../src/execution.js', () => ({
    countSteps: jest.fn(),
}));

import {Session} from '../src/models.js';
import {STARTER_SESSION, STARTER_SIZES} from '../src/starter.js';
import {preloadUrl} from '../src/examples.js';

describe('STARTER_SESSION', () => {
    test('has a Best and a Worst case', () => {
        expect(STARTER_SESSION.cases.map((c) => c.name)).toEqual(['Best', 'Worst']);
    });

    test('uses doubling input sizes 10, 20, 40, 80 in every case', () => {
        expect(STARTER_SIZES).toEqual([10, 20, 40, 80]);
        STARTER_SESSION.cases.forEach((c) => {
            expect(c.generators.map((g) => g.code[0])).toEqual(['10', '20', '40', '80']);
        });
    });

    test('generators line up with the declared inputs', () => {
        const arity = STARTER_SESSION.inputs.length;
        STARTER_SESSION.cases.forEach((c) => {
            c.generators.forEach((g) => expect(g.code).toHaveLength(arity));
        });
        expect(STARTER_SESSION.inputs[0].name).toBe('n');
    });

    test('Best and Worst differ only in the target', () => {
        const [best, worst] = STARTER_SESSION.cases;
        best.generators.forEach((g, i) => {
            expect(g.code.slice(0, 2)).toEqual(worst.generators[i].code.slice(0, 2));
            expect(g.code[2]).not.toBe(worst.generators[i].code[2]);
        });
    });

    test('case and generator ids are unique', () => {
        const caseIds = STARTER_SESSION.cases.map((c) => c.id);
        const genIds = STARTER_SESSION.cases.flatMap((c) => c.generators.map((g) => g.id));
        expect(new Set(caseIds).size).toBe(caseIds.length);
        expect(new Set(genIds).size).toBe(genIds.length);
    });

    test('loads into a Session and round-trips through toJson', () => {
        const session = Session.EMPTY();
        session.fromJson(STARTER_SESSION);
        expect(session.title()).toBe('Linear Search');
        expect(session.inputs().map((i) => i.name())).toEqual(['n', 'numbers', 'target']);
        expect(session.cases()).toHaveLength(2);
        expect(session.instances()).toHaveLength(0);
        expect(session.code()).toContain('def find(values, target)');
        expect(session.toJson()).toEqual(STARTER_SESSION);
    });
});

describe('preloadUrl', () => {
    test('adds the preload parameter to the current path', () => {
        const loc = {pathname: '/rcb/', search: '', hash: ''};
        expect(preloadUrl('RCB_binary_search.json', loc)).toBe('/rcb/?preload=RCB_binary_search.json');
    });

    test('replaces an existing preload and keeps other params and the hash', () => {
        const loc = {pathname: '/index.html', search: '?preload=RCB_old.json&debug=1', hash: '#top'};
        expect(preloadUrl('RCB_new.json', loc)).toBe('/index.html?preload=RCB_new.json&debug=1#top');
    });
});

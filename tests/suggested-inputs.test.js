/**
 * Tests for src/suggested-inputs.js: the example inputs offered for a problem
 * whose cases are still empty.
 */
import ko from 'knockout';
import {
    SWEEP_SIZES, snippetFor, suggestGenerator, suggestGenerators,
} from '../src/suggested-inputs.js';

const input = (name, type) => ({name: ko.observable(name), type: ko.observable(type)});

describe('snippetFor', () => {
    test('builds a list sized by the given expression', () => {
        expect(snippetFor('list[int]', 'n')).toBe('list(range(n))');
        expect(snippetFor('list[int]', 40)).toBe('list(range(40))');
    });

    test('produces the same value every time, so a re-run plots the same point', () => {
        ['int', 'float', 'bool', 'str', 'list[int]', 'list[str]', 'set[int]', 'list[list[int]]']
            .forEach((type) => {
                expect(snippetFor(type, 'n', 20)).not.toMatch(/rand|uniform|choice|shuffle|sample/);
            });
    });

    test('sizes a plain int by the sweep it belongs to', () => {
        expect(snippetFor('int', 'n', 20)).toBe('10');
        expect(snippetFor('int', 'n', 80)).toBe('40');
        expect(snippetFor('int', 'n', 1)).toBe('1');
    });

    test('covers the types offered in the type dropdown', () => {
        ['int', 'float', 'bool', 'str', 'list', 'list[int]', 'list[str]', 'list[bool]',
            'list[float]', 'list[list[int]]', 'set', 'set[int]', 'set[str]', 'set[bool]', 'set[float]']
            .forEach((type) => {
                expect(snippetFor(type, 'n').length).toBeGreaterThan(0);
            });
    });

    test('ignores case and spacing in the declared type', () => {
        expect(snippetFor('List[int]', 'n')).toBe(snippetFor('list[int]', 'n'));
        expect(snippetFor('list[ int ]', 'n')).toBe(snippetFor('list[int]', 'n'));
    });

    test('leaves an unfamiliar or missing type blank for the student', () => {
        expect(snippetFor('tuple[int, int]', 'n')).toBe('');
        expect(snippetFor('', 'n')).toBe('');
        expect(snippetFor(undefined, 'n')).toBe('');
    });
});

describe('suggestGenerator', () => {
    test('gives the input named n the size itself', () => {
        expect(suggestGenerator([input('n', 'int')], 20)).toEqual(['20']);
    });

    test('sizes later inputs by n once n has been assigned', () => {
        const code = suggestGenerator([input('n', 'int'), input('numbers', 'list[int]')], 40);
        expect(code).toEqual(['40', 'list(range(n))']);
    });

    test('writes the size out when n comes later, since it is not assigned yet', () => {
        const code = suggestGenerator([input('values', 'list[int]'), input('n', 'int')], 40);
        expect(code).toEqual(['list(range(40))', '40']);
    });

    test('writes the size out when there is no input named n', () => {
        const code = suggestGenerator([input('values', 'list[int]'), input('target', 'int')], 80);
        expect(code).toEqual(['list(range(80))', '40']);
    });

    test('returns one entry per input, whatever the types', () => {
        const inputs = [input('n', 'int'), input('text', 'str'), input('flag', 'bool'), input('odd', 'tuple')];
        expect(suggestGenerator(inputs, 10)).toHaveLength(inputs.length);
    });

    test('reads plain objects as happily as observables', () => {
        expect(suggestGenerator([{name: 'n', type: 'int'}], 10)).toEqual(['10']);
    });
});

describe('suggestGenerators', () => {
    test('sweeps doubling sizes so growth is visible', () => {
        expect(SWEEP_SIZES).toEqual([10, 20, 40, 80]);
        const generators = suggestGenerators([input('n', 'int')]);
        expect(generators).toEqual([['10'], ['20'], ['40'], ['80']]);
    });

    test('the sizes can be chosen', () => {
        expect(suggestGenerators([input('n', 'int')], [1, 2])).toEqual([['1'], ['2']]);
    });

    test('every generator has one entry per input', () => {
        const inputs = [input('n', 'int'), input('numbers', 'list[int]'), input('target', 'int')];
        suggestGenerators(inputs).forEach((code) => expect(code).toHaveLength(3));
    });

    test('handles a session with no inputs at all', () => {
        expect(suggestGenerators([])).toEqual([[], [], [], []]);
    });
});

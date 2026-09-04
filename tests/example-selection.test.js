/**
 * Tests for src/example-selection.js: the wiring that keeps the "Load example"
 * dropdown showing whichever session is currently open.
 */
import ko from 'knockout';
import {createExampleSelection} from '../src/example-selection.js';

/** A stand-in loader: records calls, and only "loads" when told to succeed. */
function makeLoader(loadedFrom, {succeeds = true} = {}) {
    const calls = [];
    const load = (file) => {
        calls.push(file);
        if (succeeds) {
            loadedFrom(file);
            return Promise.resolve(file);
        }
        return Promise.reject(new Error('nope'));
    };
    return {calls, load};
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createExampleSelection', () => {
    test('starts on the placeholder when nothing has been loaded', () => {
        const loadedFrom = ko.observable('');
        const {selected} = createExampleSelection({loadedFrom, load: () => Promise.resolve()});
        expect(selected()).toBe('');
    });

    test('starts on the open example when one is already loaded', () => {
        const loadedFrom = ko.observable('RCB_binary_search.json');
        const {selected} = createExampleSelection({loadedFrom, load: () => Promise.resolve()});
        expect(selected()).toBe('RCB_binary_search.json');
    });

    test('picking an example loads it and leaves the dropdown showing it', async () => {
        const loadedFrom = ko.observable('');
        const {calls, load} = makeLoader(loadedFrom);
        const {selected} = createExampleSelection({loadedFrom, load});

        selected('RCB_bubble_sort.json');
        await settle();

        expect(calls).toEqual(['RCB_bubble_sort.json']);
        expect(selected()).toBe('RCB_bubble_sort.json');
        expect(loadedFrom()).toBe('RCB_bubble_sort.json');
    });

    test('loading does not feed back and start a second load', async () => {
        const loadedFrom = ko.observable('');
        const {calls, load} = makeLoader(loadedFrom);
        const {selected} = createExampleSelection({loadedFrom, load});

        selected('RCB_a.json');
        await settle();
        selected('RCB_b.json');
        await settle();

        expect(calls).toEqual(['RCB_a.json', 'RCB_b.json']);
        expect(selected()).toBe('RCB_b.json');
    });

    test('a cancelled or failed load puts the dropdown back on the open example', async () => {
        const loadedFrom = ko.observable('RCB_open.json');
        const {calls, load} = makeLoader(loadedFrom, {succeeds: false});
        const {selected} = createExampleSelection({loadedFrom, load});

        selected('RCB_other.json');
        await settle();

        expect(calls).toEqual(['RCB_other.json']);
        expect(selected()).toBe('RCB_open.json');
        expect(loadedFrom()).toBe('RCB_open.json');
    });

    test('a failed load with nothing open falls back to the placeholder', async () => {
        const loadedFrom = ko.observable('');
        const {load} = makeLoader(loadedFrom, {succeeds: false});
        const {selected} = createExampleSelection({loadedFrom, load});

        selected('RCB_other.json');
        await settle();

        expect(selected()).toBe('');
    });

    test('a failed load can be retried afterwards', async () => {
        const loadedFrom = ko.observable('');
        const calls = [];
        let succeed = false;
        const load = (file) => {
            calls.push(file);
            if (!succeed) {
                return Promise.reject(new Error('nope'));
            }
            loadedFrom(file);
            return Promise.resolve(file);
        };
        const {selected} = createExampleSelection({loadedFrom, load});

        selected('RCB_a.json');
        await settle();
        expect(selected()).toBe('');

        succeed = true;
        selected('RCB_a.json');
        await settle();

        expect(calls).toEqual(['RCB_a.json', 'RCB_a.json']);
        expect(selected()).toBe('RCB_a.json');
    });

    test('choosing the placeholder snaps back and loads nothing', async () => {
        const loadedFrom = ko.observable('RCB_open.json');
        const {calls, load} = makeLoader(loadedFrom);
        const {selected} = createExampleSelection({loadedFrom, load});

        selected('');
        await settle();

        expect(calls).toEqual([]);
        expect(selected()).toBe('RCB_open.json');
    });

    test('choosing the example that is already open does not reload it', async () => {
        const loadedFrom = ko.observable('RCB_open.json');
        const {calls, load} = makeLoader(loadedFrom);
        const {selected} = createExampleSelection({loadedFrom, load});

        selected('RCB_open.json');
        await settle();

        expect(calls).toEqual([]);
        expect(selected()).toBe('RCB_open.json');
    });

    test('a session loaded from disk clears the dropdown back to the placeholder', () => {
        const loadedFrom = ko.observable('RCB_open.json');
        const {selected} = createExampleSelection({loadedFrom, load: () => Promise.resolve()});

        loadedFrom('');

        expect(selected()).toBe('');
    });

    test('tolerates a loader that returns nothing', () => {
        const loadedFrom = ko.observable('');
        const calls = [];
        const {selected} = createExampleSelection({loadedFrom, load: (f) => { calls.push(f); }});

        expect(() => selected('RCB_a.json')).not.toThrow();
        expect(calls).toEqual(['RCB_a.json']);
    });
});

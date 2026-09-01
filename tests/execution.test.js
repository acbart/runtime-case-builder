/**
 * Tests for the execution.js countSteps function.
 *
 * The real Pyodide `loadPyodide` is mocked so these tests run in Node without
 * a browser or network access. The tests verify:
 *   1. The JS wrapper calls py.globals.set / py.runPythonAsync correctly.
 *   2. The result is parsed and forwarded to the `afterwards` callback.
 *   3. Edge cases (missing n, errors, output) are handled.
 */

// We need to set up the loadPyodide global mock BEFORE importing execution.js
// because execution.js calls loadPyodide() lazily but the reference is captured
// in module scope. Using jest.resetModules() and dynamic import lets us reset.

// Minimal Pyodide stub
function makePyodideMock(pythonResult) {
    return {
        globals: {
            _store: {},
            set(key, value) { this._store[key] = value; },
            get(key) { return this._store[key]; },
        },
        runPythonAsync: jest.fn(() => Promise.resolve(pythonResult)),
        runPython: jest.fn(() => null),
    };
}

describe('countSteps JS wrapper', () => {
    let countSteps;
    let pyMock;

    beforeEach(async () => {
        // Reset modules so _pyodidePromise is re-initialised
        jest.resetModules();

        // Create a fresh pyodide mock for each test
        pyMock = makePyodideMock('{}'); // default result (overridden per test)

        // Install the global loadPyodide stub
        global.loadPyodide = jest.fn(() => Promise.resolve(pyMock));

        // Re-import execution.js after setting up the global
        ({ countSteps } = await import('../src/execution.js'));
    });

    afterEach(() => {
        delete global.loadPyodide;
    });

    // ── Helper: build result JSON that Pyodide would return ──────────────────
    function makeResult(override = {}) {
        return JSON.stringify({
            n: 5,
            steps: 10,
            output: '',
            error: null,
            data: {},
            ...override,
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Pyodide bootstrap
    // ──────────────────────────────────────────────────────────────────────────

    test('loadPyodide is called exactly once even for multiple countSteps calls', async () => {
        pyMock.runPythonAsync.mockResolvedValue(makeResult());
        const cb = jest.fn();

        await countSteps('x = 1', ['n'], ['5'], cb);
        await countSteps('x = 2', ['n'], ['6'], cb);

        expect(global.loadPyodide).toHaveBeenCalledTimes(1);
    });

    // ──────────────────────────────────────────────────────────────────────────
    // globals.set usage
    // ──────────────────────────────────────────────────────────────────────────

    test('sets _rcb_init with variable assignments', async () => {
        pyMock.runPythonAsync.mockResolvedValue(makeResult());
        const cb = jest.fn();

        await countSteps('x = n + 1', ['n', 'arr'], ['10', '[1,2]'], cb);

        const init = pyMock.globals._store['_rcb_init'];
        expect(init).toContain('n = 10');
        expect(init).toContain('arr = [1,2]');
    });

    test('sets _rcb_user to the student code', async () => {
        pyMock.runPythonAsync.mockResolvedValue(makeResult());
        const cb = jest.fn();
        const code = 'for i in range(n): pass';

        await countSteps(code, ['n'], ['5'], cb);

        expect(pyMock.globals._store['_rcb_user']).toBe(code);
    });

    test('sets _rcb_vars to the variable names array', async () => {
        pyMock.runPythonAsync.mockResolvedValue(makeResult());
        const cb = jest.fn();

        await countSteps('x = 1', ['n', 'array'], ['5', '[1]'], cb);

        const vars = pyMock.globals._store['_rcb_vars'];
        expect(vars).toEqual(['n', 'array']);
    });

    test('init code includes from-random-import and import-math', async () => {
        pyMock.runPythonAsync.mockResolvedValue(makeResult());
        const cb = jest.fn();

        await countSteps('x = 1', ['n'], ['5'], cb);

        const init = pyMock.globals._store['_rcb_init'];
        expect(init).toContain('from random import *');
        expect(init).toContain('import math');
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Callback forwarding
    // ──────────────────────────────────────────────────────────────────────────

    test('afterwards callback receives n, steps, output, error, data', async () => {
        pyMock.runPythonAsync.mockResolvedValue(
            makeResult({ n: 7, steps: 21, output: 'hello\n', error: null, data: { n: '7' } })
        );
        const cb = jest.fn();

        await countSteps('x = 1', ['n'], ['7'], cb);

        expect(cb).toHaveBeenCalledWith(7, 21, 'hello\n', null, { n: '7' });
    });

    test('afterwards receives error string when error is present', async () => {
        pyMock.runPythonAsync.mockResolvedValue(
            makeResult({ n: 5, steps: 0, output: '', error: 'NameError: x', data: {} })
        );
        const cb = jest.fn();

        await countSteps('x = undefined', ['n'], ['5'], cb);

        expect(cb).toHaveBeenCalledWith(5, 0, '', 'NameError: x', {});
    });

    test('when n is null, afterwards is called with (0, null, output, message, data)', async () => {
        pyMock.runPythonAsync.mockResolvedValue(
            makeResult({ n: null, steps: 1, output: '', error: null, data: {} })
        );
        const cb = jest.fn();

        await countSteps('x = 1', ['x'], ['1'], cb);

        expect(cb).toHaveBeenCalledTimes(1);
        const [nArg, stepsArg, , errArg] = cb.mock.calls[0];
        expect(nArg).toBe(0);
        expect(stepsArg).toBeNull();
        expect(errArg).toContain('n was not defined');
    });

    // ──────────────────────────────────────────────────────────────────────────
    // Error handling
    // ──────────────────────────────────────────────────────────────────────────

    test('JS-level error from runPythonAsync is caught and forwarded', async () => {
        pyMock.runPythonAsync.mockRejectedValue(new Error('Pyodide crashed'));
        const cb = jest.fn();

        await countSteps('bad code', ['n'], ['5'], cb);

        expect(cb).toHaveBeenCalledTimes(1);
        const [nArg, , , errArg] = cb.mock.calls[0];
        expect(nArg).toBe(0);
        expect(errArg).toContain('Pyodide crashed');
    });

    test('returns the promise from getPyodide chain', async () => {
        pyMock.runPythonAsync.mockResolvedValue(makeResult());
        const cb = jest.fn();

        const result = countSteps('x = 1', ['n'], ['5'], cb);
        expect(result).toBeInstanceOf(Promise);
        await result;
        expect(cb).toHaveBeenCalledTimes(1);
    });
});

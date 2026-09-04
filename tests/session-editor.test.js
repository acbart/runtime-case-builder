/**
 * Integration smoke test: the real <session-editor> component (src/models.js)
 * renders the <example-picker> inside its Controls box, wired to $root.
 *
 * execution.js (Pyodide) is mocked. The codemirror/sortable custom bindings are
 * not registered here; Knockout ignores bindings it has no handler for.
 */
jest.mock('../src/execution.js', () => ({
    countSteps: jest.fn(),
}));

import ko from 'knockout';
import {Session} from '../src/models.js';
import '../src/example-picker.js';
import {STARTER_SESSION} from '../src/starter.js';

// knockout-sortable is not loaded in tests; stand in with a plain foreach over `data`
ko.bindingHandlers.sortable = {
    init: (el, va, ab, vm, ctx) => ko.bindingHandlers.foreach.init(el, () => va().data, ab, vm, ctx),
    update: (el, va, ab, vm, ctx) => ko.bindingHandlers.foreach.update(el, () => va().data, ab, vm, ctx),
};

const GROUPS = [{
    complexity: 'O(n)', label: 'O(n): Linear',
    examples: [{file: 'RCB_linear_search_best_worst.json', label: 'Linear Search', cases: ['Best', 'Worst']}],
}];

function renderEditor() {
    document.body.innerHTML = '<div id="host"><session-editor params="session: session, editingInputs: editingInputs, ' +
        'codeMirrorOptions: codeMirrorOptions, codeMirrorReadOnlyOptions: codeMirrorReadOnlyOptions"></session-editor></div>';
    const session = Session.EMPTY();
    session.fromJson(STARTER_SESSION);
    const root = {
        session,
        editingInputs: ko.observable(true),
        codeMirrorOptions: {},
        codeMirrorReadOnlyOptions: {},
        examples: ko.observableArray(GROUPS),
        selectedExample: ko.observable(''),
    };
    ko.applyBindings(root, document.getElementById('host'));
    // session-editor is not registered as synchronous; flush Knockout's deferred component load
    ko.tasks.runEarly();
    return root;
}

afterEach(() => {
    ko.cleanNode(document.getElementById('host'));
    document.body.innerHTML = '';
});

test('session editor shows the example picker bound to the root model', () => {
    const root = renderEditor();
    const select = document.getElementById('example-select');
    expect(select).not.toBeNull();
    expect(select.closest('.example-picker')).not.toBeNull();
    expect(Array.from(select.querySelectorAll('optgroup')).map((g) => g.label)).toEqual(['O(n): Linear']);

    select.value = 'RCB_linear_search_best_worst.json';
    select.dispatchEvent(new Event('change'));
    expect(root.selectedExample()).toBe('RCB_linear_search_best_worst.json');
});

test('session editor renders the starter cases', () => {
    renderEditor();
    const caseNames = Array.from(document.querySelectorAll('input[id^="caseName"]')).map((i) => i.value);
    expect(caseNames).toEqual(['Best', 'Worst']);
});

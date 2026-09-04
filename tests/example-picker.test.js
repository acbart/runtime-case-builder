/**
 * Tests for the <example-picker> Knockout component (src/example-picker.js),
 * rendered in JSDOM.
 */
import ko from 'knockout';
import '../src/example-picker.js';

const GROUPS = [
    {
        complexity: 'O(1)', label: 'O(1): Constant',
        examples: [{file: 'RCB_constant_time.json', label: 'Constant Time', cases: ['Constant']}],
    },
    {
        complexity: 'O(n)', label: 'O(n): Linear',
        examples: [
            {file: 'RCB_linear_search.json', label: 'Linear Search', cases: ['Best', 'Worst']},
            {file: 'RCB_max_list.json', label: 'Max List', cases: ['Regular']},
        ],
    },
];

function render(examples, selected = '') {
    document.body.innerHTML =
        '<div id="host"><example-picker params="examples: examples, selectedExample: selectedExample"></example-picker></div>';
    const vm = {examples: ko.observableArray(examples), selectedExample: ko.observable(selected)};
    ko.applyBindings(vm, document.getElementById('host'));
    ko.tasks.runEarly(); // flush the deferred work a browser would run before painting
    return {vm, select: document.getElementById('example-select')};
}

afterEach(() => {
    ko.cleanNode(document.getElementById('host'));
    document.body.innerHTML = '';
});

describe('<example-picker>', () => {
    test('renders one optgroup per complexity class with its examples', () => {
        const {select} = render(GROUPS);
        const groups = Array.from(select.querySelectorAll('optgroup'));
        expect(groups.map((g) => g.label)).toEqual(['O(1): Constant', 'O(n): Linear']);
        const linear = Array.from(groups[1].querySelectorAll('option'));
        expect(linear.map((o) => o.textContent)).toEqual(['Linear Search', 'Max List']);
        expect(linear.map((o) => o.value)).toEqual(['RCB_linear_search.json', 'RCB_max_list.json']);
        expect(linear[0].title).toBe('Cases: Best, Worst');
    });

    test('starts on the placeholder and is disabled until examples arrive', () => {
        const {vm, select} = render([]);
        expect(select.disabled).toBe(true);
        expect(select.value).toBe('');
        vm.examples(GROUPS);
        expect(select.disabled).toBe(false);
        expect(select.querySelectorAll('option')).toHaveLength(4);
        expect(select.value).toBe('');
    });

    test('choosing an option writes the file name to selectedExample', () => {
        const {vm, select} = render(GROUPS);
        select.value = 'RCB_max_list.json';
        select.dispatchEvent(new Event('change'));
        expect(vm.selectedExample()).toBe('RCB_max_list.json');
    });

    test('shows a preloaded example once the index arrives', () => {
        // On a ?preload= URL the session is applied before sessions/index.json loads
        const {vm, select} = render([], 'RCB_max_list.json');
        expect(select.value).toBe('');
        vm.examples(GROUPS);
        ko.tasks.runEarly(); // the value is re-applied once the options have rendered
        expect(select.value).toBe('RCB_max_list.json');
        expect(vm.selectedExample()).toBe('RCB_max_list.json');
    });

    test('keeps showing the loaded example instead of resetting to the placeholder', () => {
        const {vm, select} = render(GROUPS);
        vm.selectedExample('RCB_linear_search.json');
        expect(select.value).toBe('RCB_linear_search.json');
        expect(select.selectedOptions[0].textContent).toBe('Linear Search');
    });

    test('resetting selectedExample returns the select to the placeholder', () => {
        const {vm, select} = render(GROUPS, 'RCB_max_list.json');
        expect(select.value).toBe('RCB_max_list.json');
        vm.selectedExample('');
        expect(select.value).toBe('');
    });
});

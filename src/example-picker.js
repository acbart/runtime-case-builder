/**
 * <example-picker> component: a "Load example" dropdown whose options are
 * grouped by complexity class, and which shows the example that is open.
 * Params:
 *   examples        observableArray of {label, examples: [{file, label, cases}]}
 *   selectedExample observable holding the open example's file name ("" = none)
 */
import ko from "knockout";

/**
 * Two-way binds a <select> whose <option>s are rendered by a nested foreach.
 * The stock `value` binding cannot apply a value whose <option> does not exist
 * yet, which is the normal case here: on a ?preload= URL the session is open
 * before sessions/index.json has finished loading. So this also re-applies the
 * value once the options for that pass have rendered.
 *
 * Usage: fileSelect: {value: <observable>, options: <observableArray>}
 */
ko.bindingHandlers.fileSelect = {
    init: function (element, valueAccessor) {
        const value = valueAccessor().value;
        ko.utils.registerEventHandler(element, 'change', () => value(element.value));
    },
    update: function (element, valueAccessor) {
        const params = valueAccessor();
        const file = ko.unwrap(params.value) || "";
        ko.unwrap(params.options); // re-run whenever the option groups change
        const apply = () => {
            if (element.value !== file) {
                element.value = file;
            }
        };
        apply();
        if (element.value !== file) {
            // The options for this pass have not rendered yet; try again after they do.
            ko.tasks.schedule(apply);
        }
    }
};

const ExamplePickerHTML = `
<div class="form-inline m-2 mr-1 example-picker">
    <label for="example-select" class="mr-2 mb-0">Load example:</label>
    <select id="example-select" class="form-control" style="max-width: 100%"
        data-bind="fileSelect: {value: selectedExample, options: examples}, enable: examples().length > 0">
        <option value="">Choose an example session…</option>
        <!-- ko foreach: examples -->
        <optgroup data-bind="attr: {label: label}, foreach: examples">
            <option data-bind="text: label, attr: {value: file, title: 'Cases: ' + cases.join(', ')}"></option>
        </optgroup>
        <!-- /ko -->
    </select>
</div>
`;

ko.components.register('example-picker', {
    viewModel: function (params) {
        this.examples = params.examples;
        this.selectedExample = params.selectedExample;
    },
    template: ExamplePickerHTML,
    synchronous: true,
});

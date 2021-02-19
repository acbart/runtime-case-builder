import ko from "knockout";
import CodeMirror from 'codemirror';
import 'codemirror/mode/python/python.js';


//pythonCM.setSize(400, 150);

// Knockout codemirror binding handler
ko.bindingHandlers.codemirror = {
    init: function(element, valueAccessor) {
        let options = ko.unwrap(valueAccessor());
        element.editor = CodeMirror(element, ko.toJS(options));
        element.editor.on('change', function(cm) {
            options.value(cm.getValue());
        });
        element.editor.setSize(400, 150);

        ko.utils.domNodeDisposal.addDisposeCallback(element, function() {
            let wrapper = element.editor.getWrapperElement();
            wrapper.parentNode.removeChild(wrapper);
        });
    },
    update: function(element, valueAccessor) {
        let value = ko.toJS(valueAccessor()).value;
        if (element.editor) {
            let cur = element.editor.getCursor();
            element.editor.setValue(value);
            element.editor.setCursor(cur);
            element.editor.refresh();
        }
    }
};

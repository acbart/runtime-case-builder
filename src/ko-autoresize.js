import ko from "knockout";

var resizeToFitContent = function(el, minimum, maximum) {
    let initial = el.value.length || 1;
    el.setAttribute('size', Math.max(Math.min(maximum || 40, initial), minimum || 12));
}

ko.bindingHandlers.autoResize = {
  init: function(element, valueAccessor, allBindings, viewModel, bindingContext) {
    ko.computed(function() {
        let options = ko.utils.unwrapObservable(valueAccessor() || {});
        resizeToFitContent(element, options.minimum, options.maximum);
    })
  }
};
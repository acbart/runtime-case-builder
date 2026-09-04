/**
 * Keeps the "Load example" dropdown showing whichever session is actually open.
 *
 * The dropdown is both an input (the student picks an example) and an output (it
 * names what is loaded), so writes have to be told apart: a write we make to
 * mirror the session must not be mistaken for a pick and start another load.
 */
import ko from "knockout";

/**
 * `loadedFrom` is the session's own observable naming its source file ("" for the
 * starter or a session loaded from disk). `load(file)` performs the load and
 * returns a promise; if it rejects (the student cancelled, or the fetch failed)
 * the dropdown goes back to the session that is still open.
 *
 * Returns `{selected, reflect}`: bind `selected` to the <select>.
 */
export function createExampleSelection({loadedFrom, load}) {
    const selected = ko.observable(loadedFrom() || "");
    let reflecting = false;

    // Write to `selected` without it counting as the student picking something.
    const reflect = (file) => {
        reflecting = true;
        try {
            selected(file || "");
        } finally {
            reflecting = false;
        }
    };

    loadedFrom.subscribe(reflect);

    selected.subscribe((file) => {
        if (reflecting) {
            return;
        }
        // The placeholder, or the example already open: nothing to load, so just
        // put the dropdown back on the open session.
        if (!file || file === loadedFrom()) {
            reflect(loadedFrom());
            return;
        }
        const done = load(file);
        if (done && typeof done.then === "function") {
            done.then(null, () => reflect(loadedFrom()));
        }
    });

    return {selected, reflect};
}

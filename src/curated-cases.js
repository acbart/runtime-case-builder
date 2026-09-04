/**
 * Best and worst case inputs that demonstrate the answer to a particular problem,
 * for an instructor working through it in front of a class.
 *
 * Unlike the type-based suggestions in suggested-inputs.js, these are written by
 * hand against each algorithm: the inputs are chosen so that running both cases
 * shows the real difference between them, or shows that there is no difference.
 * Sizes double so the shape of the growth is visible on the plot.
 *
 * To add a problem, key an entry by its file in sessions/ and give one entry per
 * case, with a generator per input size. Each generator holds one code string per
 * declared input, in the order the session declares them.
 */

export const BEST_COLOR = "#00AA00";
export const WORST_COLOR = "#FF0000";

const SIZES = [10, 20, 40, 80];
const ODD_SIZES = [11, 21, 41, 81];

/** A generator per size, where the size is the first input (`n`) and `rest` follows. */
const bySize = (sizes, ...rest) => sizes.map((size) => [String(size), ...rest]);

/** A generator per size for sessions whose first input is the list itself. */
const byArray = (target) => SIZES.map((size) => [`list(range(${size}))`, "len(array)", target]);

export const CURATED_CASES = {
    "RCB_lesson_4_question_1.json": {
        title: "Lesson 4 Question 1",
        note: "There are no loops here, so the work never depends on n. Both cases are the same flat line.",
        cases: [
            {name: "Best", color: BEST_COLOR, generators: bySize(SIZES)},
            {name: "Worst", color: WORST_COLOR, generators: bySize(SIZES)},
        ],
    },

    "RCB_lesson_4_question_2.json": {
        title: "Lesson 4 Question 2",
        note: "The loop always runs n times; only its body depends on the values. All odd numbers never enter it, all even numbers always do.",
        cases: [
            // Every value odd, so the if body never runs
            {name: "Best", color: BEST_COLOR, generators: bySize(SIZES, "[1] * n")},
            // Every value even, so the if body runs on every pass
            {name: "Worst", color: WORST_COLOR, generators: bySize(SIZES, "[2] * n")},
        ],
    },

    "RCB_lesson_4_question_3.json": {
        title: "Lesson 4 Question 3",
        note: "An even n skips the loop entirely and an odd n runs it n times, so the best case is flat and the worst case is linear.",
        cases: [
            // Even n: the guard is false and the loop never runs
            {name: "Best", color: BEST_COLOR, generators: bySize(SIZES, "[1] * n")},
            // Odd n: the guard is true and the loop walks the whole list
            {name: "Worst", color: WORST_COLOR, generators: bySize(ODD_SIZES, "[1] * n")},
        ],
    },

    "RCB_lesson_4_question_4.json": {
        title: "Lesson 4 Question 4",
        note: "The inner loop runs i times for each i, so the work is quadratic for every input. Both cases match.",
        cases: [
            {name: "Best", color: BEST_COLOR, generators: bySize(SIZES)},
            {name: "Worst", color: WORST_COLOR, generators: bySize(SIZES)},
        ],
    },

    "RCB_lesson_4_question_5.json": {
        title: "Lesson 4 Question 5",
        note: "The inner loop always runs ten times, so the work is linear for every input. Both cases match.",
        cases: [
            {name: "Best", color: BEST_COLOR, generators: bySize(SIZES)},
            {name: "Worst", color: WORST_COLOR, generators: bySize(SIZES)},
        ],
    },

    "RCB_lesson_4_question_6.json": {
        title: "Lesson 4 Question 6",
        note: "A negative number at the front breaks out on the first pass; a list with no negatives at all is searched to the end.",
        cases: [
            // The first value is negative, so the loop breaks immediately
            {name: "Best", color: BEST_COLOR, generators: bySize(SIZES, "[-1] + [1] * (n - 1)")},
            // No negatives anywhere, so the loop never breaks early
            {name: "Worst", color: WORST_COLOR, generators: bySize(SIZES, "[1] * n")},
        ],
    },

    "RCB_find_with_break.json": {
        title: "Find with Break",
        note: "Finding k at the front breaks out on the first pass; a k that is not in the list is searched to the end.",
        cases: [
            // k is the first item in the list
            {name: "Best", color: BEST_COLOR, generators: byArray("0")},
            // k is not in the list at all
            {name: "Worst", color: WORST_COLOR, generators: byArray("-1")},
        ],
    },
};

/**
 * The curated entry for a session, by its file in sessions/ or, for a session
 * loaded from disk, by an unambiguous title. Null when there is nothing curated,
 * in which case the type-based suggestions apply instead.
 */
export function findCuratedCases(file, title) {
    if (file && Object.prototype.hasOwnProperty.call(CURATED_CASES, file)) {
        return CURATED_CASES[file];
    }
    if (title) {
        const wanted = String(title).trim();
        const matches = Object.keys(CURATED_CASES)
            .map((key) => CURATED_CASES[key])
            .filter((entry) => entry.title === wanted);
        if (matches.length === 1) {
            return matches[0];
        }
    }
    return null;
}

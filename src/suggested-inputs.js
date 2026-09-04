/**
 * Fallback input generators for a problem with no curated cases of its own.
 *
 * The sizes double so growth shows up on the plot. The snippets come from each
 * input's declared type, which is all this file can know: what makes a case the
 * best or the worst one for a particular algorithm depends on the algorithm, so
 * these are a running start to edit rather than an answer. Problems that do have
 * an answer worth showing get hand-written inputs in curated-cases.js instead.
 *
 * The values are deterministic, so re-running a case plots the same point twice
 * instead of scattering it.
 */
import ko from "knockout";

/** Input sizes to suggest, matching the built-in starter session. */
export const SWEEP_SIZES = [10, 20, 40, 80];

/** The input whose value is plotted on the x axis, by long-standing convention. */
export const SIZE_INPUT_NAME = "n";

/**
 * A Python snippet producing a value of `type`, sized by the expression `size`
 * (either a literal number or the name of an input already assigned above).
 * `count` is that size as a number, for the types that need a plain value.
 * An unrecognised type gets an empty snippet for the student to fill in.
 */
export function snippetFor(type, size, count = 10) {
    const normalized = String(type === undefined || type === null ? "" : type)
        .toLowerCase().replace(/\s+/g, "");
    const middle = String(Math.max(1, Math.floor(Number(count) / 2) || 1));
    switch (normalized) {
        case "int": return middle;
        case "float": return "1.5";
        case "bool": return "True";
        case "str": return `'a' * ${size}`;
        case "list":
        case "list[int]": return `list(range(${size}))`;
        case "list[float]": return `[i / 2 for i in range(${size})]`;
        case "list[bool]": return `[True] * ${size}`;
        case "list[str]": return `['a'] * ${size}`;
        case "list[list[int]]": return `[list(range(${size})) for i in range(${size})]`;
        case "set":
        case "set[int]": return `set(range(${size}))`;
        case "set[float]": return `{i / 2 for i in range(${size})}`;
        case "set[str]": return `{chr(97 + i % 26) for i in range(${size})}`;
        case "set[bool]": return "{True, False}";
        default: return "";
    }
}

const nameOf = (input) => String(ko.unwrap(input.name) || "");
const typeOf = (input) => ko.unwrap(input.type);

/**
 * One generator's worth of code, one entry per input, for a single size.
 *
 * Inputs are assigned in order before the algorithm runs, so a snippet may only
 * refer to `n` when the input named `n` comes before it; otherwise the size is
 * written out as a literal.
 */
export function suggestGenerator(inputs, size) {
    const sizeIndex = inputs.findIndex((input) => nameOf(input) === SIZE_INPUT_NAME);
    return inputs.map((input, index) => {
        if (index === sizeIndex) {
            return String(size);
        }
        const sizeExpression = sizeIndex >= 0 && sizeIndex < index ? SIZE_INPUT_NAME : String(size);
        return snippetFor(typeOf(input), sizeExpression, size);
    });
}

/** A generator per size, each holding one code entry per input. */
export function suggestGenerators(inputs, sizes = SWEEP_SIZES) {
    return sizes.map((size) => suggestGenerator(inputs, size));
}

# runtime-case-builder
Build up a "case" for the runtime of your python algorithm!

## Getting started

```
npm install
npm run watch     # dev server
npm run build     # production bundle in dist/
npm test          # Jest tests
```

The page opens with a **Linear Search** starter session that already has a Best case
(target at the front) and a Worst case (target absent) at n = 10, 20, 40, 80. Press
**Run entire case** on each to see a flat line and a growing line on the plot.

## Filling in example inputs

Some sessions, the lesson questions in particular, arrive with a Best and a Worst
case and nothing in them. Pressing <kbd>Ctrl</kbd>+<kbd>I</kbd> twice fills every
empty case with inputs to run, so a question can be demonstrated in front of a
class in a couple of keystrokes. The first press only offers, so a stray keystroke
changes nothing, and the second press never runs anything: the Run buttons are
still yours to press. Cases that already have inputs are left alone.

For a problem listed in [src/curated-cases.js](src/curated-cases.js), the inputs
are written by hand against that algorithm and really are its best and worst
cases, with a line saying what they show. Running both cases then demonstrates the
answer:

| Question | Best | Worst |
| --- | --- | --- |
| Lesson 4 Question 2 | all odd, the if body never runs | all even, it always runs |
| Lesson 4 Question 3 | even n skips the loop, flat | odd n runs it, linear |
| Lesson 4 Question 6 | a negative at the front, breaks out at once | no negatives, searched to the end |
| Lesson 4 Questions 1, 4, 5 | both cases the same, because the runtime cannot vary | |

Because those answers ship in the page, a determined student could dig them out of
the bundle. They are not in the session files themselves.

Any other problem falls back to a spread of sizes at n = 10, 20, 40, 80 built from
each input's declared type. Those cannot know what makes a case best or worst for
an unfamiliar algorithm, so both cases get the same inputs to edit. The values are
deterministic either way, so re-running a case plots the same point rather than
scattering it.

To curate a new problem, add an entry to `src/curated-cases.js` keyed by its file
in `sessions/`, with one generator row per input size and one code string per
declared input. The tests check every entry against the session it names.

## Example sessions

Curated sessions live in [sessions/](sessions/). They can be opened in two ways:

- Use the **Load example** dropdown in the Controls box. It is grouped by complexity
  class, names whichever example is currently open, and updates the page URL so the
  link can be shared.
- Open the page with `?preload=RCB_binary_search.json` (any file name from `sessions/`).

### Adding an example

1. Build your session in the app and press **Save JSON**.
2. Drop the file into `sessions/` (keep the `RCB_` prefix).
3. Add a top-level `"complexity"` field with the worst-case class so it lands in the
   right dropdown group. Recognised values, in the order they are shown:
   `O(1)`, `O(log n)`, `O(n)`, `O(n log n)`, `O(n²)`, `O(n³)`, `O(2ⁿ)`.
   Anything else is listed under "Other".

### Adding course material

Sessions that are exercises rather than gallery examples take a top-level
`"collection"` field instead, for example `"collection": "Lesson 4"`. Each
collection becomes its own dropdown group, listed after the complexity classes,
and its sessions are left out of the complexity groups. Give these no
`"complexity"` field: `sessions/` is served to the browser, and naming the
runtime is the exercise.

`sessions/index.json` is generated at build time by
[scripts/session-index.js](scripts/session-index.js) (a small webpack plugin), so
no manual index maintenance is needed. The Jest suite checks that every shipped
session declares a recognised complexity class.

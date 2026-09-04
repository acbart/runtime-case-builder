/**
 * Tests for src/curated-cases.js: the hand-written best and worst case inputs an
 * instructor uses to show a problem's answer.
 *
 * These check the curated entries against the real session files, so an entry
 * cannot drift away from the problem it belongs to.
 */
const fs = require('fs');
const path = require('path');

import {CURATED_CASES, findCuratedCases, BEST_COLOR, WORST_COLOR} from '../src/curated-cases.js';

const SESSIONS_DIR = path.resolve(__dirname, '..', 'sessions');
const FILES = Object.keys(CURATED_CASES);
const read = (file) => JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf8'));

describe('every curated entry', () => {
    test.each(FILES)('%s names a session that exists', (file) => {
        expect(fs.existsSync(path.join(SESSIONS_DIR, file))).toBe(true);
    });

    test.each(FILES)('%s matches that session title', (file) => {
        expect(CURATED_CASES[file].title).toBe(read(file).title);
    });

    test.each(FILES)('%s gives one code entry per declared input', (file) => {
        const inputCount = read(file).inputs.length;
        CURATED_CASES[file].cases.forEach((aCase) => {
            expect(aCase.generators.length).toBeGreaterThan(0);
            aCase.generators.forEach((row) => {
                expect(row).toHaveLength(inputCount);
                row.forEach((snippet) => expect(typeof snippet).toBe('string'));
                row.forEach((snippet) => expect(snippet.trim()).not.toBe(''));
            });
        });
    });

    test.each(FILES)('%s offers a best and a worst case', (file) => {
        const names = CURATED_CASES[file].cases.map((c) => c.name);
        expect(names).toEqual(['Best', 'Worst']);
        const colors = CURATED_CASES[file].cases.map((c) => c.color);
        expect(colors).toEqual([BEST_COLOR, WORST_COLOR]);
    });

    test.each(FILES)('%s says what its inputs are meant to show', (file) => {
        expect(CURATED_CASES[file].note.length).toBeGreaterThan(20);
    });

    test.each(FILES)('%s sweeps four sizes so growth is visible', (file) => {
        CURATED_CASES[file].cases.forEach((aCase) => {
            expect(aCase.generators).toHaveLength(4);
        });
    });

    test.each(FILES)('%s only names cases the session already has, or adds a missing one', (file) => {
        const existing = read(file).cases.map((c) => c.name);
        const curated = CURATED_CASES[file].cases.map((c) => c.name);
        // Every case the session ships with must be covered, so none is left empty
        existing.forEach((name) => expect(curated).toContain(name));
    });

    test.each(FILES)('%s arrives with empty cases, which is when the fill applies', (file) => {
        read(file).cases.forEach((c) => expect(c.generators || []).toHaveLength(0));
    });
});

describe('the sizes each case sweeps', () => {
    test('vary n itself only where n decides the work', () => {
        // Question 3 branches on whether n is odd, so the worst case needs odd sizes
        const q3 = CURATED_CASES['RCB_lesson_4_question_3.json'];
        const sizeOf = (name) => q3.cases.find((c) => c.name === name).generators.map((row) => row[0]);
        expect(sizeOf('Best')).toEqual(['10', '20', '40', '80']);
        expect(sizeOf('Worst')).toEqual(['11', '21', '41', '81']);
    });

    test('are the same for both cases where the runtime cannot vary', () => {
        ['RCB_lesson_4_question_1.json', 'RCB_lesson_4_question_4.json', 'RCB_lesson_4_question_5.json']
            .forEach((file) => {
                const [best, worst] = CURATED_CASES[file].cases;
                expect(best.generators).toEqual(worst.generators);
            });
    });

    test('differ between the cases where the runtime does vary', () => {
        ['RCB_lesson_4_question_2.json', 'RCB_lesson_4_question_3.json',
            'RCB_lesson_4_question_6.json', 'RCB_find_with_break.json']
            .forEach((file) => {
                const [best, worst] = CURATED_CASES[file].cases;
                expect(best.generators).not.toEqual(worst.generators);
            });
    });
});

describe('findCuratedCases', () => {
    test('finds an entry by its session file', () => {
        expect(findCuratedCases('RCB_lesson_4_question_1.json').title).toBe('Lesson 4 Question 1');
    });

    test('finds an entry by title when the session came from disk', () => {
        expect(findCuratedCases('', 'Lesson 4 Question 5').title).toBe('Lesson 4 Question 5');
        expect(findCuratedCases(undefined, '  Lesson 4 Question 5  ').title).toBe('Lesson 4 Question 5');
    });

    test('prefers the file over the title', () => {
        expect(findCuratedCases('RCB_lesson_4_question_1.json', 'Lesson 4 Question 5').title)
            .toBe('Lesson 4 Question 1');
    });

    test('returns nothing for a problem with no entry', () => {
        expect(findCuratedCases('RCB_merge_sort.json')).toBeNull();
        expect(findCuratedCases('', 'Merge Sort')).toBeNull();
        expect(findCuratedCases()).toBeNull();
    });

    test('is not fooled by inherited object properties', () => {
        expect(findCuratedCases('constructor')).toBeNull();
        expect(findCuratedCases('toString')).toBeNull();
    });
});

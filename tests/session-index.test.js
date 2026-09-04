/**
 * Tests for scripts/session-index.js: the build-time index of curated example
 * sessions that powers the "Load example" dropdown.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    COMPLEXITY_CLASSES, OTHER_CLASS, compareLabels, readSessions, buildSessionIndex,
} = require('../scripts/session-index.js');

const SESSIONS_DIR = path.resolve(__dirname, '..', 'sessions');
const KNOWN = COMPLEXITY_CLASSES.map((c) => c.complexity);

function tempDirWith(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rcb-sessions-'));
    Object.entries(files).forEach(([name, contents]) => {
        fs.writeFileSync(path.join(dir, name),
            typeof contents === 'string' ? contents : JSON.stringify(contents));
    });
    return dir;
}

describe('buildSessionIndex on the shipped sessions/', () => {
    const index = buildSessionIndex(SESSIONS_DIR);
    const shipped = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.json'));
    const indexed = index.groups.flatMap((g) => g.examples);
    const complexityGroups = index.groups.filter((g) => g.kind === 'complexity');
    const collectionGroups = index.groups.filter((g) => g.kind === 'collection');

    test('includes every shipped session exactly once', () => {
        expect(index.count).toBe(shipped.length);
        expect(indexed.map((e) => e.file).sort()).toEqual(shipped.sort());
    });

    test('every gallery session declares a recognised complexity class', () => {
        const gallery = indexed.filter((e) => !e.collection);
        const other = gallery.filter((e) => e.complexity === OTHER_CLASS.complexity);
        expect(other.map((e) => e.file)).toEqual([]);
        complexityGroups.forEach((g) => expect(KNOWN).toContain(g.complexity));
    });

    test('complexity groups come first, in order, and are non-empty', () => {
        const kinds = index.groups.map((g) => g.kind);
        const firstCollection = kinds.indexOf('collection');
        expect(kinds.slice(0, firstCollection).every((k) => k === 'complexity')).toBe(true);
        expect(kinds.slice(firstCollection).every((k) => k === 'collection')).toBe(true);
        const ranks = complexityGroups.map((g) => KNOWN.indexOf(g.complexity));
        expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
        index.groups.forEach((g) => expect(g.examples.length).toBeGreaterThan(0));
    });

    test('covers constant through exponential classes', () => {
        const present = complexityGroups.map((g) => g.complexity);
        ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)', 'O(n²)', 'O(n³)', 'O(2ⁿ)']
            .forEach((c) => expect(present).toContain(c));
    });

    test('the Lesson 4 questions are their own group, in question order', () => {
        expect(collectionGroups.map((g) => g.label)).toEqual(['Lesson 4']);
        const lesson = collectionGroups[0];
        expect(lesson.collection).toBe('Lesson 4');
        expect(lesson.examples.map((e) => e.label)).toEqual([
            'Lesson 4 Question 1', 'Lesson 4 Question 2', 'Lesson 4 Question 3',
            'Lesson 4 Question 4', 'Lesson 4 Question 5', 'Lesson 4 Question 6',
        ]);
    });

    test('no lesson session is also listed under a complexity class', () => {
        const inComplexity = complexityGroups.flatMap((g) => g.examples.map((e) => e.file));
        expect(inComplexity.filter((f) => f.includes('lesson'))).toEqual([]);
    });

    test('lesson sessions ship no complexity answer key', () => {
        fs.readdirSync(SESSIONS_DIR)
            .filter((f) => f.includes('lesson'))
            .forEach((f) => {
                const data = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf8'));
                expect(data.collection).toBe('Lesson 4');
                expect(data.complexity).toBeUndefined();
            });
    });

    test('entries carry title, label, and case names', () => {
        const binary = indexed.find((e) => e.file === 'RCB_binary_search.json');
        expect(binary.title).toBe('Binary Search');
        expect(binary.label).toBe('Binary Search');
        expect(binary.complexity).toBe('O(log n)');
        expect(binary.collection).toBeNull();
        expect(binary.cases).toEqual(['Found (best/avg case)', 'Not Found (worst case)']);
    });

    test('labels are unique even when titles repeat', () => {
        const labels = indexed.map((e) => e.label);
        expect(new Set(labels).size).toBe(labels.length);
        const variants = indexed.filter((e) => e.title === 'Find with Break');
        expect(variants.length).toBeGreaterThan(1);
        variants.forEach((e) => expect(e.label).toMatch(/^Find with Break \(find_with_break/));
    });

    test('examples within a group are sorted by label', () => {
        index.groups.forEach((g) => {
            const labels = g.examples.map((e) => e.label);
            expect(labels).toEqual([...labels].sort(compareLabels));
        });
    });
});

describe('readSessions / buildSessionIndex on synthetic directories', () => {
    test('sessions without a recognised complexity fall into Other, after the classes', () => {
        const dir = tempDirWith({
            'RCB_a.json': {title: 'A', complexity: 'O(n)', cases: [{name: 'Worst'}]},
            'RCB_b.json': {title: 'B', cases: []},
            'RCB_c.json': {title: 'C', complexity: 'O(n!)', cases: []},
        });
        const index = buildSessionIndex(dir);
        expect(index.count).toBe(3);
        expect(index.groups.map((g) => g.complexity)).toEqual(['O(n)', 'Other']);
        expect(index.groups[1].examples.map((e) => e.file)).toEqual(['RCB_b.json', 'RCB_c.json']);
    });

    test('collections become their own groups, alphabetical, after the classes', () => {
        const dir = tempDirWith({
            'RCB_a.json': {title: 'A', complexity: 'O(n)', cases: []},
            'RCB_l1.json': {title: 'L1', collection: 'Lesson 9', cases: []},
            'RCB_l2.json': {title: 'L2', collection: 'Lesson 10', cases: []},
            'RCB_h.json': {title: 'H', collection: 'Homework', cases: []},
        });
        const index = buildSessionIndex(dir);
        expect(index.groups.map((g) => [g.kind, g.label])).toEqual([
            ['complexity', 'O(n): Linear'],
            ['collection', 'Homework'],
            ['collection', 'Lesson 9'],
            ['collection', 'Lesson 10'],
        ]);
    });

    test('a collection wins over any complexity the session also declares', () => {
        const dir = tempDirWith({
            'RCB_x.json': {title: 'X', complexity: 'O(n)', collection: 'Lesson 4', cases: []},
        });
        const index = buildSessionIndex(dir);
        expect(index.groups.map((g) => g.kind)).toEqual(['collection']);
        expect(index.groups[0].examples[0].complexity).toBe('O(n)');
    });

    test('a blank collection is treated as no collection', () => {
        const dir = tempDirWith({'RCB_x.json': {title: 'X', complexity: 'O(n)', collection: '   ', cases: []}});
        expect(readSessions(dir)[0].collection).toBeNull();
        expect(buildSessionIndex(dir).groups[0].kind).toBe('complexity');
    });

    test('falls back to the file stem when a title is missing', () => {
        const dir = tempDirWith({'RCB_no_title.json': {cases: []}});
        expect(readSessions(dir)[0].title).toBe('no_title');
    });

    test('ignores non-JSON files and a stray index.json', () => {
        const dir = tempDirWith({
            'RCB_a.json': {title: 'A', complexity: 'O(1)', cases: []},
            'index.json': {groups: []},
            'notes.txt': 'hello',
        });
        expect(readSessions(dir).map((e) => e.file)).toEqual(['RCB_a.json']);
    });

    test('throws naming the broken file when JSON is invalid', () => {
        const dir = tempDirWith({'RCB_broken.json': '{not json'});
        expect(() => buildSessionIndex(dir)).toThrow(/RCB_broken\.json/);
    });
});

describe('compareLabels', () => {
    test('orders numbered labels the way a reader expects', () => {
        const labels = ['Question 10', 'Question 2', 'Question 1'];
        expect([...labels].sort(compareLabels)).toEqual(['Question 1', 'Question 2', 'Question 10']);
    });
});

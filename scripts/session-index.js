'use strict';
/**
 * Builds an index of the curated example sessions in `sessions/`, grouped by
 * complexity class, so the app can offer a "Load example" dropdown.
 *
 * Each session JSON may carry a top-level `"complexity"` string such as
 * "O(n)" (see COMPLEXITY_CLASSES). Sessions without a recognised value are
 * grouped under "Other". Classification is by the worst case in the session.
 *
 * A session may instead carry a top-level `"collection"` string (for example
 * "Lesson 4"). Collections are course material rather than gallery examples, so
 * they get their own group, listed after the complexity classes, and they are
 * never filed under a complexity class: naming the runtime of a lesson question
 * is the exercise.
 *
 * Exports a pure builder (unit tested) and a small webpack plugin that emits
 * `sessions/index.json` next to the copied session files at build time.
 */
const fs = require('fs');
const path = require('path');

const PLUGIN_NAME = 'SessionIndexPlugin';

/** Ordered list of recognised complexity classes and their dropdown labels. */
const COMPLEXITY_CLASSES = [
    {complexity: 'O(1)', label: 'O(1): Constant'},
    {complexity: 'O(log n)', label: 'O(log n): Logarithmic'},
    {complexity: 'O(n)', label: 'O(n): Linear'},
    {complexity: 'O(n log n)', label: 'O(n log n): Linearithmic'},
    {complexity: 'O(n²)', label: 'O(n²): Quadratic'},
    {complexity: 'O(n³)', label: 'O(n³): Cubic'},
    {complexity: 'O(2ⁿ)', label: 'O(2ⁿ): Exponential'},
];
const OTHER_CLASS = {complexity: 'Other', label: 'Other'};

function fileStem(file) {
    return path.basename(file, '.json').replace(/^RCB_/, '');
}

/** Compares labels the way a reader expects, so "Question 10" follows "Question 9". */
function compareLabels(left, right) {
    return String(left).localeCompare(String(right), undefined, {numeric: true});
}

/**
 * Reads every `*.json` session in the directory and returns a flat list of
 * `{file, title, label, complexity, collection, cases}` entries, sorted by label.
 * `collection` is null for ordinary gallery examples.
 * Throws with the offending filename if a session is not valid JSON.
 */
function readSessions(sessionsDir) {
    const files = fs.readdirSync(sessionsDir)
        .filter((f) => f.toLowerCase().endsWith('.json') && f !== 'index.json')
        .sort();
    const entries = files.map((file) => {
        let data;
        try {
            data = JSON.parse(fs.readFileSync(path.join(sessionsDir, file), 'utf8'));
        } catch (e) {
            throw new Error(`Session file ${file} is not valid JSON: ${e.message}`);
        }
        const known = COMPLEXITY_CLASSES.some((c) => c.complexity === data.complexity);
        const collection = typeof data.collection === 'string' && data.collection.trim()
            ? data.collection.trim() : null;
        return {
            file,
            title: (data.title && String(data.title).trim()) || fileStem(file),
            complexity: known ? data.complexity : OTHER_CLASS.complexity,
            collection,
            cases: (data.cases || []).map((c) => c.name),
        };
    });
    // Several sessions can share a title; disambiguate their labels with the file stem.
    const titleCounts = {};
    entries.forEach((e) => { titleCounts[e.title] = (titleCounts[e.title] || 0) + 1; });
    entries.forEach((e) => {
        e.label = titleCounts[e.title] > 1 ? `${e.title} (${fileStem(e.file)})` : e.title;
    });
    entries.sort((l, r) => compareLabels(l.label, r.label) || compareLabels(l.file, r.file));
    return entries;
}

/**
 * Returns `{count, groups}`. Non-empty complexity groups come first, in
 * complexity order, holding every session that is not part of a collection.
 * Named collections follow, one group each, in alphabetical order. Each group is
 * `{kind, label, complexity?, collection?, examples: [...]}`.
 */
function buildSessionIndex(sessionsDir) {
    const entries = readSessions(sessionsDir);
    const gallery = entries.filter((e) => !e.collection);
    const complexityGroups = COMPLEXITY_CLASSES.concat([OTHER_CLASS])
        .map((cls) => ({
            kind: 'complexity',
            complexity: cls.complexity,
            label: cls.label,
            examples: gallery.filter((e) => e.complexity === cls.complexity),
        }))
        .filter((g) => g.examples.length > 0);
    const collectionNames = [...new Set(entries.map((e) => e.collection).filter(Boolean))]
        .sort(compareLabels);
    const collectionGroups = collectionNames.map((name) => ({
        kind: 'collection',
        collection: name,
        label: name,
        examples: entries.filter((e) => e.collection === name),
    }));
    return {count: entries.length, groups: complexityGroups.concat(collectionGroups)};
}

/**
 * Webpack plugin: emits the index as an asset (default `sessions/index.json`)
 * and registers the sessions directory as a context dependency so watch mode
 * rebuilds when a session is added or edited.
 */
class SessionIndexPlugin {
    constructor(options = {}) {
        this.sessionsDir = path.resolve(options.sessionsDir || 'sessions');
        this.filename = options.filename || 'sessions/index.json';
    }

    apply(compiler) {
        const {RawSource} = compiler.webpack.sources;
        const {Compilation} = compiler.webpack;
        compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
            compilation.contextDependencies.add(this.sessionsDir);
            compilation.hooks.processAssets.tap(
                {name: PLUGIN_NAME, stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL},
                () => {
                    const index = buildSessionIndex(this.sessionsDir);
                    compilation.emitAsset(this.filename, new RawSource(JSON.stringify(index, null, 2)));
                }
            );
        });
    }
}

module.exports = {
    COMPLEXITY_CLASSES, OTHER_CLASS, compareLabels, readSessions, buildSessionIndex, SessionIndexPlugin,
};

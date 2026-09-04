/**
 * Tests for src/shortcut.js: matching the Ctrl+I keystroke and the two-step
 * gesture that only acts on the second press.
 */
import {ARM_TIMEOUT_MS, FILL_SHORTCUT, createDoublePress, isFillShortcut} from '../src/shortcut.js';

const key = (over = {}) => ({ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, key: 'i', ...over});

describe('isFillShortcut', () => {
    test('matches Ctrl+I and Cmd+I', () => {
        expect(isFillShortcut(key({ctrlKey: true}))).toBe(true);
        expect(isFillShortcut(key({metaKey: true}))).toBe(true);
    });

    test('matches whatever case the key arrives in', () => {
        expect(isFillShortcut(key({ctrlKey: true, key: 'I'}))).toBe(true);
    });

    test('ignores the letter on its own and other letters', () => {
        expect(isFillShortcut(key())).toBe(false);
        expect(isFillShortcut(key({ctrlKey: true, key: 'k'}))).toBe(false);
    });

    test('ignores it when another modifier is held', () => {
        expect(isFillShortcut(key({ctrlKey: true, shiftKey: true}))).toBe(false);
        expect(isFillShortcut(key({ctrlKey: true, altKey: true}))).toBe(false);
    });

    test('survives an event with no key', () => {
        expect(isFillShortcut({ctrlKey: true})).toBe(false);
        expect(isFillShortcut(null)).toBe(false);
    });

    test('the label says what to press', () => {
        expect(FILL_SHORTCUT).toBe('Ctrl+I');
    });
});

describe('createDoublePress', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    function make(overrides = {}) {
        const calls = {armed: 0, fired: 0, expired: 0};
        const press = createDoublePress({
            onArm: () => calls.armed++,
            onFire: () => calls.fired++,
            onExpire: () => calls.expired++,
            ...overrides,
        });
        return {calls, press};
    }

    test('the first press only arms, the second fires', () => {
        const {calls, press} = make();

        expect(press.press()).toBe('armed');
        expect(calls).toEqual({armed: 1, fired: 0, expired: 0});
        expect(press.isArmed()).toBe(true);

        expect(press.press()).toBe('fired');
        expect(calls).toEqual({armed: 1, fired: 1, expired: 0});
        expect(press.isArmed()).toBe(false);
    });

    test('a single press does nothing once the window passes', () => {
        const {calls, press} = make();

        press.press();
        jest.advanceTimersByTime(ARM_TIMEOUT_MS + 1);

        expect(calls).toEqual({armed: 1, fired: 0, expired: 1});
        expect(press.isArmed()).toBe(false);
    });

    test('a press after the window arms again instead of firing', () => {
        const {calls, press} = make();

        press.press();
        jest.advanceTimersByTime(ARM_TIMEOUT_MS + 1);
        expect(press.press()).toBe('armed');

        expect(calls.fired).toBe(0);
        expect(calls.armed).toBe(2);
    });

    test('firing does not leave a timer that expires later', () => {
        const {calls, press} = make();

        press.press();
        press.press();
        jest.advanceTimersByTime(ARM_TIMEOUT_MS * 2);

        expect(calls).toEqual({armed: 1, fired: 1, expired: 0});
    });

    test('two full uses in a row each need two presses', () => {
        const {calls, press} = make();

        press.press();
        press.press();
        press.press();
        expect(calls.fired).toBe(1);
        press.press();
        expect(calls.fired).toBe(2);
        expect(calls.armed).toBe(2);
    });

    test('cancel forgets a first press', () => {
        const {calls, press} = make();

        press.press();
        press.cancel();
        expect(press.isArmed()).toBe(false);

        expect(press.press()).toBe('armed');
        expect(calls.fired).toBe(0);
    });

    test('the window can be shortened', () => {
        const {calls, press} = make({timeoutMs: 100});

        press.press();
        jest.advanceTimersByTime(150);
        press.press();

        expect(calls.fired).toBe(0);
        expect(calls.expired).toBe(1);
    });
});

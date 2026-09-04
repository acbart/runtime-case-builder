/**
 * The keyboard shortcut that fills empty cases with example inputs, and the
 * two-step gesture behind it.
 *
 * The first press arms it and says what a second press will do; pressing again
 * within the window carries the action out. Waiting it out cancels, so a stray
 * keystroke never changes the page on its own.
 */

/** How long the first press stays armed. */
export const ARM_TIMEOUT_MS = 3000;

/** How the shortcut is written on screen. */
export const FILL_SHORTCUT = "Ctrl+I";

/** True for the keystroke that fills empty cases in (Ctrl+I, or Cmd+I on a Mac). */
export function isFillShortcut(event) {
    return Boolean(event)
        && (event.ctrlKey || event.metaKey)
        && !event.altKey && !event.shiftKey
        && String(event.key || "").toLowerCase() === "i";
}

export function createDoublePress({onArm, onFire, onExpire = () => {}, timeoutMs = ARM_TIMEOUT_MS}) {
    let timer = null;

    const clear = () => {
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
    };

    return {
        /** Returns "armed" for the first press, "fired" for the second. */
        press() {
            if (timer !== null) {
                clear();
                onFire();
                return "fired";
            }
            timer = setTimeout(() => {
                timer = null;
                onExpire();
            }, timeoutMs);
            onArm();
            return "armed";
        },
        isArmed() {
            return timer !== null;
        },
        /** Forget a first press without acting on it. */
        cancel() {
            clear();
        },
    };
}

/**
 * Tests for the removeXY utility function.
 */
import { removeXY } from '../src/utilities.js';

describe('removeXY', () => {
    test('removes the first point matching x and y', () => {
        const arr = [{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }];
        const result = removeXY(arr, 3, 4);
        expect(result).toHaveLength(2);
        expect(result).toEqual([{ x: 1, y: 2 }, { x: 5, y: 6 }]);
    });

    test('returns the same array instance', () => {
        const arr = [{ x: 1, y: 1 }];
        const result = removeXY(arr, 1, 1);
        expect(result).toBe(arr);
    });

    test('returns the array unchanged when no match found', () => {
        const arr = [{ x: 1, y: 2 }, { x: 3, y: 4 }];
        const result = removeXY(arr, 99, 99);
        expect(result).toHaveLength(2);
        expect(result).toEqual([{ x: 1, y: 2 }, { x: 3, y: 4 }]);
    });

    test('removes only the first occurrence when duplicates exist', () => {
        const arr = [{ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 1, y: 2 }];
        const result = removeXY(arr, 5, 5);
        expect(result).toHaveLength(2);
        // Only the first duplicate removed
        expect(result[0]).toEqual({ x: 5, y: 5 });
        expect(result[1]).toEqual({ x: 1, y: 2 });
    });

    test('handles an empty array', () => {
        const result = removeXY([], 1, 1);
        expect(result).toEqual([]);
    });

    test('partial match on x only is not removed', () => {
        const arr = [{ x: 1, y: 2 }];
        const result = removeXY(arr, 1, 99);
        expect(result).toHaveLength(1);
    });

    test('partial match on y only is not removed', () => {
        const arr = [{ x: 1, y: 2 }];
        const result = removeXY(arr, 99, 2);
        expect(result).toHaveLength(1);
    });

    test('removes last element correctly', () => {
        const arr = [{ x: 1, y: 2 }, { x: 9, y: 9 }];
        const result = removeXY(arr, 9, 9);
        expect(result).toEqual([{ x: 1, y: 2 }]);
    });

    test('removes first element correctly', () => {
        const arr = [{ x: 0, y: 0 }, { x: 1, y: 2 }];
        const result = removeXY(arr, 0, 0);
        expect(result).toEqual([{ x: 1, y: 2 }]);
    });
});

/**
 * The session shown when the page is opened without a `?preload=` parameter.
 *
 * Linear search with an early return is the classic first example: the Best
 * case (target at the front) stays flat while the Worst case (target absent)
 * grows with n, so running both cases immediately shows the method. Input
 * sizes double (10, 20, 40, 80) so growth is visible on the plot.
 */
export const STARTER_SIZES = [10, 20, 40, 80];

function generators(firstId, target) {
    return STARTER_SIZES.map((n, i) => ({
        id: firstId + i,
        code: [String(n), "list(range(n))", target],
    }));
}

export const STARTER_SESSION = {
    title: "Linear Search",
    inputs: [
        {name: "n", type: "int"},
        {name: "numbers", type: "list[int]"},
        {name: "target", type: "int"},
    ],
    cases: [
        {id: 0, name: "Best", color: "#00AA00", generators: generators(0, "0")},
        {id: 1, name: "Worst", color: "#FF0000", generators: generators(STARTER_SIZES.length, "-1")},
    ],
    instances: [],
    code: `def find(values, target):
    for value in values:
        if value == target:
            return True
    return False

print(find(numbers, target))`,
};

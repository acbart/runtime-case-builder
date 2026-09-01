"""
Tests for the Python step-counting tracer logic that powers execution.js.

These tests exercise the same sys.settrace-based counting logic used by
Pyodide at runtime, but run directly under CPython so they don't require
a browser or Pyodide installation.

How it works in execution.js:
  - `_rcb_init` is the init code (variable assignments).
  - `_rcb_user` is the student code to be counted.
  - A `sys.settrace` tracer counts every `'line'` event whose
    `frame.f_code.co_filename == '_rcb_student'`.
  - Results are returned as a JSON dict with keys:
      n, steps, output, error, data
"""

import sys
import io
import json
import traceback
import pytest


def run_student_code(init_code: str, user_code: str, var_names: list[str]) -> dict:
    """
    Equivalent of the TRACER_SCRIPT that runs inside Pyodide.
    Runs *init_code* without tracing, then *user_code* with tracing.
    Returns a dict with keys: n, steps, output, error, data.
    """
    ns: dict = {}
    steps = 0
    out_buf = io.StringIO()
    err = None
    data: dict = {}

    try:
        exec(init_code, ns)  # noqa: S102
    except Exception as e:
        err = str(e)

    if err is None:
        try:
            user_code_obj = compile(user_code, "_rcb_student", "exec")
        except SyntaxError as e:
            err = str(e)
            user_code_obj = None

    if err is None and user_code_obj is not None:

        def tracer(frame, event, arg):
            nonlocal steps
            if event == "line" and frame.f_code.co_filename == "_rcb_student":
                steps += 1
            return tracer

        old_stdout = sys.stdout
        sys.stdout = out_buf
        sys.settrace(tracer)
        try:
            exec(user_code_obj, ns)  # noqa: S102
        except Exception as e:
            err = traceback.format_exc()
        finally:
            sys.settrace(None)
            sys.stdout = old_stdout

    for vn in var_names:
        try:
            data[vn] = repr(ns.get(vn))
        except Exception:
            data[vn] = "???"

    return {
        "n": ns.get("n"),
        "steps": steps,
        "output": out_buf.getvalue(),
        "error": err,
        "data": data,
    }


def run_with_n(n_value: int, user_code: str) -> dict:
    """Convenience wrapper: sets n in init, runs user_code."""
    return run_student_code(f"n = {n_value}", user_code, ["n"])


# ---------------------------------------------------------------------------
# Step counting: algorithmic complexity tests
# ---------------------------------------------------------------------------

class TestStepCounting:
    """Verify that the tracer produces the correct step counts."""

    def test_constant_code(self):
        """A simple assignment is O(1) — 1 step."""
        result = run_with_n(10, "x = 1")
        assert result["error"] is None
        assert result["steps"] == 1

    def test_linear_loop(self):
        """A single for-loop over range(n) executes n+1 steps (assignment + n iterations)."""
        result = run_with_n(5, "total = 0\nfor i in range(n):\n    total += i\n")
        # Steps: `total = 0` (1), for header * (n+1) — each iteration AND the exhaustion
        # Actually CPython counts the `for` statement once per iteration plus once for the
        # end: for n=5 → 1 + 6 + 5 = 12 (assignment, 6 for-statement firings, 5 body lines)
        # The exact count depends on CPython's bytecode layout; what matters is that it
        # scales linearly — just assert it's > n and roughly correct.
        assert result["error"] is None
        assert result["steps"] > 5
        # For n=5: total=0 (1), for-line fires 6 times (5 iters + exhaustion), body 5 times = 12
        assert result["steps"] == 12

    def test_quadratic_loop(self):
        """A nested for-loop should be clearly larger than a linear one for the same n."""
        n = 4
        linear_result = run_with_n(n, "total = 0\nfor i in range(n):\n    total += i\n")
        quad_result = run_with_n(
            n,
            "total = 0\nfor i in range(n):\n    for j in range(n):\n        total += 1\n",
        )
        assert linear_result["error"] is None
        assert quad_result["error"] is None
        assert quad_result["steps"] > linear_result["steps"]

    def test_linear_scales_with_n(self):
        """Linear algorithm steps grow proportionally with n."""
        r1 = run_with_n(5, "s = 0\nfor i in range(n):\n    s += i\n")
        r2 = run_with_n(10, "s = 0\nfor i in range(n):\n    s += i\n")
        assert r1["error"] is None
        assert r2["error"] is None
        # Ratio of steps should be approximately 2× for 2× n
        ratio = r2["steps"] / r1["steps"]
        assert 1.5 < ratio < 2.5

    def test_quadratic_scales_with_n(self):
        """Quadratic algorithm steps grow ~4× when n doubles."""
        code = "s = 0\nfor i in range(n):\n    for j in range(n):\n        s += 1\n"
        r1 = run_with_n(5, code)
        r2 = run_with_n(10, code)
        assert r1["error"] is None
        assert r2["error"] is None
        # For a true n² loop the ratio of steps should be ~4× for 2× n
        ratio = r2["steps"] / r1["steps"]
        assert 3.0 < ratio < 5.0

    def test_init_code_not_counted(self):
        """Lines executed by the init/setup phase must NOT contribute to the step count."""
        # Init assigns n=10 (many operations) and user code is only a single assignment.
        init = "n = 10\nx = 0\ny = 0\nz = 0"
        user = "result = n + 1"
        result = run_student_code(init, user, ["n", "result"])
        assert result["error"] is None
        # Only the one user-code line should be counted
        assert result["steps"] == 1

    def test_deterministic_for_same_input(self):
        """Running the same code twice with the same n must give the same step count."""
        code = "s = 0\nfor i in range(n):\n    s += i\n"
        r1 = run_with_n(7, code)
        r2 = run_with_n(7, code)
        assert r1["steps"] == r2["steps"]

    def test_early_return_via_break(self):
        """A loop with early break should count fewer steps than a full loop."""
        full = "s = 0\nfor i in range(n):\n    s += i\n"
        early = "s = 0\nfor i in range(n):\n    s += i\n    if i == 2:\n        break\n"
        r_full = run_with_n(10, full)
        r_early = run_with_n(10, early)
        assert r_full["error"] is None
        assert r_early["error"] is None
        assert r_early["steps"] < r_full["steps"]

    def test_function_calls_counted(self):
        """Lines inside a called function defined in user code should be counted."""
        code = (
            "def add(a, b):\n"
            "    return a + b\n"
            "result = add(n, 1)\n"
        )
        result = run_with_n(3, code)
        assert result["error"] is None
        # def statement + call (triggers return line) + assignment = at least 3 steps
        assert result["steps"] >= 3


# ---------------------------------------------------------------------------
# n-variable tests
# ---------------------------------------------------------------------------

class TestNVariable:
    """Verify that 'n' is correctly extracted and reported."""

    def test_n_returned(self):
        result = run_with_n(42, "x = 1")
        assert result["n"] == 42

    def test_n_modified_in_user_code(self):
        """If user code changes n, the *final* value is reported."""
        result = run_with_n(5, "n = n * 2")
        assert result["n"] == 10

    def test_missing_n_returns_none(self):
        """User code that never defines n should leave n as None."""
        result = run_student_code("", "x = 1", ["x"])
        assert result["n"] is None

    def test_n_from_list_length(self):
        """n can be set to the length of a list — common student pattern."""
        init = "array = [1, 2, 3, 4, 5]"
        user = "n = len(array)\ns = sum(array)"
        result = run_student_code(init, user, ["n"])
        assert result["n"] == 5
        assert result["error"] is None


# ---------------------------------------------------------------------------
# Output capture tests
# ---------------------------------------------------------------------------

class TestOutputCapture:
    """Verify that stdout is captured and returned correctly."""

    def test_print_captured(self):
        result = run_with_n(3, 'print("hello")')
        assert result["error"] is None
        assert "hello" in result["output"]

    def test_multiple_prints_captured(self):
        result = run_with_n(3, 'print("a")\nprint("b")\nprint("c")')
        assert result["error"] is None
        assert "a" in result["output"]
        assert "b" in result["output"]
        assert "c" in result["output"]

    def test_no_output_is_empty_string(self):
        result = run_with_n(3, "x = 1")
        assert result["output"] == ""

    def test_print_of_n(self):
        result = run_with_n(7, "print(n)")
        assert "7" in result["output"]

    def test_newlines_preserved(self):
        result = run_with_n(2, 'print("line1")\nprint("line2")')
        assert result["output"].count("\n") >= 2


# ---------------------------------------------------------------------------
# Error handling tests
# ---------------------------------------------------------------------------

class TestErrorHandling:
    """Verify that runtime errors are surfaced correctly."""

    def test_name_error_reported(self):
        result = run_student_code("n = 5", "x = undefined_var", ["n"])
        assert result["error"] is not None
        assert "NameError" in result["error"]

    def test_zero_division_reported(self):
        result = run_student_code("n = 5", "x = 1 / 0", ["n"])
        assert result["error"] is not None
        assert "ZeroDivisionError" in result["error"]

    def test_index_error_reported(self):
        result = run_student_code("array = [1, 2]", "x = array[10]", ["array"])
        assert result["error"] is not None
        assert "IndexError" in result["error"]

    def test_syntax_error_in_user_code(self):
        result = run_student_code("n = 5", "x = (1 +", ["n"])
        assert result["error"] is not None

    def test_error_in_init_code(self):
        result = run_student_code("n = undefined_init_var + 1", "x = 1", ["n"])
        assert result["error"] is not None
        # n should remain None since init failed
        assert result["n"] is None

    def test_steps_zero_on_init_error(self):
        result = run_student_code("n = bad_var", "x = 1", ["n"])
        assert result["steps"] == 0


# ---------------------------------------------------------------------------
# Data snapshot tests
# ---------------------------------------------------------------------------

class TestDataSnapshot:
    """Verify that variable values are snapshotted after execution."""

    def test_simple_variable_captured(self):
        result = run_student_code("n = 5", "x = n * 2", ["n", "x"])
        assert result["error"] is None
        assert "10" in result["data"]["x"]

    def test_list_variable_captured(self):
        result = run_student_code("array = [1, 2, 3]", "array.append(4)", ["array"])
        assert result["error"] is None
        assert "4" in result["data"]["array"]

    def test_missing_variable_captured_as_none(self):
        result = run_student_code("n = 5", "x = 1", ["n", "y_not_set"])
        assert result["data"]["y_not_set"] == "None"


# ---------------------------------------------------------------------------
# Algorithmic correctness smoke tests against session examples
# ---------------------------------------------------------------------------

class TestRealAlgorithms:
    """Smoke tests using algorithms from the actual session files."""

    def test_nested_loop_sum(self):
        """Classic O(n²) sum — from nested_loop session."""
        code = "total = 0\nfor i in range(n):\n    for j in range(n):\n        total = total + i + j\nprint(total)\n"
        r_small = run_with_n(5, code)
        r_large = run_with_n(10, code)
        assert r_small["error"] is None
        assert r_large["error"] is None
        # Must scale quadratically
        ratio = r_large["steps"] / r_small["steps"]
        assert 3.0 < ratio < 5.0

    def test_linear_sum(self):
        """Classic O(n) sum."""
        code = "total = 0\nfor i in range(n):\n    total += i\nprint(total)\n"
        r_small = run_with_n(5, code)
        r_large = run_with_n(10, code)
        assert r_small["error"] is None
        assert r_large["error"] is None
        ratio = r_large["steps"] / r_small["steps"]
        assert 1.5 < ratio < 2.5

    def test_max_in_list(self):
        """Find maximum in a list — O(n)."""
        init = "n = 10\nfrom random import *\narray = [randint(1, 100) for _ in range(n)]"
        code = "max_val = array[0]\nfor x in array:\n    if x > max_val:\n        max_val = x\n"
        result = run_student_code(init, code, ["n", "max_val"])
        # Can't check exact steps but must complete without error
        assert result["error"] is None

    def test_print_sum_output(self):
        """Algorithm that prints its result — output captured correctly."""
        code = "total = 0\nfor i in range(n):\n    total += i\nprint(total)\n"
        result = run_with_n(5, code)
        assert result["error"] is None
        # sum(0..4) = 10
        assert "10" in result["output"]

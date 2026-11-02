/**
 * Python run inside the worker once Pyodide is up (Phase 13): the `qla` helper module
 * (plots and sample datasets) and the runner that executes cells in named namespaces.
 * Kept as strings so the worker writes them to Pyodide's in-memory file system.
 */
import { DATASET_IDS } from "@/lib/datasets/generate";

/** Filename shown in tracebacks for the learner's own code. */
export const CELL_FILENAME = "<cell>";

export const QLA_MODULE = String.raw`
"""Helpers for the Quant Learning lab: plots in the site's own style and sample data."""
import _qla_js

_LANG = "pl"
_ORIGIN = ""
DATASETS = ${JSON.stringify(DATASET_IDS)}
_MAX_VALUES = 1_000_000

_MSG = {
    "pl": {
        "numbers": "{name}: potrzebne są liczby (lista, tablica numpy albo kolumna pandas)",
        "length": "x i y muszą mieć tyle samo elementów (x: {nx}, y: {ny})",
        "too_many": "{name}: za dużo wartości do wykresu ({n}); weź próbkę albo zagreguj",
        "dataset": "nie ma zbioru {name!r}; dostępne: {names}",
    },
    "en": {
        "numbers": "{name}: needs numbers (a list, a numpy array or a pandas column)",
        "length": "x and y must have the same length (x: {nx}, y: {ny})",
        "too_many": "{name}: too many values to plot ({n}); sample or aggregate first",
        "dataset": "there is no dataset {name!r}; available: {names}",
    },
}


def _t(key, **kw):
    return _MSG.get(_LANG, _MSG["pl"])[key].format(**kw)


def _is_dates(v):
    return "datetime64" in str(getattr(v, "dtype", ""))


def _values(v, name):
    if _is_dates(v):
        import numpy as np

        v = np.asarray(v, dtype="datetime64[ms]").astype("int64")
    if hasattr(v, "to_numpy"):
        v = v.to_numpy()
    if hasattr(v, "tolist"):
        v = v.tolist()
    try:
        out = [float(x) for x in v]
    except (TypeError, ValueError):
        raise TypeError(_t("numbers", name=name)) from None
    if len(out) > _MAX_VALUES:
        raise ValueError(_t("too_many", name=name, n=len(out)))
    return out


def show(x, y=None, label=None):
    """Line chart: show(y), show(x, y) or show(series); label names the line."""
    if y is None:
        y = x
        x = getattr(y, "index", None)
        if x is not None and not _is_dates(x) and type(x).__name__ == "RangeIndex":
            x = None
    if label is None:
        label = getattr(y, "name", None)
    ys = _values(y, "y")
    dates = x is not None and _is_dates(x)
    xs = None if x is None else _values(x, "x")
    if xs is not None and len(xs) != len(ys):
        raise ValueError(_t("length", nx=len(xs), ny=len(ys)))
    _qla_js.plot("line", None if label is None else str(label), xs, ys, 0, dates)


def hist(data, bins=30, label=None):
    """Histogram of the values; bins is the number of bars."""
    if label is None:
        label = getattr(data, "name", None)
    _qla_js.plot("hist", None if label is None else str(label), None, _values(data, "data"), int(bins), False)


def load(name):
    """A sample dataset as a pandas DataFrame indexed by date (synthetic data, not real prices)."""
    import pandas as pd
    from pyodide.http import open_url

    if name not in DATASETS:
        raise ValueError(_t("dataset", name=name, names=", ".join(DATASETS)))
    return pd.read_csv(open_url(f"{_ORIGIN}/datasets/{name}.csv"), parse_dates=["date"], index_col="date")
`;

export const RUNNER = String.raw`
import linecache
import traceback

import qla
from pyodide.code import eval_code_async

_FILENAME = ${JSON.stringify(CELL_FILENAME)}
_NAMESPACES = {}


def _ns(name):
    if name not in _NAMESPACES:
        _NAMESPACES[name] = {"__name__": "__main__", "qla": qla, "show": qla.show, "hist": qla.hist}
    return _NAMESPACES[name]


def _reset(name):
    _NAMESPACES.pop(name, None)


async def _run(code, name):
    # Lets tracebacks quote the learner's lines.
    linecache.cache[_FILENAME] = (len(code), None, code.splitlines(True), _FILENAME)
    try:
        result = await eval_code_async(code, _ns(name), filename=_FILENAME)
    except BaseException as e:
        frames = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == _FILENAME]
        lines = ["Traceback (most recent call last):\n", *traceback.format_list(frames)] if frames else []
        lines += traceback.format_exception_only(type(e), e)
        return [None, "".join(lines)]
    return [None if result is None else repr(result), None]
`;

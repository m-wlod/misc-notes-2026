/**
 * Pyodide release served from jsDelivr. Versioned files are immutable there
 * (Cache-Control: max-age=31536000), so the browser caches the first load. Pinned to the
 * exact version of the `pyodide` dev dependency, whose types we compile against.
 */
export const PYODIDE_VERSION = "314.0.7";
export const PYODIDE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

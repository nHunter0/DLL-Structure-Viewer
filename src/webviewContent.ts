import * as vscode from 'vscode';

export function getWebviewContent(webview: vscode.Webview, nonce: string): string {
    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
<style nonce="${nonce}">
/* ─── Reset & Variables ──────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
    --bg-primary: var(--vscode-editor-background);
    --bg-secondary: var(--vscode-sideBar-background, var(--vscode-editor-background));
    --bg-elevated: var(--vscode-editorWidget-background, var(--vscode-editor-background));
    --bg-hover: var(--vscode-list-hoverBackground);
    --bg-active: var(--vscode-list-activeSelectionBackground);

    --text-primary: var(--vscode-editor-foreground);
    --text-secondary: var(--vscode-descriptionForeground);
    --text-muted: var(--vscode-disabledForeground, #888);
    --text-accent: var(--vscode-textLink-foreground);

    --border: var(--vscode-panel-border, var(--vscode-widget-border, rgba(128,128,128,0.2)));
    --accent: var(--vscode-focusBorder, #007acc);

    --badge-bg: var(--vscode-badge-background);
    --badge-fg: var(--vscode-badge-foreground);

    --error: var(--vscode-errorForeground, #f44747);
    --warning: var(--vscode-editorWarning-foreground, #cca700);
    --info: var(--vscode-editorInfo-foreground, #3794ff);
    --success: #4ec9b0;

    --font: var(--vscode-font-family);
    --font-mono: var(--vscode-editor-font-family, 'Cascadia Code', 'Consolas', monospace);
    --font-size: var(--vscode-font-size, 13px);
    --font-size-sm: 11px;
    --font-size-lg: 16px;
    --font-size-xl: 22px;

    --radius-sm: 3px;
    --radius-md: 6px;
    --radius-lg: 8px;

    --shadow: 0 2px 8px rgba(0,0,0,0.15);
    --transition: 0.15s ease;
}

body {
    font-family: var(--font);
    font-size: var(--font-size);
    color: var(--text-primary);
    background: var(--bg-primary);
    line-height: 1.5;
    overflow: hidden;
    height: 100vh;
}

#app {
    display: flex;
    flex-direction: column;
    height: 100vh;
}

/* ─── Tab Bar ────────────────────────────────────────────────── */
.tab-bar {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--border);
    background: var(--bg-secondary);
    flex-shrink: 0;
    padding: 0 12px;
    overflow-x: auto;
}

.tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 16px;
    color: var(--text-secondary);
    border-bottom: 2px solid transparent;
    cursor: pointer;
    font-size: var(--font-size);
    transition: color var(--transition), border-color var(--transition), background var(--transition);
    user-select: none;
    white-space: nowrap;
    position: relative;
}

.tab:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
}

.tab.active {
    color: var(--text-accent);
    border-bottom-color: var(--accent);
}

.tab .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 18px;
    padding: 0 6px;
    border-radius: 9px;
    background: var(--badge-bg);
    color: var(--badge-fg);
    font-size: var(--font-size-sm);
    font-weight: 600;
}

.tab .icon {
    font-size: 16px;
    opacity: 0.8;
}

/* ─── Tab Content ────────────────────────────────────────────── */
.tab-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
}

/* ─── Loading / Progress ─────────────────────────────────────── */
.loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: 16px;
    color: var(--text-secondary);
}

.spinner {
    width: 32px; height: 32px;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.progress-bar {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    height: 28px;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    display: none;
    align-items: center;
    padding: 0 12px;
    gap: 8px;
    z-index: 200;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
}

.progress-fill {
    height: 3px;
    background: var(--accent);
    border-radius: 2px;
    transition: width 0.3s;
    position: absolute;
    top: 0; left: 0;
}

/* ─── Overview Panel ─────────────────────────────────────────── */
.overview-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 24px;
    border-bottom: 1px solid var(--border);
}

.overview-icon {
    width: 48px; height: 48px;
    border-radius: var(--radius-lg);
    background: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    color: white;
    flex-shrink: 0;
}

.overview-title {
    font-size: var(--font-size-xl);
    font-weight: 700;
    font-family: var(--font-mono);
    line-height: 1.2;
}

.overview-subtitle {
    color: var(--text-secondary);
    font-size: var(--font-size);
    margin-top: 2px;
}

.stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 12px;
    padding: 20px 24px;
}

.stat-card {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    padding: 14px;
    text-align: center;
    transition: border-color var(--transition), transform var(--transition);
}
.stat-card:hover {
    border-color: var(--accent);
    transform: translateY(-1px);
}

.stat-icon { font-size: 18px; color: var(--accent); margin-bottom: 4px; }
.stat-value {
    font-size: var(--font-size-lg);
    font-weight: 700;
    font-family: var(--font-mono);
}
.stat-label {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    margin-top: 2px;
}

.info-section {
    padding: 16px 24px;
}
.info-section h2 {
    font-size: var(--font-size-lg);
    font-weight: 600;
    margin-bottom: 12px;
    color: var(--text-primary);
}

.info-table {
    width: 100%;
    border-collapse: collapse;
}
.info-table td, .info-table th {
    padding: 6px 10px;
    text-align: left;
    border-bottom: 1px solid var(--border);
}
.info-table th {
    color: var(--text-secondary);
    font-weight: 500;
    font-size: var(--font-size-sm);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.info-label {
    color: var(--text-secondary);
    width: 200px;
    font-weight: 500;
}
.mono { font-family: var(--font-mono); }

.tag-list { display: flex; flex-wrap: wrap; gap: 6px; }
.tag {
    padding: 2px 8px;
    border-radius: var(--radius-sm);
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    font-size: var(--font-size-sm);
    font-family: var(--font-mono);
    color: var(--text-secondary);
}

/* ─── Search Bar ─────────────────────────────────────────────── */
.panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 24px;
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    background: var(--bg-primary);
    z-index: 50;
    gap: 16px;
}
.panel-header h2 {
    font-size: var(--font-size-lg);
    font-weight: 600;
    white-space: nowrap;
}

.search-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--vscode-input-background, var(--bg-elevated));
    border: 1px solid var(--vscode-input-border, var(--border));
    border-radius: var(--radius-sm);
    padding: 4px 8px;
    min-width: 200px;
    max-width: 350px;
    flex: 1;
}
.search-bar:focus-within { border-color: var(--accent); }
.search-bar svg { color: var(--text-secondary); flex-shrink: 0; }
.search-input {
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-family: var(--font);
    font-size: var(--font-size);
    width: 100%;
}
.search-input::placeholder { color: var(--text-muted); }

/* ─── Export Table ────────────────────────────────────────────── */
.export-table-header {
    display: grid;
    grid-template-columns: 80px 1fr 120px 200px;
    padding: 6px 24px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    position: sticky;
    top: 53px;
    z-index: 40;
}
.export-list { position: relative; }
.export-row {
    display: grid;
    grid-template-columns: 80px 1fr 120px 200px;
    padding: 4px 24px;
    align-items: center;
    border-bottom: 1px solid transparent;
    transition: background var(--transition);
    font-size: var(--font-size);
}
.export-row:hover { background: var(--bg-hover); }
.export-row.even { background: rgba(128,128,128,0.04); }
.export-row.even:hover { background: var(--bg-hover); }
.export-ordinal { color: var(--text-secondary); font-family: var(--font-mono); }
.export-name { font-family: var(--font-mono); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.export-rva { font-family: var(--font-mono); color: var(--text-secondary); }
.export-info .tag { font-size: 10px; }
.export-fwd { color: var(--info); font-family: var(--font-mono); font-size: var(--font-size-sm); }

/* ─── Import Groups ──────────────────────────────────────────── */
.import-group {
    border-bottom: 1px solid var(--border);
}
.import-group-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 24px;
    cursor: pointer;
    transition: background var(--transition);
    user-select: none;
}
.import-group-header:hover { background: var(--bg-hover); }
.import-group-header .chevron {
    transition: transform var(--transition);
    color: var(--text-secondary);
    flex-shrink: 0;
}
.import-group-header .chevron.open { transform: rotate(90deg); }
.import-group-name {
    font-weight: 600;
    font-family: var(--font-mono);
}
.import-group-count {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
}
.import-group-badge {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    background: var(--warning);
    color: var(--bg-primary);
}
.import-entries {
    padding: 0 24px 8px 48px;
    display: none;
}
.import-entries.open { display: block; }
.import-entry {
    padding: 2px 0;
    font-family: var(--font-mono);
    font-size: var(--font-size);
    color: var(--text-primary);
    display: flex;
    gap: 8px;
}
.import-hint {
    color: var(--text-muted);
    font-size: var(--font-size-sm);
    min-width: 40px;
}

/* ─── Dependency Cards (first level) ─────────────────────────── */
.dep-summary {
    display: flex;
    gap: 16px;
    padding: 16px 24px;
    border-bottom: 1px solid var(--border);
    flex-wrap: wrap;
}
.dep-stat {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--font-size);
}
.dep-stat-val { font-weight: 700; font-family: var(--font-mono); }
.dep-stat-label { color: var(--text-secondary); }

.dep-section-title {
    padding: 16px 24px 8px;
    font-size: var(--font-size-lg);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
}

.dep-card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 10px;
    padding: 8px 24px 16px;
}

.dep-card {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-left: 3px solid var(--accent);
    border-radius: var(--radius-md);
    padding: 12px 14px;
    transition: border-color var(--transition), box-shadow var(--transition), transform var(--transition);
    cursor: default;
}
.dep-card:hover {
    border-color: var(--accent);
    box-shadow: var(--shadow);
    transform: translateY(-1px);
}
.dep-card.missing { border-left-color: var(--error); }
.dep-card.apiset { border-left-color: var(--info); }
.dep-card.circular { border-left-color: var(--warning); }

.dep-card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
}
.dep-card-name {
    font-weight: 600;
    font-family: var(--font-mono);
    font-size: var(--font-size);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
}
.dep-card-badge {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    white-space: nowrap;
    font-weight: 600;
}
.dep-card-badge.missing-badge { background: var(--error); color: white; }
.dep-card-badge.apiset-badge { background: var(--info); color: white; }
.dep-card-badge.circular-badge { background: var(--warning); color: var(--bg-primary); }
.dep-card-badge.system-badge { background: var(--bg-hover); color: var(--text-secondary); }

.dep-card-meta {
    display: flex;
    gap: 12px;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    margin-bottom: 4px;
}
.dep-card-path {
    font-size: var(--font-size-sm);
    font-family: var(--font-mono);
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.dep-card-path.missing-path {
    color: var(--error);
    font-style: italic;
}

/* ─── Dependency Tree ────────────────────────────────────────── */
.dep-tree-controls {
    display: flex;
    gap: 8px;
    padding: 8px 24px;
    align-items: center;
}
.tree-btn {
    padding: 4px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--bg-elevated);
    color: var(--text-primary);
    cursor: pointer;
    font-size: var(--font-size-sm);
    transition: background var(--transition);
}
.tree-btn:hover { background: var(--bg-hover); }

.dep-tree-list {
    font-family: var(--font-mono);
    font-size: var(--font-size);
    padding-bottom: 100px;
}

.tree-node {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 28px;
    padding-right: 12px;
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: background 0.1s;
    white-space: nowrap;
}
.tree-node:hover { background: var(--bg-hover); }

.tree-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    flex-shrink: 0;
    color: var(--text-secondary);
}

.tree-icon {
    flex-shrink: 0;
    width: 16px;
    text-align: center;
}
.tree-icon.lib { color: var(--accent); }
.tree-icon.warn { color: var(--error); }
.tree-icon.api { color: var(--info); }
.tree-icon.circ { color: var(--warning); }

.tree-name {
    overflow: hidden;
    text-overflow: ellipsis;
}

.tree-badge {
    font-size: 10px;
    padding: 0 5px;
    border-radius: 3px;
    margin-left: 4px;
    font-weight: 600;
}
.tree-badge.missing { background: var(--error); color: white; }
.tree-badge.circular { background: var(--warning); color: var(--bg-primary); }
.tree-badge.apiset { background: var(--info); color: white; }
.tree-badge.system { background: rgba(128,128,128,0.2); color: var(--text-secondary); font-weight: normal; }
.tree-badge.depth-limit { background: var(--text-muted); color: var(--bg-primary); }

.dep-tree-search {
    flex: 1;
}

/* ─── Sections Table ─────────────────────────────────────────── */
.sections-table {
    width: 100%;
    border-collapse: collapse;
}
.sections-table th {
    padding: 8px 12px;
    text-align: left;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    position: sticky;
    top: 0;
    z-index: 10;
}
.sections-table td {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    font-family: var(--font-mono);
    font-size: var(--font-size);
}
.sections-table tr:hover td { background: var(--bg-hover); }

.section-flags { display: flex; flex-wrap: wrap; gap: 4px; }
.section-flag {
    padding: 1px 5px;
    border-radius: 2px;
    font-size: 10px;
    font-weight: 600;
}
.section-flag.read { background: rgba(78,201,176,0.15); color: var(--success); }
.section-flag.write { background: rgba(244,71,71,0.15); color: var(--error); }
.section-flag.execute { background: rgba(204,167,0,0.15); color: var(--warning); }
.section-flag.code { background: rgba(55,148,255,0.15); color: var(--info); }
.section-flag.default { background: rgba(128,128,128,0.1); color: var(--text-muted); }

/* ─── Empty / Error States ───────────────────────────────────── */
.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 24px;
    color: var(--text-secondary);
    text-align: center;
    gap: 12px;
}
.empty-state .icon { font-size: 40px; opacity: 0.3; }

.error-banner {
    padding: 12px 24px;
    background: rgba(244,71,71,0.1);
    border-left: 3px solid var(--error);
    color: var(--error);
    font-size: var(--font-size-sm);
    display: flex;
    gap: 8px;
    align-items: center;
}

/* SVG icons inline */
.svg-icon { width: 16px; height: 16px; fill: currentColor; }
</style>
</head>
<body>
<div id="app">
    <div class="loading">
        <div class="spinner"></div>
        <div>Parsing PE file...</div>
    </div>
</div>
<script nonce="${nonce}">
(function() {
    const vscode = acquireVsCodeApi();

    // ─── SVG Icons ──────────────────────────────────────────
    const ICONS = {
        search: '<svg viewBox="0 0 16 16" class="svg-icon"><path d="M11.7 10.3l3 3-.7.7-3-3c-1 .8-2.2 1.3-3.5 1.3C4 12.3 1.3 9.6 1.3 6.8S4 1.3 6.8 1.3s5.5 2.7 5.5 5.5c0 1.3-.5 2.5-1.3 3.5zM6.8 2.5C4.7 2.5 3 4.2 3 6.3s1.7 3.8 3.8 3.8 3.8-1.7 3.8-3.8-1.7-3.8-3.8-3.8z"/></svg>',
        chevron: '<svg viewBox="0 0 16 16" class="svg-icon"><path d="M6 4l4 4-4 4"/></svg>',
        lib: '<svg viewBox="0 0 16 16" class="svg-icon"><path d="M14 2H8l-1-1H3L2 2v11l1 1h11l1-1V3l-1-1zm0 11H3V3h4l1 1h6v9z"/></svg>',
        warn: '<svg viewBox="0 0 16 16" class="svg-icon"><path d="M7.56 1.44l-6.5 11.25c-.3.52.07 1.18.68 1.18h13c.61 0 .98-.66.68-1.18L8.92 1.44a.79.79 0 00-1.36 0zM8 4.5l4.33 7.5H3.67L8 4.5zM7.5 7v2h1V7h-1zm0 3v1h1v-1h-1z"/></svg>',
        file: '<svg viewBox="0 0 16 16" class="svg-icon"><path d="M13 4H9V1H4v14h9V4zm-3-2l2 2h-2V2zM3 0h7l4 4v12H3V0z"/></svg>',
        method: '<svg viewBox="0 0 16 16" class="svg-icon"><path d="M13.51 4l-5-3h-1l-5 3-.49.86v6l.49.86 5 3h1l5-3 .49-.86v-6L13.51 4zM8 1.58l4 2.4-4 2.4-4-2.4 4-2.4zM3.02 5.16L7 7.56v4.88l-3.98-2.4V5.16zM9 12.44V7.56l3.98-2.4v4.88L9 12.44z"/></svg>',
        refs: '<svg viewBox="0 0 16 16" class="svg-icon"><path d="M12 1H5l-1 1v2H2v10l1 1h7l1-1v-2h2l1-1V2l-1-1zm-2 12H3V5h1v6l1 1h5v1zm3-3H6V3h7v7z"/></svg>',
        layers: '<svg viewBox="0 0 16 16" class="svg-icon"><path d="M8 1L1 5l7 4 7-4-7-4zM1 8l7 4 7-4M1 11l7 4 7-4"/></svg>',
        tree: '<svg viewBox="0 0 16 16" class="svg-icon"><path d="M1 1h5v5H1V1zm2 2v1h1V3H3zm6-2h5v5H9V1zm2 2v1h1V3h-1zM1 9h5v5H1V9zm2 2v1h1v-1H3zm8 0a2 2 0 100-4 2 2 0 000 4zm0-1a1 1 0 110-2 1 1 0 010 2z"/></svg>',
        info: '<svg viewBox="0 0 16 16" class="svg-icon"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 13A6 6 0 118 2a6 6 0 010 12zm-.5-9h1V4h-1v1zm0 7h1V6h-1v6z"/></svg>',
    };

    // ─── State ──────────────────────────────────────────────
    let peData = null;
    let depTree = null;
    let currentTab = 'overview';
    let expandedImports = new Set();
    let expandedTreePaths = new Set();
    let searchQuery = '';

    const TABS = [
        { id: 'overview', label: 'Overview', icon: 'info' },
        { id: 'exports', label: 'Exports', icon: 'method' },
        { id: 'imports', label: 'Imports', icon: 'refs' },
        { id: 'dependencies', label: 'Dependencies', icon: 'tree' },
        { id: 'sections', label: 'Sections', icon: 'layers' },
    ];

    // ─── Helpers ────────────────────────────────────────────
    function esc(s) {
        if (!s) return '';
        return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function formatBytes(b) {
        if (b < 1024) return b + ' B';
        if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
        return (b / 1048576).toFixed(1) + ' MB';
    }

    function hex(n) { return '0x' + n.toString(16).toUpperCase(); }

    function truncPath(p, max) {
        if (!p) return '';
        if (p.length <= (max || 50)) return p;
        return '...' + p.slice(-(max || 47));
    }

    // ─── Render App ─────────────────────────────────────────
    function renderApp() {
        const app = document.getElementById('app');
        app.innerHTML = '';

        // Tab bar
        const tabBar = document.createElement('div');
        tabBar.className = 'tab-bar';
        TABS.forEach(t => {
            const tab = document.createElement('div');
            tab.className = 'tab' + (t.id === currentTab ? ' active' : '');
            let badgeHTML = '';
            if (peData) {
                const count = getBadgeCount(t.id);
                if (count > 0) badgeHTML = '<span class="badge">' + (count > 999 ? '999+' : count) + '</span>';
            }
            tab.innerHTML = '<span class="icon">' + ICONS[t.icon] + '</span>' + esc(t.label) + badgeHTML;
            tab.addEventListener('click', () => { currentTab = t.id; searchQuery = ''; renderApp(); });
            tabBar.appendChild(tab);
        });
        app.appendChild(tabBar);

        // Content
        const content = document.createElement('div');
        content.className = 'tab-content';
        app.appendChild(content);

        if (!peData) {
            content.innerHTML = '<div class="loading"><div class="spinner"></div><div>Parsing PE file...</div></div>';
            return;
        }

        switch (currentTab) {
            case 'overview': renderOverview(content); break;
            case 'exports': renderExports(content); break;
            case 'imports': renderImports(content); break;
            case 'dependencies': renderDependencies(content); break;
            case 'sections': renderSections(content); break;
        }

        // Progress bar for deps
        if (!depTree && currentTab !== 'dependencies') {
            // show nothing
        }
    }

    function getBadgeCount(tabId) {
        if (!peData) return 0;
        switch (tabId) {
            case 'exports': return peData.exports ? peData.exports.entries.length : 0;
            case 'imports': return peData.imports.length + peData.delayImports.length;
            case 'dependencies': return depTree ? depTree.totalModules : 0;
            case 'sections': return peData.sections.length;
            default: return 0;
        }
    }

    // ─── Overview Tab ───────────────────────────────────────
    function renderOverview(container) {
        const pe = peData;
        let html = '';

        // Header
        html += '<div class="overview-header">';
        html += '<div class="overview-icon">' + ICONS.lib + '</div>';
        html += '<div>';
        html += '<div class="overview-title">' + esc(pe.fileName) + '</div>';
        html += '<div class="overview-subtitle">' + esc(pe.coffHeader.machineDescription) + ' &middot; ' + (pe.optionalHeader.isPE32Plus ? 'PE32+ (64-bit)' : 'PE32 (32-bit)') + '</div>';
        html += '</div></div>';

        // Stats
        html += '<div class="stat-grid">';
        html += statCard('File Size', formatBytes(pe.fileSize));
        html += statCard('Exports', pe.exports ? pe.exports.entries.length.toString() : '0');
        html += statCard('Imports', pe.imports.length + ' DLLs');
        html += statCard('Sections', pe.sections.length.toString());
        html += statCard('Entry Point', hex(pe.optionalHeader.entryPoint));
        html += statCard('Image Base', pe.optionalHeader.imageBase);
        html += '</div>';

        // Errors
        if (pe.errors && pe.errors.length > 0) {
            pe.errors.forEach(function(e) {
                html += '<div class="error-banner">' + ICONS.warn + ' <span>[' + esc(e.stage) + '] ' + esc(e.message) + '</span></div>';
            });
        }

        // PE Headers
        html += '<div class="info-section"><h2>PE Headers</h2><table class="info-table">';
        html += infoRow('Machine', pe.coffHeader.machineDescription);
        html += infoRow('Timestamp', pe.coffHeader.timeDateStampDate);
        html += infoRow('Subsystem', pe.optionalHeader.subsystemDescription);
        html += infoRow('Linker Version', pe.optionalHeader.linkerVersion);
        html += infoRow('Checksum', hex(pe.optionalHeader.checkSum));
        html += infoRow('Section Alignment', hex(pe.optionalHeader.sectionAlignment));
        html += infoRow('File Alignment', hex(pe.optionalHeader.fileAlignment));
        html += infoRow('OS Version', pe.optionalHeader.osVersion);
        html += infoRow('Size of Image', formatBytes(pe.optionalHeader.sizeOfImage));
        html += infoRow('Size of Headers', formatBytes(pe.optionalHeader.sizeOfHeaders));
        html += '</table></div>';

        // Characteristics
        html += '<div class="info-section"><h2>Characteristics</h2><div class="tag-list">';
        pe.coffHeader.characteristicFlags.forEach(function(f) { html += '<span class="tag">' + esc(f) + '</span>'; });
        html += '</div></div>';

        // DLL Characteristics
        if (pe.optionalHeader.dllCharacteristicFlags.length > 0) {
            html += '<div class="info-section"><h2>DLL Characteristics</h2><div class="tag-list">';
            pe.optionalHeader.dllCharacteristicFlags.forEach(function(f) { html += '<span class="tag">' + esc(f) + '</span>'; });
            html += '</div></div>';
        }

        // Data Directories
        const activeDirs = pe.optionalHeader.dataDirectories.filter(function(d) { return d.virtualAddress !== 0; });
        if (activeDirs.length > 0) {
            html += '<div class="info-section"><h2>Data Directories</h2>';
            html += '<table class="info-table"><thead><tr><th>Name</th><th>RVA</th><th>Size</th></tr></thead><tbody>';
            activeDirs.forEach(function(d) {
                html += '<tr><td>' + esc(d.name) + '</td><td class="mono">' + hex(d.virtualAddress) + '</td><td class="mono">' + formatBytes(d.size) + '</td></tr>';
            });
            html += '</tbody></table></div>';
        }

        container.innerHTML = html;
    }

    function statCard(label, value) {
        return '<div class="stat-card"><div class="stat-value">' + esc(value) + '</div><div class="stat-label">' + esc(label) + '</div></div>';
    }

    function infoRow(label, value) {
        return '<tr><td class="info-label">' + esc(label) + '</td><td class="mono">' + esc(value) + '</td></tr>';
    }

    // ─── Exports Tab ────────────────────────────────────────
    function renderExports(container) {
        const exp = peData.exports;
        if (!exp || exp.entries.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="icon">' + ICONS.method + '</div><div>No exports found in this file.</div></div>';
            return;
        }

        let html = '<div class="panel-header"><h2>' + esc(exp.dllName) + ' &mdash; ' + exp.entries.length + ' exports</h2>';
        html += '<div class="search-bar">' + ICONS.search + '<input type="text" class="search-input" placeholder="Filter exports..." id="export-search"></div></div>';
        html += '<div class="export-table-header"><span>Ordinal</span><span>Name</span><span>RVA</span><span>Info</span></div>';
        html += '<div class="export-list" id="export-list"></div>';
        container.innerHTML = html;

        const listEl = document.getElementById('export-list');
        const searchEl = document.getElementById('export-search');

        function renderExportRows(query) {
            const q = (query || '').toLowerCase();
            const filtered = exp.entries.filter(function(e) {
                if (!q) return true;
                return (e.name && e.name.toLowerCase().includes(q)) || String(e.ordinal).includes(q);
            });

            // Virtual scrolling for large lists
            if (filtered.length > 500) {
                renderVirtualExports(listEl, filtered);
            } else {
                let rows = '';
                filtered.forEach(function(e, i) {
                    rows += '<div class="export-row' + (i % 2 === 0 ? ' even' : '') + '">';
                    rows += '<span class="export-ordinal">' + e.ordinal + '</span>';
                    rows += '<span class="export-name">' + esc(e.name || '(by ordinal)') + '</span>';
                    rows += '<span class="export-rva">' + hex(e.rva) + '</span>';
                    rows += '<span class="export-info">';
                    if (e.isForwarded) rows += '<span class="export-fwd">&#x2192; ' + esc(e.forwardTarget || '') + '</span>';
                    rows += '</span></div>';
                });
                listEl.innerHTML = rows;
            }
        }

        renderExportRows('');

        let debounce;
        searchEl.addEventListener('input', function() {
            clearTimeout(debounce);
            debounce = setTimeout(function() { renderExportRows(searchEl.value); }, 120);
        });
    }

    function renderVirtualExports(container, entries) {
        const ROW_HEIGHT = 28;
        container.innerHTML = '';
        container.style.position = 'relative';

        const spacer = document.createElement('div');
        spacer.style.height = (entries.length * ROW_HEIGHT) + 'px';
        spacer.style.position = 'relative';
        container.appendChild(spacer);

        const visible = new Map();
        const scrollParent = container.closest('.tab-content');

        function update() {
            const scrollTop = scrollParent.scrollTop - container.offsetTop;
            const viewH = scrollParent.clientHeight;
            const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 5);
            const last = Math.min(entries.length, Math.ceil((scrollTop + viewH) / ROW_HEIGHT) + 5);

            for (const [idx, el] of visible) {
                if (idx < first || idx >= last) { el.remove(); visible.delete(idx); }
            }

            for (let i = first; i < last; i++) {
                if (visible.has(i)) continue;
                const e = entries[i];
                const row = document.createElement('div');
                row.className = 'export-row' + (i % 2 === 0 ? ' even' : '');
                row.style.position = 'absolute';
                row.style.top = (i * ROW_HEIGHT) + 'px';
                row.style.width = '100%';
                row.style.height = ROW_HEIGHT + 'px';
                row.innerHTML = '<span class="export-ordinal">' + e.ordinal + '</span>'
                    + '<span class="export-name">' + esc(e.name || '(by ordinal)') + '</span>'
                    + '<span class="export-rva">' + hex(e.rva) + '</span>'
                    + '<span class="export-info">' + (e.isForwarded ? '<span class="export-fwd">&#x2192; ' + esc(e.forwardTarget || '') + '</span>' : '') + '</span>';
                spacer.appendChild(row);
                visible.set(i, row);
            }
        }

        scrollParent.addEventListener('scroll', function() { requestAnimationFrame(update); });
        update();
    }

    // ─── Imports Tab ────────────────────────────────────────
    function renderImports(container) {
        const allImports = (peData.imports || []).concat(peData.delayImports || []);
        if (allImports.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="icon">' + ICONS.refs + '</div><div>No imports found in this file.</div></div>';
            return;
        }

        let html = '<div class="panel-header"><h2>' + allImports.length + ' imported DLLs</h2>';
        html += '<div class="search-bar">' + ICONS.search + '<input type="text" class="search-input" placeholder="Filter imports..." id="import-search"></div></div>';
        html += '<div id="import-list"></div>';
        container.innerHTML = html;

        const listEl = document.getElementById('import-list');
        const searchEl = document.getElementById('import-search');

        function renderGroups(query) {
            const q = (query || '').toLowerCase();
            let groups = '';
            allImports.forEach(function(imp, idx) {
                const matchesDll = !q || imp.dllName.toLowerCase().includes(q);
                const matchingEntries = imp.entries.filter(function(e) {
                    return !q || matchesDll || (e.name && e.name.toLowerCase().includes(q));
                });
                if (!matchesDll && matchingEntries.length === 0) return;

                const isOpen = expandedImports.has(idx) || (q && matchingEntries.length > 0);
                groups += '<div class="import-group">';
                groups += '<div class="import-group-header" data-idx="' + idx + '">';
                groups += '<span class="chevron' + (isOpen ? ' open' : '') + '">' + ICONS.chevron + '</span>';
                groups += '<span class="import-group-name">' + esc(imp.dllName) + '</span>';
                groups += '<span class="import-group-count">' + imp.entries.length + ' functions</span>';
                if (imp.isDelayLoad) groups += '<span class="import-group-badge">Delay Load</span>';
                groups += '</div>';
                groups += '<div class="import-entries' + (isOpen ? ' open' : '') + '" data-entries="' + idx + '">';

                const entriesToShow = q ? matchingEntries : imp.entries;
                entriesToShow.forEach(function(e) {
                    groups += '<div class="import-entry">';
                    if (e.isOrdinalImport) {
                        groups += '<span class="import-hint">#' + e.ordinal + '</span>';
                        groups += '<span>(by ordinal)</span>';
                    } else {
                        groups += '<span class="import-hint">' + e.hint + '</span>';
                        groups += '<span>' + esc(e.name || '') + '</span>';
                    }
                    groups += '</div>';
                });
                groups += '</div></div>';
            });
            listEl.innerHTML = groups;

            // Attach toggle handlers
            listEl.querySelectorAll('.import-group-header').forEach(function(el) {
                el.addEventListener('click', function() {
                    const idx = parseInt(el.getAttribute('data-idx'));
                    if (expandedImports.has(idx)) expandedImports.delete(idx);
                    else expandedImports.add(idx);
                    renderGroups(searchEl.value);
                });
            });
        }

        renderGroups('');

        let debounce;
        searchEl.addEventListener('input', function() {
            clearTimeout(debounce);
            debounce = setTimeout(function() { renderGroups(searchEl.value); }, 120);
        });
    }

    // ─── Dependencies Tab ───────────────────────────────────
    function renderDependencies(container) {
        if (!depTree) {
            container.innerHTML = '<div class="loading"><div class="spinner"></div><div id="dep-progress-text">Resolving dependency tree...</div></div>';
            return;
        }

        const tree = depTree;
        let html = '';

        // Summary bar
        html += '<div class="dep-summary">';
        html += '<div class="dep-stat"><span class="dep-stat-val">' + tree.totalModules + '</span><span class="dep-stat-label">Total Modules</span></div>';
        html += '<div class="dep-stat"><span class="dep-stat-val" style="color:var(--error)">' + tree.missingCount + '</span><span class="dep-stat-label">Missing</span></div>';
        html += '<div class="dep-stat"><span class="dep-stat-val" style="color:var(--warning)">' + tree.circularCount + '</span><span class="dep-stat-label">Circular</span></div>';
        html += '<div class="dep-stat"><span class="dep-stat-val">' + tree.maxDepth + '</span><span class="dep-stat-label">Max Depth</span></div>';
        html += '</div>';

        // First-level cards
        if (tree.root.children.length > 0) {
            html += '<div class="dep-section-title">Direct Dependencies (' + tree.root.children.length + ')</div>';
            html += '<div class="dep-card-grid">';
            tree.root.children.forEach(function(child) {
                let cls = 'dep-card';
                if (!child.module.resolvedPath) cls += ' missing';
                else if (child.module.isApiSet) cls += ' apiset';
                else if (child.isCircular) cls += ' circular';

                html += '<div class="' + cls + '">';
                html += '<div class="dep-card-header">';
                html += '<span class="dep-card-name">' + esc(child.module.name) + '</span>';
                if (!child.module.resolvedPath) html += '<span class="dep-card-badge missing-badge">Missing</span>';
                else if (child.module.isApiSet) html += '<span class="dep-card-badge apiset-badge">API Set</span>';
                else if (child.module.isSystem) html += '<span class="dep-card-badge system-badge">System</span>';
                html += '</div>';
                html += '<div class="dep-card-meta">';
                if (child.children.length > 0) html += '<span>' + child.children.length + ' deps</span>';
                html += '</div>';
                html += '<div class="dep-card-path' + (!child.module.resolvedPath ? ' missing-path' : '') + '">';
                html += esc(child.module.resolvedPath ? truncPath(child.module.resolvedPath, 55) : 'Not found on disk');
                html += '</div></div>';
            });
            html += '</div>';
        }

        // Full tree
        html += '<div class="dep-section-title">Full Dependency Tree</div>';
        html += '<div class="dep-tree-controls">';
        html += '<button class="tree-btn" id="expand-all-btn">Expand All</button>';
        html += '<button class="tree-btn" id="collapse-all-btn">Collapse All</button>';
        html += '<div class="search-bar dep-tree-search">' + ICONS.search + '<input type="text" class="search-input" placeholder="Search dependencies..." id="dep-search"></div>';
        html += '</div>';
        html += '<div class="dep-tree-list" id="dep-tree-list"></div>';
        container.innerHTML = html;

        // Render tree
        const treeEl = document.getElementById('dep-tree-list');
        const searchEl = document.getElementById('dep-search');

        function renderTreeNodes(nodes, parentPath, depth, filterQ) {
            let html = '';
            nodes.forEach(function(node) {
                const nodePath = parentPath + '/' + node.module.name.toLowerCase();
                const hasChildren = node.children.length > 0 && !node.isCircular;
                const isExpanded = expandedTreePaths.has(nodePath);

                // Filter
                if (filterQ) {
                    const matchesSelf = node.module.name.toLowerCase().includes(filterQ);
                    const matchesDescendant = hasDescendantMatch(node, filterQ);
                    if (!matchesSelf && !matchesDescendant) return;
                }

                html += '<div class="tree-node" data-path="' + esc(nodePath) + '" data-has-children="' + hasChildren + '" style="padding-left:' + (depth * 20 + 8) + 'px;">';
                html += '<span class="tree-toggle">';
                if (hasChildren) {
                    html += '<svg viewBox="0 0 16 16" class="svg-icon" style="transform:rotate(' + (isExpanded ? '90' : '0') + 'deg);transition:transform 0.15s"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
                }
                html += '</span>';

                // Icon
                let iconCls = 'tree-icon lib';
                if (!node.module.resolvedPath) iconCls = 'tree-icon warn';
                else if (node.module.isApiSet) iconCls = 'tree-icon api';
                else if (node.isCircular) iconCls = 'tree-icon circ';
                html += '<span class="' + iconCls + '">' + ICONS.lib + '</span>';

                html += '<span class="tree-name">' + esc(node.module.name) + '</span>';

                // Badges
                if (!node.module.resolvedPath) html += '<span class="tree-badge missing">Missing</span>';
                if (node.isCircular) html += '<span class="tree-badge circular">Circular</span>';
                if (node.module.isApiSet) html += '<span class="tree-badge apiset">API Set</span>';
                if (node.module.isSystem && node.module.resolvedPath) html += '<span class="tree-badge system">System</span>';
                if (node.children.length > 0 && !node.isCircular && !isExpanded) html += '<span class="tree-badge system">' + node.children.length + '</span>';

                html += '</div>';

                if (hasChildren && isExpanded) {
                    html += renderTreeNodes(node.children, nodePath, depth + 1, filterQ);
                }
            });
            return html;
        }

        function hasDescendantMatch(node, q) {
            if (!node.children) return false;
            for (const child of node.children) {
                if (child.module.name.toLowerCase().includes(q)) return true;
                if (hasDescendantMatch(child, q)) return true;
            }
            return false;
        }

        function collectAllPaths(nodes, parentPath, paths) {
            nodes.forEach(function(node) {
                if (node.children.length > 0 && !node.isCircular) {
                    const p = parentPath + '/' + node.module.name.toLowerCase();
                    paths.add(p);
                    collectAllPaths(node.children, p, paths);
                }
            });
        }

        function renderTree(filterQ) {
            treeEl.innerHTML = renderTreeNodes(tree.root.children, '', 0, filterQ);

            // Attach click handlers
            treeEl.querySelectorAll('.tree-node').forEach(function(el) {
                if (el.getAttribute('data-has-children') === 'true') {
                    el.addEventListener('click', function() {
                        const p = el.getAttribute('data-path');
                        if (expandedTreePaths.has(p)) expandedTreePaths.delete(p);
                        else expandedTreePaths.add(p);
                        renderTree(searchEl.value.toLowerCase().trim());
                    });
                }
            });
        }

        renderTree('');

        // Expand/Collapse all
        document.getElementById('expand-all-btn').addEventListener('click', function() {
            collectAllPaths(tree.root.children, '', expandedTreePaths);
            renderTree(searchEl.value.toLowerCase().trim());
        });
        document.getElementById('collapse-all-btn').addEventListener('click', function() {
            expandedTreePaths.clear();
            renderTree(searchEl.value.toLowerCase().trim());
        });

        // Search
        let debounce;
        searchEl.addEventListener('input', function() {
            clearTimeout(debounce);
            debounce = setTimeout(function() {
                const q = searchEl.value.toLowerCase().trim();
                if (q) {
                    // Auto-expand matching paths
                    expandedTreePaths.clear();
                    autoExpandMatches(tree.root.children, '', q);
                }
                renderTree(q);
            }, 150);
        });

        function autoExpandMatches(nodes, parentPath, q) {
            nodes.forEach(function(node) {
                const p = parentPath + '/' + node.module.name.toLowerCase();
                if (hasDescendantMatch(node, q)) {
                    expandedTreePaths.add(p);
                    autoExpandMatches(node.children, p, q);
                }
            });
        }
    }

    // ─── Sections Tab ───────────────────────────────────────
    function renderSections(container) {
        const secs = peData.sections;
        if (!secs || secs.length === 0) {
            container.innerHTML = '<div class="empty-state"><div class="icon">' + ICONS.layers + '</div><div>No sections found.</div></div>';
            return;
        }

        let html = '<table class="sections-table"><thead><tr>';
        html += '<th>Name</th><th>Virtual Size</th><th>Virtual Address</th><th>Raw Size</th><th>Raw Offset</th><th>Flags</th>';
        html += '</tr></thead><tbody>';

        secs.forEach(function(s) {
            html += '<tr>';
            html += '<td style="font-weight:600">' + esc(s.name) + '</td>';
            html += '<td>' + formatBytes(s.virtualSize) + '</td>';
            html += '<td>' + hex(s.virtualAddress) + '</td>';
            html += '<td>' + formatBytes(s.sizeOfRawData) + '</td>';
            html += '<td>' + hex(s.pointerToRawData) + '</td>';
            html += '<td><div class="section-flags">';
            s.characteristicFlags.forEach(function(f) {
                let cls = 'section-flag default';
                const fl = f.toLowerCase();
                if (fl === 'read') cls = 'section-flag read';
                else if (fl === 'write') cls = 'section-flag write';
                else if (fl === 'execute') cls = 'section-flag execute';
                else if (fl === 'code') cls = 'section-flag code';
                html += '<span class="' + cls + '">' + esc(f) + '</span>';
            });
            html += '</div></td></tr>';
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }

    // ─── Message Handling ───────────────────────────────────
    window.addEventListener('message', function(event) {
        const msg = event.data;
        switch (msg.type) {
            case 'peData':
                peData = msg.data;
                renderApp();
                break;
            case 'dependencyTree':
                depTree = msg.data;
                renderApp();
                break;
            case 'progress':
                const progEl = document.getElementById('dep-progress-text');
                if (progEl) {
                    progEl.textContent = 'Resolving: ' + msg.data.current + ' (' + msg.data.count + ' modules)';
                }
                break;
            case 'error':
                const app = document.getElementById('app');
                app.innerHTML = '<div class="empty-state"><div class="icon">' + ICONS.warn + '</div><div style="color:var(--error)">' + esc(msg.data.message) + '</div></div>';
                break;
        }
    });

    // Restore previous state
    const prev = vscode.getState();
    if (prev) {
        peData = prev.peData;
        depTree = prev.depTree;
        currentTab = prev.currentTab || 'overview';
        if (prev.expandedImports) expandedImports = new Set(prev.expandedImports);
        if (prev.expandedTreePaths) expandedTreePaths = new Set(prev.expandedTreePaths);
    }
    if (peData) renderApp();

    // Save state on changes
    const origRender = renderApp;
    renderApp = function() {
        origRender();
        vscode.setState({
            peData: peData,
            depTree: depTree,
            currentTab: currentTab,
            expandedImports: Array.from(expandedImports),
            expandedTreePaths: Array.from(expandedTreePaths),
        });
    };

    // Signal ready
    vscode.postMessage({ type: 'ready' });
})();
</script>
</body>
</html>`;
}

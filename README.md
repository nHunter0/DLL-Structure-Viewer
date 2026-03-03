<p align="center">
  <img src="media/icon.png" alt="DLL Structure Viewer" width="128" height="128">
</p>

<h1 align="center">DLL Structure Viewer</h1>

<p align="center">VS Code extension that opens DLL, EXE, and other PE files as a graphical structure view.</p>

---

## What it does

Click any `.dll`, `.exe`, `.sys`, `.ocx`, or `.drv` file in VS Code and it opens automatically in a structured viewer instead of a hex dump.

**5 tabs:**

- **Overview** — file size, machine type, entry point, image base, PE headers, characteristics, data directories
- **Exports** — searchable table of all exported functions with ordinals, RVAs, and forwarded targets
- **Imports** — grouped by source DLL, expandable, shows function names and hints
- **Dependencies** — full recursive dependency tree with first-level cards, expand/collapse all, search, circular reference detection, missing DLL indicators
- **Sections** — .text, .rdata, .data, etc. with virtual/raw sizes and permission flags (READ/WRITE/EXECUTE)

## Features

- Pure TypeScript PE parser — no native dependencies, no external tools
- Handles PE32 (32-bit) and PE32+ (64-bit)
- Recursive dependency resolution (searches System32, SysWOW64, application directory)
- Virtual scrolling for DLLs with thousands of exports
- Adapts to your VS Code theme (dark/light)

## Usage

- **Click** any DLL in the explorer sidebar — opens automatically
- **Right-click** a DLL → "View DLL Structure"
- **Ctrl+Shift+P** → "View DLL Structure" → pick a file

## Install

Search **"DLL Structure Viewer"** in the VS Code Extensions tab, or:

```
ext install nhunter0.dll-structure-viewer
```

## Requirements

- Windows (dependency resolution uses System32/SysWOW64 paths)
- VS Code 1.85+

<p align="center">
  <img src="media/icon.png" alt="DLL Structure Viewer" width="128" height="128">
</p>

<h1 align="center">DLL Structure Viewer</h1>

<p align="center">VS Code extension that opens DLL, EXE, SO, and other PE/ELF binary files as a graphical structure view.</p>

---

## What it does

Click any binary file in VS Code and it opens automatically in a structured viewer instead of a hex dump.

**Supported formats:**

| Format | Extensions |
|--------|-----------|
| **PE** (Windows) | `.dll` `.exe` `.sys` `.ocx` `.drv` `.cpl` `.scr` `.efi` `.mui` `.ax` |
| **ELF** (Linux) | `.so` `.so.*` `.ko` `.elf` `.axf` |

**5 tabs:**

- **Overview** — file info, machine type, entry point, headers, characteristics, data directories (PE) or program headers & dynamic info (ELF)
- **Exports** — searchable table of exported functions/symbols with ordinals, RVAs, bind type
- **Imports** — grouped by source library, expandable, shows function names and hints
- **Dependencies** — recursive dependency tree with cards, expand/collapse, search, circular reference and missing DLL detection (PE) or DT_NEEDED library list with full dynamic entries (ELF)
- **Sections** — all sections with sizes, addresses, offsets, and permission flags (READ/WRITE/EXECUTE)

## Features

- Pure TypeScript PE and ELF parsers — no native dependencies, no external tools
- Handles PE32 (32-bit) and PE32+ (64-bit)
- Handles ELF32 and ELF64, little and big endian
- Recursive dependency resolution for PE files (searches application directory, System32, SysWOW64, Windows directory, and PATH)
- API Set DLL detection (virtual redirections shown separately from missing dependencies)
- Virtual scrolling for binaries with thousands of exports
- Adapts to your VS Code theme (dark/light)

## Usage

- **Click** any supported file in the explorer sidebar — opens automatically
- **Right-click** a binary file → "View DLL Structure"
- **Ctrl+Shift+P** → "View DLL Structure" → pick a file

## Install

Search **"DLL Structure Viewer"** in the VS Code Extensions tab, or:

```
ext install nhunter0.dll-structure-viewer
```

## Requirements

- VS Code 1.85+
- Windows recommended for PE dependency resolution (ELF viewing works on any platform)

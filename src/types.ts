// ─── Binary Format Detection ────────────────────────────────────────────────

export type BinaryFormat = "pe" | "elf";

// ─── PE Format Types ────────────────────────────────────────────────────────

export interface DosHeader {
  e_magic: number;
  e_lfanew: number;
}

export interface CoffHeader {
  machine: number;
  machineDescription: string;
  numberOfSections: number;
  timeDateStamp: number;
  timeDateStampDate: string;
  pointerToSymbolTable: number;
  numberOfSymbols: number;
  sizeOfOptionalHeader: number;
  characteristics: number;
  characteristicFlags: string[];
}

export interface DataDirectory {
  name: string;
  virtualAddress: number;
  size: number;
}

export interface OptionalHeader {
  magic: number;
  isPE32Plus: boolean;
  linkerVersion: string;
  sizeOfCode: number;
  sizeOfInitializedData: number;
  sizeOfUninitializedData: number;
  entryPoint: number;
  baseOfCode: number;
  imageBase: string; // hex string for serialization (bigint in PE32+)
  sectionAlignment: number;
  fileAlignment: number;
  osVersion: string;
  imageVersion: string;
  subsystemVersion: string;
  sizeOfImage: number;
  sizeOfHeaders: number;
  checkSum: number;
  subsystem: number;
  subsystemDescription: string;
  dllCharacteristics: number;
  dllCharacteristicFlags: string[];
  numberOfRvaAndSizes: number;
  dataDirectories: DataDirectory[];
}

export interface SectionHeader {
  name: string;
  virtualSize: number;
  virtualAddress: number;
  sizeOfRawData: number;
  pointerToRawData: number;
  pointerToRelocations: number;
  numberOfRelocations: number;
  characteristics: number;
  characteristicFlags: string[];
}

export interface ExportEntry {
  ordinal: number;
  name: string | null;
  rva: number;
  isForwarded: boolean;
  forwardTarget: string | null;
}

export interface ExportDirectory {
  dllName: string;
  ordinalBase: number;
  numberOfFunctions: number;
  numberOfNames: number;
  entries: ExportEntry[];
  timeDateStamp: number;
}

export interface ImportEntry {
  name: string | null;
  hint: number;
  ordinal: number | null;
  isOrdinalImport: boolean;
}

export interface ImportDescriptor {
  dllName: string;
  entries: ImportEntry[];
  isDelayLoad: boolean;
  isRuntime?: boolean;
  timeDateStamp: number;
}

export interface ParseError {
  stage: string;
  message: string;
  offset?: number;
}

export interface PeFile {
  filePath: string;
  fileName: string;
  fileSize: number;
  dosHeader: DosHeader;
  coffHeader: CoffHeader;
  optionalHeader: OptionalHeader;
  sections: SectionHeader[];
  exports: ExportDirectory | null;
  imports: ImportDescriptor[];
  delayImports: ImportDescriptor[];
  runtimeDependencies: string[];
  errors: ParseError[];
}

// ─── ELF Format Types ───────────────────────────────────────────────────────

export interface ElfHeader {
  class: number;
  classDescription: string;
  data: number;
  dataDescription: string;
  version: number;
  osabi: number;
  osabiDescription: string;
  type: number;
  typeDescription: string;
  machine: number;
  machineDescription: string;
  entryPoint: string;
  phoff: number;
  shoff: number;
  flags: number;
  ehsize: number;
  phentsize: number;
  phnum: number;
  shentsize: number;
  shnum: number;
  shstrndx: number;
}

export interface ElfSectionHeader {
  nameIndex: number;
  name: string;
  type: number;
  typeDescription: string;
  flags: number;
  flagNames: string[];
  addr: string;
  offset: number;
  size: number;
  link: number;
  info: number;
  addralign: number;
  entsize: number;
}

export interface ElfProgramHeader {
  type: number;
  typeDescription: string;
  offset: number;
  vaddr: string;
  paddr: string;
  filesz: number;
  memsz: number;
  flags: number;
  flagNames: string[];
  align: number;
}

export interface ElfSymbol {
  name: string;
  value: string;
  size: number;
  bind: string;
  type: string;
  visibility: string;
  sectionIndex: number;
  sectionName: string;
}

export interface ElfDynamicEntry {
  tag: number;
  tagName: string;
  value: string;
}

export interface ElfFile {
  filePath: string;
  fileName: string;
  fileSize: number;
  header: ElfHeader;
  sections: ElfSectionHeader[];
  exports: ElfSymbol[];
  imports: ElfSymbol[];
  neededLibraries: string[];
  dynamicEntries: ElfDynamicEntry[];
  soname: string | null;
  programHeaders: ElfProgramHeader[];
  errors: ParseError[];
}

// ─── Dependency Tree Types ──────────────────────────────────────────────────

export interface ResolvedModule {
  name: string;
  resolvedPath: string | null;
  isSystem: boolean;
  isApiSet: boolean;
}

export interface DependencyNode {
  module: ResolvedModule;
  children: DependencyNode[];
  isCircular: boolean;
  depth: number;
}

export interface DependencyTree {
  root: DependencyNode;
  totalModules: number;
  missingCount: number;
  circularCount: number;
  maxDepth: number;
}

// ─── Message Types (Extension <-> Webview) ──────────────────────────────────

export type ExtensionMessage =
  | { type: "peData"; data: PeFile }
  | { type: "elfData"; data: ElfFile }
  | { type: "dependencyTree"; data: DependencyTree }
  | { type: "progress"; data: { current: string; count: number } }
  | { type: "error"; data: { message: string } };

export type WebviewMessage =
  | { type: "ready" }
  | { type: "requestDependencyTree" };

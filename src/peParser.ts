import * as fs from 'fs';
import * as path from 'path';
import {
    DosHeader, CoffHeader, OptionalHeader, DataDirectory,
    SectionHeader, ExportDirectory, ExportEntry,
    ImportDescriptor, ImportEntry, PeFile, ParseError
} from './types';

// ─── Binary Reader ──────────────────────────────────────────────────────────

class BinaryReader {
    private buf: Buffer;
    private pos: number;

    constructor(buf: Buffer, offset = 0) {
        this.buf = buf;
        this.pos = offset;
    }

    get offset(): number { return this.pos; }
    get length(): number { return this.buf.length; }

    seek(offset: number): void {
        if (offset < 0 || offset > this.buf.length) {
            throw new Error(`Seek out of bounds: ${offset} (file size: ${this.buf.length})`);
        }
        this.pos = offset;
    }

    skip(bytes: number): void { this.pos += bytes; }

    hasBytes(n: number): boolean {
        return this.pos + n <= this.buf.length;
    }

    u8(): number {
        if (!this.hasBytes(1)) throw new Error(`Read u8 past end at offset ${this.pos}`);
        return this.buf[this.pos++];
    }

    u16(): number {
        if (!this.hasBytes(2)) throw new Error(`Read u16 past end at offset ${this.pos}`);
        const v = this.buf.readUInt16LE(this.pos);
        this.pos += 2;
        return v;
    }

    u32(): number {
        if (!this.hasBytes(4)) throw new Error(`Read u32 past end at offset ${this.pos}`);
        const v = this.buf.readUInt32LE(this.pos);
        this.pos += 4;
        return v;
    }

    u64(): bigint {
        if (!this.hasBytes(8)) throw new Error(`Read u64 past end at offset ${this.pos}`);
        const v = this.buf.readBigUInt64LE(this.pos);
        this.pos += 8;
        return v;
    }

    bytes(n: number): Buffer {
        if (!this.hasBytes(n)) throw new Error(`Read ${n} bytes past end at offset ${this.pos}`);
        const slice = this.buf.subarray(this.pos, this.pos + n);
        this.pos += n;
        return slice;
    }

    asciiZ(maxLen = 256): string {
        let end = this.pos;
        const limit = Math.min(this.pos + maxLen, this.buf.length);
        while (end < limit && this.buf[end] !== 0) end++;
        const str = this.buf.toString('ascii', this.pos, end);
        this.pos = end + 1;
        return str;
    }

    asciiFixed(len: number): string {
        const raw = this.bytes(len);
        const nullIdx = raw.indexOf(0);
        return raw.toString('ascii', 0, nullIdx >= 0 ? nullIdx : len);
    }
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MZ_MAGIC = 0x5A4D;
const PE_SIGNATURE = 0x00004550;

const MACHINE_TYPES: Record<number, string> = {
    0x0: 'Unknown', 0x14c: 'x86 (i386)', 0x166: 'MIPS R4000',
    0x1a2: 'Hitachi SH3', 0x1a6: 'Hitachi SH4', 0x1c0: 'ARM',
    0x1c4: 'ARM Thumb-2', 0x8664: 'x64 (AMD64)', 0xaa64: 'ARM64',
    0x5032: 'RISC-V 32', 0x5064: 'RISC-V 64', 0x5128: 'RISC-V 128',
};

const SUBSYSTEM_TYPES: Record<number, string> = {
    0: 'Unknown', 1: 'Native', 2: 'Windows GUI', 3: 'Windows Console',
    5: 'OS/2 Console', 7: 'POSIX Console', 9: 'Windows CE',
    10: 'EFI Application', 11: 'EFI Boot Service Driver',
    12: 'EFI Runtime Driver', 13: 'EFI ROM', 14: 'Xbox',
    16: 'Windows Boot Application',
};

const COFF_CHARACTERISTICS: Record<number, string> = {
    0x0001: 'RELOCS_STRIPPED', 0x0002: 'EXECUTABLE_IMAGE',
    0x0004: 'LINE_NUMS_STRIPPED', 0x0008: 'LOCAL_SYMS_STRIPPED',
    0x0020: 'LARGE_ADDRESS_AWARE', 0x0080: 'BYTES_REVERSED_LO',
    0x0100: '32BIT_MACHINE', 0x0200: 'DEBUG_STRIPPED',
    0x0400: 'REMOVABLE_RUN_FROM_SWAP', 0x0800: 'NET_RUN_FROM_SWAP',
    0x1000: 'SYSTEM', 0x2000: 'DLL',
    0x4000: 'UP_SYSTEM_ONLY', 0x8000: 'BYTES_REVERSED_HI',
};

const DLL_CHARACTERISTICS: Record<number, string> = {
    0x0020: 'HIGH_ENTROPY_VA', 0x0040: 'DYNAMIC_BASE',
    0x0080: 'FORCE_INTEGRITY', 0x0100: 'NX_COMPAT',
    0x0200: 'NO_ISOLATION', 0x0400: 'NO_SEH',
    0x0800: 'NO_BIND', 0x1000: 'APPCONTAINER',
    0x2000: 'WDM_DRIVER', 0x4000: 'GUARD_CF',
    0x8000: 'TERMINAL_SERVER_AWARE',
};

const SECTION_CHARACTERISTICS: Record<number, string> = {
    0x00000020: 'CODE', 0x00000040: 'INITIALIZED_DATA',
    0x00000080: 'UNINITIALIZED_DATA', 0x00000200: 'INFO',
    0x02000000: 'DISCARDABLE', 0x04000000: 'NOT_CACHED',
    0x08000000: 'NOT_PAGED', 0x10000000: 'SHARED',
    0x20000000: 'EXECUTE', 0x40000000: 'READ',
    0x80000000: 'WRITE',
};

const DATA_DIR_NAMES = [
    'Export Table', 'Import Table', 'Resource Table', 'Exception Table',
    'Certificate Table', 'Base Relocation Table', 'Debug', 'Architecture',
    'Global Pointer', 'TLS Table', 'Load Config Table', 'Bound Import',
    'IAT', 'Delay Import Descriptor', 'CLR Runtime Header', 'Reserved',
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function decodeFlags(value: number, table: Record<number, string>): string[] {
    const flags: string[] = [];
    for (const [bit, name] of Object.entries(table)) {
        if (value & Number(bit)) flags.push(name);
    }
    return flags;
}

function rvaToOffset(rva: number, sections: SectionHeader[]): number | null {
    for (const sec of sections) {
        // PE spec: if virtualSize is 0, use sizeOfRawData as the section extent
        const effectiveSize = sec.virtualSize || sec.sizeOfRawData;
        if (rva >= sec.virtualAddress && rva < sec.virtualAddress + effectiveSize) {
            return rva - sec.virtualAddress + sec.pointerToRawData;
        }
    }
    return null;
}

// ─── Parsers ────────────────────────────────────────────────────────────────

function parseDosHeader(r: BinaryReader): DosHeader {
    r.seek(0);
    const e_magic = r.u16();
    if (e_magic !== MZ_MAGIC) {
        throw new Error('Not a valid PE file (missing MZ signature)');
    }
    r.seek(0x3C);
    const e_lfanew = r.u32();
    return { e_magic, e_lfanew };
}

function parseCoffHeader(r: BinaryReader, peOffset: number): CoffHeader {
    r.seek(peOffset);
    const sig = r.u32();
    if (sig !== PE_SIGNATURE) {
        throw new Error('Invalid PE signature');
    }
    const machine = r.u16();
    const numberOfSections = r.u16();
    const timeDateStamp = r.u32();
    const pointerToSymbolTable = r.u32();
    const numberOfSymbols = r.u32();
    const sizeOfOptionalHeader = r.u16();
    const characteristics = r.u16();

    return {
        machine,
        machineDescription: MACHINE_TYPES[machine] || `Unknown (0x${machine.toString(16)})`,
        numberOfSections,
        timeDateStamp,
        timeDateStampDate: timeDateStamp > 0
            ? new Date(timeDateStamp * 1000).toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')
            : 'N/A',
        pointerToSymbolTable,
        numberOfSymbols,
        sizeOfOptionalHeader,
        characteristics,
        characteristicFlags: decodeFlags(characteristics, COFF_CHARACTERISTICS),
    };
}

function parseOptionalHeader(r: BinaryReader, offset: number, size: number): OptionalHeader {
    r.seek(offset);
    const magic = r.u16();
    const isPE32Plus = magic === 0x20B;

    const majorLinker = r.u8();
    const minorLinker = r.u8();
    const sizeOfCode = r.u32();
    const sizeOfInitializedData = r.u32();
    const sizeOfUninitializedData = r.u32();
    const entryPoint = r.u32();
    const baseOfCode = r.u32();

    let imageBase: bigint;
    if (isPE32Plus) {
        imageBase = r.u64();
    } else {
        r.u32(); // baseOfData (PE32 only)
        imageBase = BigInt(r.u32());
    }

    const sectionAlignment = r.u32();
    const fileAlignment = r.u32();
    const majorOSVer = r.u16();
    const minorOSVer = r.u16();
    const majorImageVer = r.u16();
    const minorImageVer = r.u16();
    const majorSubsystemVer = r.u16();
    const minorSubsystemVer = r.u16();
    r.u32(); // Win32VersionValue
    const sizeOfImage = r.u32();
    const sizeOfHeaders = r.u32();
    const checkSum = r.u32();
    const subsystem = r.u16();
    const dllCharacteristics = r.u16();

    // Stack/Heap sizes - skip (different size for PE32 vs PE32+)
    if (isPE32Plus) {
        r.skip(32); // 4 x u64
    } else {
        r.skip(16); // 4 x u32
    }

    r.u32(); // LoaderFlags
    const numberOfRvaAndSizes = r.u32();

    // Data directories
    const dataDirectories: DataDirectory[] = [];
    const dirCount = Math.min(numberOfRvaAndSizes, 16);
    for (let i = 0; i < dirCount; i++) {
        const virtualAddress = r.u32();
        const dirSize = r.u32();
        dataDirectories.push({
            name: DATA_DIR_NAMES[i] || `Directory ${i}`,
            virtualAddress,
            size: dirSize,
        });
    }

    return {
        magic,
        isPE32Plus,
        linkerVersion: `${majorLinker}.${minorLinker}`,
        sizeOfCode,
        sizeOfInitializedData,
        sizeOfUninitializedData,
        entryPoint,
        baseOfCode,
        imageBase: '0x' + imageBase.toString(16).toUpperCase(),
        sectionAlignment,
        fileAlignment,
        osVersion: `${majorOSVer}.${minorOSVer}`,
        imageVersion: `${majorImageVer}.${minorImageVer}`,
        subsystemVersion: `${majorSubsystemVer}.${minorSubsystemVer}`,
        sizeOfImage,
        sizeOfHeaders,
        checkSum,
        subsystem,
        subsystemDescription: SUBSYSTEM_TYPES[subsystem] || `Unknown (${subsystem})`,
        dllCharacteristics,
        dllCharacteristicFlags: decodeFlags(dllCharacteristics, DLL_CHARACTERISTICS),
        numberOfRvaAndSizes,
        dataDirectories,
    };
}

function parseSectionHeaders(r: BinaryReader, offset: number, count: number): SectionHeader[] {
    r.seek(offset);
    const sections: SectionHeader[] = [];
    for (let i = 0; i < count; i++) {
        const name = r.asciiFixed(8);
        const virtualSize = r.u32();
        const virtualAddress = r.u32();
        const sizeOfRawData = r.u32();
        const pointerToRawData = r.u32();
        const pointerToRelocations = r.u32();
        r.u32(); // pointerToLineNumbers
        const numberOfRelocations = r.u16();
        r.u16(); // numberOfLineNumbers
        const characteristics = r.u32();
        sections.push({
            name, virtualSize, virtualAddress,
            sizeOfRawData, pointerToRawData,
            pointerToRelocations, numberOfRelocations,
            characteristics,
            characteristicFlags: decodeFlags(characteristics, SECTION_CHARACTERISTICS),
        });
    }
    return sections;
}

function parseExports(
    r: BinaryReader,
    exportDir: DataDirectory,
    sections: SectionHeader[]
): ExportDirectory | null {
    if (exportDir.virtualAddress === 0 || exportDir.size === 0) return null;

    const offset = rvaToOffset(exportDir.virtualAddress, sections);
    if (offset === null) return null;

    r.seek(offset);
    r.u32(); // ExportFlags
    const timeDateStamp = r.u32();
    r.u16(); // MajorVersion
    r.u16(); // MinorVersion
    const nameRva = r.u32();
    const ordinalBase = r.u32();
    const addressTableEntries = r.u32();
    const numberOfNamePointers = r.u32();
    const exportAddressTableRva = r.u32();
    const namePointerRva = r.u32();
    const ordinalTableRva = r.u32();

    // Read DLL name
    let dllName = '';
    const nameFileOff = rvaToOffset(nameRva, sections);
    if (nameFileOff !== null) {
        r.seek(nameFileOff);
        dllName = r.asciiZ(256);
    }

    // Read ordinal table
    const ordinals: number[] = [];
    const ordTableOff = rvaToOffset(ordinalTableRva, sections);
    if (ordTableOff !== null) {
        r.seek(ordTableOff);
        for (let i = 0; i < numberOfNamePointers; i++) {
            ordinals.push(r.u16());
        }
    }

    // Read name pointer table
    const nameRvas: number[] = [];
    const namePtrOff = rvaToOffset(namePointerRva, sections);
    if (namePtrOff !== null) {
        r.seek(namePtrOff);
        for (let i = 0; i < numberOfNamePointers; i++) {
            nameRvas.push(r.u32());
        }
    }

    // Read export address table
    const addresses: number[] = [];
    const eatOff = rvaToOffset(exportAddressTableRva, sections);
    if (eatOff !== null) {
        r.seek(eatOff);
        for (let i = 0; i < addressTableEntries; i++) {
            addresses.push(r.u32());
        }
    }

    // Build name-to-ordinal map
    const nameByOrdinal = new Map<number, string>();
    for (let i = 0; i < nameRvas.length; i++) {
        const nOff = rvaToOffset(nameRvas[i], sections);
        if (nOff !== null) {
            r.seek(nOff);
            nameByOrdinal.set(ordinals[i], r.asciiZ(512));
        }
    }

    // Build export entries
    const entries: ExportEntry[] = [];
    const exportDirEnd = exportDir.virtualAddress + exportDir.size;

    for (let i = 0; i < addressTableEntries; i++) {
        const rva = addresses[i];
        if (rva === 0) continue;

        const ordinal = ordinalBase + i;
        const name = nameByOrdinal.get(i) || null;

        // Check if forwarded (RVA points within export directory)
        const isForwarded = rva >= exportDir.virtualAddress && rva < exportDirEnd;
        let forwardTarget: string | null = null;
        if (isForwarded) {
            const fwdOff = rvaToOffset(rva, sections);
            if (fwdOff !== null) {
                r.seek(fwdOff);
                forwardTarget = r.asciiZ(256);
            }
        }

        entries.push({ ordinal, name, rva, isForwarded, forwardTarget });
    }

    // Sort by ordinal
    entries.sort((a, b) => a.ordinal - b.ordinal);

    return {
        dllName, ordinalBase,
        numberOfFunctions: addressTableEntries,
        numberOfNames: numberOfNamePointers,
        entries, timeDateStamp,
    };
}

function parseImportLookupTable(
    r: BinaryReader,
    iltRva: number,
    sections: SectionHeader[],
    isPE32Plus: boolean
): ImportEntry[] {
    const offset = rvaToOffset(iltRva, sections);
    if (offset === null) return [];

    r.seek(offset);
    const entries: ImportEntry[] = [];

    while (true) {
        let value: bigint;
        if (isPE32Plus) {
            if (!r.hasBytes(8)) break;
            value = r.u64();
        } else {
            if (!r.hasBytes(4)) break;
            value = BigInt(r.u32());
        }
        if (value === 0n) break;

        const ordinalFlag = isPE32Plus ? 0x8000000000000000n : 0x80000000n;
        const isOrdinalImport = (value & ordinalFlag) !== 0n;

        if (isOrdinalImport) {
            const ordinal = Number(value & 0xFFFFn);
            entries.push({
                name: null,
                hint: 0,
                ordinal,
                isOrdinalImport: true,
            });
        } else {
            const hintRva = Number(value & 0x7FFFFFFFn);
            const hintOffset = rvaToOffset(hintRva, sections);
            if (hintOffset !== null) {
                const savedPos = r.offset;
                r.seek(hintOffset);
                const hint = r.u16();
                const name = r.asciiZ(512);
                r.seek(savedPos);
                entries.push({
                    name,
                    hint,
                    ordinal: null,
                    isOrdinalImport: false,
                });
            }
        }
    }

    return entries;
}

function parseImports(
    r: BinaryReader,
    importDir: DataDirectory,
    sections: SectionHeader[],
    isPE32Plus: boolean
): ImportDescriptor[] {
    if (importDir.virtualAddress === 0 || importDir.size === 0) return [];

    const offset = rvaToOffset(importDir.virtualAddress, sections);
    if (offset === null) return [];

    const descriptors: ImportDescriptor[] = [];
    let current = offset;

    for (let safety = 0; safety < 1000; safety++) {
        if (current + 20 > r.length) break;
        r.seek(current);

        const iltRva = r.u32();
        const timeDateStamp = r.u32();
        r.u32(); // ForwarderChain
        const nameRva = r.u32();
        const iatRva = r.u32();

        // Terminator
        if (iltRva === 0 && nameRva === 0 && iatRva === 0) break;

        // Read DLL name
        let dllName = '';
        const nameOff = rvaToOffset(nameRva, sections);
        if (nameOff !== null) {
            r.seek(nameOff);
            dllName = r.asciiZ(256);
        }

        // Parse ILT (prefer OriginalFirstThunk, fall back to FirstThunk)
        const lookupRva = iltRva !== 0 ? iltRva : iatRva;
        const entries = parseImportLookupTable(r, lookupRva, sections, isPE32Plus);

        descriptors.push({
            dllName,
            entries,
            isDelayLoad: false,
            timeDateStamp,
        });

        current += 20;
    }

    return descriptors;
}

function parseDelayImports(
    r: BinaryReader,
    delayDir: DataDirectory,
    sections: SectionHeader[],
    isPE32Plus: boolean
): ImportDescriptor[] {
    if (delayDir.virtualAddress === 0 || delayDir.size === 0) return [];

    const offset = rvaToOffset(delayDir.virtualAddress, sections);
    if (offset === null) return [];

    const descriptors: ImportDescriptor[] = [];
    let current = offset;

    for (let safety = 0; safety < 1000; safety++) {
        r.seek(current);
        const attrs = r.u32();
        const nameRva = r.u32();
        r.u32(); // ModuleHandleRva
        const iatRva = r.u32();
        const iltRva = r.u32();

        if (nameRva === 0) break;

        let dllName = '';
        const nameOff = rvaToOffset(nameRva, sections);
        if (nameOff !== null) {
            r.seek(nameOff);
            dllName = r.asciiZ(256);
        }

        const lookupRva = iltRva !== 0 ? iltRva : iatRva;
        const entries = lookupRva !== 0
            ? parseImportLookupTable(r, lookupRva, sections, isPE32Plus)
            : [];

        descriptors.push({
            dllName,
            entries,
            isDelayLoad: true,
            timeDateStamp: 0,
        });

        current += 32; // sizeof(ImgDelayDescr)
    }

    return descriptors;
}

// ─── Main Parser ────────────────────────────────────────────────────────────

export function parsePeFile(filePath: string): PeFile {
    const buf = fs.readFileSync(filePath);
    const r = new BinaryReader(buf);
    const errors: ParseError[] = [];
    const fileName = path.basename(filePath);

    // DOS Header
    const dosHeader = parseDosHeader(r);

    // COFF Header
    const coffHeader = parseCoffHeader(r, dosHeader.e_lfanew);

    // Optional Header
    const optHeaderOffset = dosHeader.e_lfanew + 4 + 20;
    const optionalHeader = parseOptionalHeader(r, optHeaderOffset, coffHeader.sizeOfOptionalHeader);

    // Section Headers
    const sectionOffset = optHeaderOffset + coffHeader.sizeOfOptionalHeader;
    const sections = parseSectionHeaders(r, sectionOffset, coffHeader.numberOfSections);

    // Exports
    let exports: ExportDirectory | null = null;
    try {
        if (optionalHeader.dataDirectories.length > 0) {
            exports = parseExports(r, optionalHeader.dataDirectories[0], sections);
        }
    } catch (e: any) {
        errors.push({ stage: 'exports', message: e.message });
    }

    // Imports
    let imports: ImportDescriptor[] = [];
    try {
        if (optionalHeader.dataDirectories.length > 1) {
            imports = parseImports(r, optionalHeader.dataDirectories[1], sections, optionalHeader.isPE32Plus);
        }
    } catch (e: any) {
        errors.push({ stage: 'imports', message: e.message });
    }

    // Delay Imports
    let delayImports: ImportDescriptor[] = [];
    try {
        if (optionalHeader.dataDirectories.length > 13) {
            delayImports = parseDelayImports(r, optionalHeader.dataDirectories[13], sections, optionalHeader.isPE32Plus);
        }
    } catch (e: any) {
        errors.push({ stage: 'delayImports', message: e.message });
    }

    return {
        filePath, fileName,
        fileSize: buf.length,
        dosHeader, coffHeader, optionalHeader,
        sections, exports, imports, delayImports,
        errors,
    };
}

/** Parse only the import table of a PE file (lighter weight for dependency resolution) */
export function parseImportNames(filePath: string): string[] {
    try {
        const buf = fs.readFileSync(filePath);
        const r = new BinaryReader(buf);

        const dosHeader = parseDosHeader(r);
        const coffHeader = parseCoffHeader(r, dosHeader.e_lfanew);
        const optHeaderOffset = dosHeader.e_lfanew + 4 + 20;
        const optionalHeader = parseOptionalHeader(r, optHeaderOffset, coffHeader.sizeOfOptionalHeader);
        const sectionOffset = optHeaderOffset + coffHeader.sizeOfOptionalHeader;
        const sections = parseSectionHeaders(r, sectionOffset, coffHeader.numberOfSections);

        const names: string[] = [];

        if (optionalHeader.dataDirectories.length > 1) {
            const imports = parseImports(r, optionalHeader.dataDirectories[1], sections, optionalHeader.isPE32Plus);
            for (const imp of imports) {
                if (imp.dllName) names.push(imp.dllName);
            }
        }

        if (optionalHeader.dataDirectories.length > 13) {
            const delayImps = parseDelayImports(r, optionalHeader.dataDirectories[13], sections, optionalHeader.isPE32Plus);
            for (const imp of delayImps) {
                if (imp.dllName) names.push(imp.dllName);
            }
        }

        return names;
    } catch {
        return [];
    }
}

import * as fs from 'fs';
import * as path from 'path';
import {
    ElfFile, ElfHeader, ElfSectionHeader, ElfProgramHeader,
    ElfSymbol, ElfDynamicEntry, ParseError
} from './types';

// ─── Binary Reader with Endianness ──────────────────────────────────────────

class BinaryReader {
    private buf: Buffer;
    private pos: number;
    private le: boolean;

    constructor(buf: Buffer, littleEndian = true, offset = 0) {
        this.buf = buf;
        this.le = littleEndian;
        this.pos = offset;
    }

    get offset(): number { return this.pos; }
    get length(): number { return this.buf.length; }

    setEndianness(littleEndian: boolean): void { this.le = littleEndian; }

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
        const v = this.le ? this.buf.readUInt16LE(this.pos) : this.buf.readUInt16BE(this.pos);
        this.pos += 2;
        return v;
    }

    u32(): number {
        if (!this.hasBytes(4)) throw new Error(`Read u32 past end at offset ${this.pos}`);
        const v = this.le ? this.buf.readUInt32LE(this.pos) : this.buf.readUInt32BE(this.pos);
        this.pos += 4;
        return v;
    }

    i32(): number {
        if (!this.hasBytes(4)) throw new Error(`Read i32 past end at offset ${this.pos}`);
        const v = this.le ? this.buf.readInt32LE(this.pos) : this.buf.readInt32BE(this.pos);
        this.pos += 4;
        return v;
    }

    u64(): bigint {
        if (!this.hasBytes(8)) throw new Error(`Read u64 past end at offset ${this.pos}`);
        const v = this.le ? this.buf.readBigUInt64LE(this.pos) : this.buf.readBigUInt64BE(this.pos);
        this.pos += 8;
        return v;
    }

    i64(): bigint {
        if (!this.hasBytes(8)) throw new Error(`Read i64 past end at offset ${this.pos}`);
        const v = this.le ? this.buf.readBigInt64LE(this.pos) : this.buf.readBigInt64BE(this.pos);
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

    /** Read a null-terminated string from a string table at the given offset */
    stringAt(tableOffset: number, tableSize: number, nameOffset: number): string {
        const abs = tableOffset + nameOffset;
        if (abs < 0 || abs >= this.buf.length) return '';
        let end = abs;
        const limit = Math.min(tableOffset + tableSize, this.buf.length);
        while (end < limit && this.buf[end] !== 0) end++;
        return this.buf.toString('utf8', abs, end);
    }
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ELF_MAGIC = [0x7f, 0x45, 0x4c, 0x46]; // \x7fELF

const ELF_CLASS: Record<number, string> = {
    0: 'None', 1: '32-bit (ELF32)', 2: '64-bit (ELF64)',
};

const ELF_DATA: Record<number, string> = {
    0: 'None', 1: 'Little Endian', 2: 'Big Endian',
};

const ELF_OSABI: Record<number, string> = {
    0: 'System V', 1: 'HP-UX', 2: 'NetBSD', 3: 'Linux',
    6: 'Solaris', 7: 'AIX', 8: 'IRIX', 9: 'FreeBSD',
    10: 'Tru64', 11: 'Modesto', 12: 'OpenBSD',
    64: 'ARM EABI', 97: 'ARM', 255: 'Standalone',
};

const ELF_TYPE: Record<number, string> = {
    0: 'None', 1: 'Relocatable', 2: 'Executable',
    3: 'Shared Object', 4: 'Core Dump',
};

const ELF_MACHINE: Record<number, string> = {
    0: 'None', 2: 'SPARC', 3: 'x86 (i386)',
    8: 'MIPS', 20: 'PowerPC', 21: 'PowerPC64',
    40: 'ARM', 43: 'SPARC V9', 62: 'x86-64 (AMD64)',
    183: 'AArch64 (ARM64)', 243: 'RISC-V',
};

// Section types
const SHT_NULL = 0;
const SHT_PROGBITS = 1;
const SHT_SYMTAB = 2;
const SHT_STRTAB = 3;
const SHT_RELA = 4;
const SHT_HASH = 5;
const SHT_DYNAMIC = 6;
const SHT_NOTE = 7;
const SHT_NOBITS = 8;
const SHT_REL = 9;
const SHT_DYNSYM = 11;
const SHT_INIT_ARRAY = 14;
const SHT_FINI_ARRAY = 15;
const SHT_GNU_HASH = 0x6ffffff6;
const SHT_GNU_VERSYM = 0x6fffffff;
const SHT_GNU_VERNEED = 0x6ffffffe;
const SHT_GNU_VERDEF = 0x6ffffffd;

const SHT_NAMES: Record<number, string> = {
    [SHT_NULL]: 'NULL', [SHT_PROGBITS]: 'PROGBITS', [SHT_SYMTAB]: 'SYMTAB',
    [SHT_STRTAB]: 'STRTAB', [SHT_RELA]: 'RELA', [SHT_HASH]: 'HASH',
    [SHT_DYNAMIC]: 'DYNAMIC', [SHT_NOTE]: 'NOTE', [SHT_NOBITS]: 'NOBITS',
    [SHT_REL]: 'REL', [SHT_DYNSYM]: 'DYNSYM',
    [SHT_INIT_ARRAY]: 'INIT_ARRAY', [SHT_FINI_ARRAY]: 'FINI_ARRAY',
    [SHT_GNU_HASH]: 'GNU_HASH',
    [SHT_GNU_VERSYM]: 'GNU_VERSYM',
    [SHT_GNU_VERNEED]: 'GNU_VERNEED',
    [SHT_GNU_VERDEF]: 'GNU_VERDEF',
};

// Section flags
const SHF_WRITE = 0x1;
const SHF_ALLOC = 0x2;
const SHF_EXECINSTR = 0x4;
const SHF_MERGE = 0x10;
const SHF_STRINGS = 0x20;
const SHF_INFO_LINK = 0x40;
const SHF_TLS = 0x400;

const SHF_TABLE: Record<number, string> = {
    [SHF_WRITE]: 'WRITE', [SHF_ALLOC]: 'ALLOC', [SHF_EXECINSTR]: 'EXECUTE',
    [SHF_MERGE]: 'MERGE', [SHF_STRINGS]: 'STRINGS', [SHF_INFO_LINK]: 'INFO_LINK',
    [SHF_TLS]: 'TLS',
};

// Program header types
const PT_NAMES: Record<number, string> = {
    0: 'NULL', 1: 'LOAD', 2: 'DYNAMIC', 3: 'INTERP',
    4: 'NOTE', 5: 'SHLIB', 6: 'PHDR', 7: 'TLS',
    0x6474e550: 'GNU_EH_FRAME', 0x6474e551: 'GNU_STACK',
    0x6474e552: 'GNU_RELRO', 0x6474e553: 'GNU_PROPERTY',
};

// Program header flags
const PF_X = 0x1;
const PF_W = 0x2;
const PF_R = 0x4;

// Symbol binding
const STB_NAMES: Record<number, string> = {
    0: 'LOCAL', 1: 'GLOBAL', 2: 'WEAK',
    10: 'GNU_UNIQUE',
};

// Symbol type
const STT_NAMES: Record<number, string> = {
    0: 'NOTYPE', 1: 'OBJECT', 2: 'FUNC', 3: 'SECTION',
    4: 'FILE', 5: 'COMMON', 6: 'TLS',
    10: 'GNU_IFUNC',
};

// Symbol visibility
const STV_NAMES: Record<number, string> = {
    0: 'DEFAULT', 1: 'INTERNAL', 2: 'HIDDEN', 3: 'PROTECTED',
};

// Dynamic tags
const DT_NULL = 0;
const DT_NEEDED = 1;
const DT_SONAME = 14;
const DT_RPATH = 15;
const DT_RUNPATH = 29;
const DT_STRTAB = 5;
const DT_STRSZ = 10;

const DT_NAMES: Record<number, string> = {
    0: 'NULL', 1: 'NEEDED', 2: 'PLTRELSZ', 3: 'PLTGOT',
    4: 'HASH', 5: 'STRTAB', 6: 'SYMTAB', 7: 'RELA',
    8: 'RELASZ', 9: 'RELAENT', 10: 'STRSZ', 11: 'SYMENT',
    12: 'INIT', 13: 'FINI', 14: 'SONAME', 15: 'RPATH',
    16: 'SYMBOLIC', 17: 'REL', 18: 'RELSZ', 19: 'RELENT',
    20: 'PLTREL', 21: 'DEBUG', 22: 'TEXTREL', 23: 'JMPREL',
    24: 'BIND_NOW', 25: 'INIT_ARRAY', 26: 'FINI_ARRAY',
    27: 'INIT_ARRAYSZ', 28: 'FINI_ARRAYSZ', 29: 'RUNPATH',
    30: 'FLAGS', 32: 'PREINIT_ARRAY', 33: 'PREINIT_ARRAYSZ',
    0x6ffffef5: 'GNU_HASH', 0x6ffffff0: 'VERSYM',
    0x6ffffffb: 'FLAGS_1', 0x6ffffffc: 'VERDEF',
    0x6ffffffd: 'VERDEFNUM', 0x6ffffffe: 'VERNEED',
    0x6fffffff: 'VERNEEDNUM', 0x70000001: 'LOPROC+1',
};

// SHN constants
const SHN_UNDEF = 0;
const SHN_ABS = 0xfff1;
const SHN_COMMON = 0xfff2;

// ─── Helpers ────────────────────────────────────────────────────────────────

function decodeFlags(value: number, table: Record<number, string>): string[] {
    const flags: string[] = [];
    for (const [bit, name] of Object.entries(table)) {
        if (value & Number(bit)) flags.push(name);
    }
    return flags;
}

function decodePfFlags(flags: number): string[] {
    const result: string[] = [];
    if (flags & PF_R) result.push('READ');
    if (flags & PF_W) result.push('WRITE');
    if (flags & PF_X) result.push('EXECUTE');
    return result;
}

function hex(n: number | bigint): string {
    return '0x' + n.toString(16).toUpperCase();
}

// ─── Parsers ────────────────────────────────────────────────────────────────

function parseElfHeader(r: BinaryReader): ElfHeader {
    r.seek(0);

    // Check magic
    for (let i = 0; i < 4; i++) {
        if (r.u8() !== ELF_MAGIC[i]) {
            throw new Error('Not a valid ELF file (missing \\x7fELF magic)');
        }
    }

    const elfClass = r.u8();  // EI_CLASS
    const data = r.u8();      // EI_DATA
    const version = r.u8();   // EI_VERSION
    const osabi = r.u8();     // EI_OSABI
    r.skip(8);                // EI_ABIVERSION + padding

    // Set endianness based on EI_DATA
    r.setEndianness(data === 1); // 1=LE, 2=BE

    const is64 = elfClass === 2;

    const type = r.u16();
    const machine = r.u16();
    r.u32(); // e_version (already read in ident)

    let entryPoint: bigint;
    let phoff: bigint;
    let shoff: bigint;

    if (is64) {
        entryPoint = r.u64();
        phoff = r.u64();
        shoff = r.u64();
    } else {
        entryPoint = BigInt(r.u32());
        phoff = BigInt(r.u32());
        shoff = BigInt(r.u32());
    }

    const flags = r.u32();
    const ehsize = r.u16();
    const phentsize = r.u16();
    const phnum = r.u16();
    const shentsize = r.u16();
    const shnum = r.u16();
    const shstrndx = r.u16();

    return {
        class: elfClass,
        classDescription: ELF_CLASS[elfClass] || `Unknown (${elfClass})`,
        data,
        dataDescription: ELF_DATA[data] || `Unknown (${data})`,
        version,
        osabi,
        osabiDescription: ELF_OSABI[osabi] || `Unknown (${osabi})`,
        type,
        typeDescription: ELF_TYPE[type] || `Unknown (${type})`,
        machine,
        machineDescription: ELF_MACHINE[machine] || `Unknown (0x${machine.toString(16)})`,
        entryPoint: hex(entryPoint),
        phoff: Number(phoff),
        shoff: Number(shoff),
        flags,
        ehsize,
        phentsize,
        phnum,
        shentsize,
        shnum,
        shstrndx,
    };
}

function parseSectionHeaders(
    r: BinaryReader,
    header: ElfHeader,
    buf: Buffer
): ElfSectionHeader[] {
    if (header.shoff === 0 || header.shnum === 0) return [];

    const is64 = header.class === 2;
    const sections: ElfSectionHeader[] = [];

    for (let i = 0; i < header.shnum; i++) {
        r.seek(header.shoff + i * header.shentsize);

        const sh_name = r.u32();
        const sh_type = r.u32();
        let sh_flags: number;
        let sh_addr: bigint;
        let sh_offset: bigint;
        let sh_size: bigint;

        if (is64) {
            sh_flags = Number(r.u64());
            sh_addr = r.u64();
            sh_offset = r.u64();
            sh_size = r.u64();
        } else {
            sh_flags = r.u32();
            sh_addr = BigInt(r.u32());
            sh_offset = BigInt(r.u32());
            sh_size = BigInt(r.u32());
        }

        const sh_link = r.u32();
        const sh_info = r.u32();

        let sh_addralign: number;
        let sh_entsize: number;
        if (is64) {
            sh_addralign = Number(r.u64());
            sh_entsize = Number(r.u64());
        } else {
            sh_addralign = r.u32();
            sh_entsize = r.u32();
        }

        sections.push({
            nameIndex: sh_name,
            name: '', // resolved later
            type: sh_type,
            typeDescription: SHT_NAMES[sh_type] || `Unknown (0x${sh_type.toString(16)})`,
            flags: sh_flags,
            flagNames: decodeFlags(sh_flags, SHF_TABLE),
            addr: hex(sh_addr),
            offset: Number(sh_offset),
            size: Number(sh_size),
            link: sh_link,
            info: sh_info,
            addralign: sh_addralign,
            entsize: sh_entsize,
        });
    }

    // Resolve section names from shstrtab
    if (header.shstrndx < sections.length) {
        const shstrtab = sections[header.shstrndx];
        for (const sec of sections) {
            sec.name = r.stringAt(shstrtab.offset, shstrtab.size, sec.nameIndex);
        }
    }

    return sections;
}

function parseProgramHeaders(r: BinaryReader, header: ElfHeader): ElfProgramHeader[] {
    if (header.phoff === 0 || header.phnum === 0) return [];

    const is64 = header.class === 2;
    const headers: ElfProgramHeader[] = [];

    for (let i = 0; i < header.phnum; i++) {
        r.seek(header.phoff + i * header.phentsize);

        const p_type = r.u32();

        let p_flags: number;
        let p_offset: bigint;
        let p_vaddr: bigint;
        let p_paddr: bigint;
        let p_filesz: bigint;
        let p_memsz: bigint;
        let p_align: bigint;

        if (is64) {
            p_flags = r.u32(); // flags come before offset in ELF64
            p_offset = r.u64();
            p_vaddr = r.u64();
            p_paddr = r.u64();
            p_filesz = r.u64();
            p_memsz = r.u64();
            p_align = r.u64();
        } else {
            p_offset = BigInt(r.u32());
            p_vaddr = BigInt(r.u32());
            p_paddr = BigInt(r.u32());
            p_filesz = BigInt(r.u32());
            p_memsz = BigInt(r.u32());
            p_flags = r.u32();
            p_align = BigInt(r.u32());
        }

        headers.push({
            type: p_type,
            typeDescription: PT_NAMES[p_type] || `Unknown (0x${p_type.toString(16)})`,
            offset: Number(p_offset),
            vaddr: hex(p_vaddr),
            paddr: hex(p_paddr),
            filesz: Number(p_filesz),
            memsz: Number(p_memsz),
            flags: p_flags,
            flagNames: decodePfFlags(p_flags),
            align: Number(p_align),
        });
    }

    return headers;
}

function parseSymbolTable(
    r: BinaryReader,
    symSection: ElfSectionHeader,
    strSection: ElfSectionHeader,
    allSections: ElfSectionHeader[],
    is64: boolean
): ElfSymbol[] {
    if (symSection.size === 0 || symSection.entsize === 0) return [];

    const count = Math.floor(symSection.size / symSection.entsize);
    const symbols: ElfSymbol[] = [];

    for (let i = 0; i < count; i++) {
        r.seek(symSection.offset + i * symSection.entsize);

        let st_name: number;
        let st_info: number;
        let st_other: number;
        let st_shndx: number;
        let st_value: bigint;
        let st_size: bigint;

        if (is64) {
            st_name = r.u32();
            st_info = r.u8();
            st_other = r.u8();
            st_shndx = r.u16();
            st_value = r.u64();
            st_size = r.u64();
        } else {
            st_name = r.u32();
            st_value = BigInt(r.u32());
            st_size = BigInt(r.u32());
            st_info = r.u8();
            st_other = r.u8();
            st_shndx = r.u16();
        }

        const bind = (st_info >> 4) & 0xf;
        const type = st_info & 0xf;
        const visibility = st_other & 0x3;

        const name = r.stringAt(strSection.offset, strSection.size, st_name);

        // Skip null/empty entries
        if (i === 0 && st_name === 0 && st_value === 0n) continue;

        let sectionName = '';
        if (st_shndx === SHN_UNDEF) sectionName = 'UND';
        else if (st_shndx === SHN_ABS) sectionName = 'ABS';
        else if (st_shndx === SHN_COMMON) sectionName = 'COM';
        else if (st_shndx < allSections.length) sectionName = allSections[st_shndx].name;

        symbols.push({
            name,
            value: hex(st_value),
            size: Number(st_size),
            bind: STB_NAMES[bind] || `Unknown (${bind})`,
            type: STT_NAMES[type] || `Unknown (${type})`,
            visibility: STV_NAMES[visibility] || `Unknown (${visibility})`,
            sectionIndex: st_shndx,
            sectionName,
        });
    }

    return symbols;
}

function parseDynamic(
    r: BinaryReader,
    dynSection: ElfSectionHeader,
    strSection: ElfSectionHeader | null,
    is64: boolean
): { entries: ElfDynamicEntry[]; needed: string[]; soname: string | null } {
    if (dynSection.size === 0) {
        return { entries: [], needed: [], soname: null };
    }

    const entries: ElfDynamicEntry[] = [];
    const needed: string[] = [];
    let soname: string | null = null;

    const entrySize = is64 ? 16 : 8;
    const count = Math.floor(dynSection.size / entrySize);

    for (let i = 0; i < count; i++) {
        r.seek(dynSection.offset + i * entrySize);

        let d_tag: number;
        let d_val: bigint;

        if (is64) {
            d_tag = Number(r.i64());
            d_val = r.u64();
        } else {
            d_tag = r.i32();
            d_val = BigInt(r.u32());
        }

        if (d_tag === DT_NULL) break;

        const tagName = DT_NAMES[d_tag] || `0x${(d_tag >>> 0).toString(16)}`;

        // Resolve string values for NEEDED, SONAME, RPATH, RUNPATH
        let valueStr: string;
        if (strSection && (d_tag === DT_NEEDED || d_tag === DT_SONAME || d_tag === DT_RPATH || d_tag === DT_RUNPATH)) {
            const str = r.stringAt(strSection.offset, strSection.size, Number(d_val));
            valueStr = str;

            if (d_tag === DT_NEEDED) {
                needed.push(str);
            } else if (d_tag === DT_SONAME) {
                soname = str;
            }
        } else {
            valueStr = hex(d_val);
        }

        entries.push({ tag: d_tag, tagName, value: valueStr });
    }

    return { entries, needed, soname };
}

// ─── Main Parser ────────────────────────────────────────────────────────────

export function parseElfFile(filePath: string): ElfFile {
    const buf = fs.readFileSync(filePath);
    const r = new BinaryReader(buf);
    const errors: ParseError[] = [];
    const fileName = path.basename(filePath);

    // ELF Header
    const header = parseElfHeader(r);
    const is64 = header.class === 2;

    // Section Headers
    let sections: ElfSectionHeader[] = [];
    try {
        sections = parseSectionHeaders(r, header, buf);
    } catch (e: any) {
        errors.push({ stage: 'sections', message: e.message });
    }

    // Program Headers
    let programHeaders: ElfProgramHeader[] = [];
    try {
        programHeaders = parseProgramHeaders(r, header);
    } catch (e: any) {
        errors.push({ stage: 'programHeaders', message: e.message });
    }

    // Find important sections
    const dynsymSection = sections.find(s => s.type === SHT_DYNSYM);
    const symtabSection = sections.find(s => s.type === SHT_SYMTAB);
    const dynSection = sections.find(s => s.type === SHT_DYNAMIC);

    // Find associated string tables
    const dynstrSection = dynsymSection && dynsymSection.link < sections.length
        ? sections[dynsymSection.link]
        : sections.find(s => s.name === '.dynstr');
    const strtabSection = symtabSection && symtabSection.link < sections.length
        ? sections[symtabSection.link]
        : sections.find(s => s.name === '.strtab');

    // Parse dynamic symbols
    let allDynSymbols: ElfSymbol[] = [];
    try {
        if (dynsymSection && dynstrSection) {
            allDynSymbols = parseSymbolTable(r, dynsymSection, dynstrSection, sections, is64);
        }
    } catch (e: any) {
        errors.push({ stage: 'dynamicSymbols', message: e.message });
    }

    // If no .dynsym, try .symtab
    let allSymtabSymbols: ElfSymbol[] = [];
    try {
        if (symtabSection && strtabSection) {
            allSymtabSymbols = parseSymbolTable(r, symtabSection, strtabSection, sections, is64);
        }
    } catch (e: any) {
        errors.push({ stage: 'symbolTable', message: e.message });
    }

    // Exports: defined (non-UND) GLOBAL/WEAK symbols with DEFAULT/PROTECTED visibility
    // Prefer .dynsym as those are the externally visible symbols
    const symbolSource = allDynSymbols.length > 0 ? allDynSymbols : allSymtabSymbols;
    const exports = symbolSource.filter(s =>
        s.sectionIndex !== SHN_UNDEF &&
        (s.bind === 'GLOBAL' || s.bind === 'WEAK') &&
        (s.visibility === 'DEFAULT' || s.visibility === 'PROTECTED') &&
        s.name !== ''
    );

    // Imports: undefined symbols from .dynsym (or .symtab)
    const imports = symbolSource.filter(s =>
        s.sectionIndex === SHN_UNDEF &&
        s.name !== '' &&
        (s.bind === 'GLOBAL' || s.bind === 'WEAK')
    );

    // Parse dynamic section
    let dynamicEntries: ElfDynamicEntry[] = [];
    let neededLibraries: string[] = [];
    let soname: string | null = null;
    try {
        if (dynSection) {
            // The dynamic section's string table
            const dynStrForDynamic = dynSection.link < sections.length
                ? sections[dynSection.link]
                : dynstrSection || null;
            const dynResult = parseDynamic(r, dynSection, dynStrForDynamic, is64);
            dynamicEntries = dynResult.entries;
            neededLibraries = dynResult.needed;
            soname = dynResult.soname;
        }
    } catch (e: any) {
        errors.push({ stage: 'dynamic', message: e.message });
    }

    return {
        filePath,
        fileName,
        fileSize: buf.length,
        header,
        sections,
        exports,
        imports,
        neededLibraries,
        dynamicEntries,
        soname,
        programHeaders,
        errors,
    };
}

/** Detect if a file is ELF by checking magic bytes */
export function isElfFile(filePath: string): boolean {
    try {
        const fd = fs.openSync(filePath, 'r');
        const buf = Buffer.alloc(4);
        fs.readSync(fd, buf, 0, 4, 0);
        fs.closeSync(fd);
        return buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46;
    } catch {
        return false;
    }
}

/** Get the list of needed libraries (lightweight, for dependency listing) */
export function parseElfNeededLibraries(filePath: string): string[] {
    try {
        const result = parseElfFile(filePath);
        return result.neededLibraries;
    } catch {
        return [];
    }
}

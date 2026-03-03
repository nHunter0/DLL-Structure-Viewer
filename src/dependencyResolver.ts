import * as fs from 'fs';
import * as path from 'path';
import { parseImportNames } from './peParser';
import { DependencyNode, DependencyTree, ResolvedModule } from './types';

// Common API Set prefixes that map to system DLLs
const API_SET_PREFIXES = ['api-ms-win-', 'ext-ms-win-', 'ext-ms-'];

function isApiSetName(name: string): boolean {
    const lower = name.toLowerCase();
    return API_SET_PREFIXES.some(p => lower.startsWith(p));
}

function isSystemDll(resolvedPath: string | null): boolean {
    if (!resolvedPath) return false;
    const lower = resolvedPath.toLowerCase();
    return lower.includes('\\windows\\system32') ||
        lower.includes('\\windows\\syswow64') ||
        lower.includes('\\windows\\winsxs');
}

export interface ResolverOptions {
    maxDepth: number;
    onProgress?: (current: string, count: number) => void;
}

export class DependencyResolver {
    private searchPaths: string[];
    private cache = new Map<string, string[]>(); // normalized name -> import names
    private resolveCache = new Map<string, string | null>(); // normalized name -> resolved path

    constructor(private dllDir: string) {
        const winDir = process.env.WINDIR || process.env.windir || 'C:\\Windows';
        this.searchPaths = [
            dllDir,
            path.join(winDir, 'System32'),
            path.join(winDir, 'SysWOW64'),
        ];
    }

    private resolveDllPath(name: string): string | null {
        const key = name.toLowerCase();
        if (this.resolveCache.has(key)) return this.resolveCache.get(key)!;

        // API Set DLLs can't be resolved from disk directly
        if (isApiSetName(name)) {
            this.resolveCache.set(key, null);
            return null;
        }

        for (const dir of this.searchPaths) {
            const candidate = path.join(dir, name);
            try {
                fs.accessSync(candidate, fs.constants.R_OK);
                this.resolveCache.set(key, candidate);
                return candidate;
            } catch {
                // not found in this dir
            }
        }

        this.resolveCache.set(key, null);
        return null;
    }

    private getImports(filePath: string): string[] {
        const key = filePath.toLowerCase();
        if (this.cache.has(key)) return this.cache.get(key)!;
        const imports = parseImportNames(filePath);
        this.cache.set(key, imports);
        return imports;
    }

    async resolve(rootPath: string, options: ResolverOptions): Promise<DependencyTree> {
        const visited = new Set<string>();
        let totalModules = 0;
        let missingCount = 0;
        let circularCount = 0;
        let maxDepth = 0;

        const buildNode = async (
            name: string,
            resolvedPath: string | null,
            depth: number,
            ancestors: Set<string>
        ): Promise<DependencyNode> => {
            const normalizedName = name.toLowerCase();
            totalModules++;

            if (options.onProgress) {
                options.onProgress(name, totalModules);
            }

            const module: ResolvedModule = {
                name,
                resolvedPath,
                isSystem: isSystemDll(resolvedPath),
                isApiSet: isApiSetName(name),
            };

            if (!resolvedPath) {
                missingCount++;
                return { module, children: [], isCircular: false, depth };
            }

            // Circular dependency check
            if (ancestors.has(normalizedName)) {
                circularCount++;
                return { module, children: [], isCircular: true, depth };
            }

            // Already visited at this or lower depth - still show but don't recurse further
            if (visited.has(normalizedName) || depth >= options.maxDepth) {
                return { module, children: [], isCircular: false, depth };
            }

            visited.add(normalizedName);
            maxDepth = Math.max(maxDepth, depth);

            const importNames = this.getImports(resolvedPath);
            const childAncestors = new Set(ancestors);
            childAncestors.add(normalizedName);

            const children: DependencyNode[] = [];
            for (const imp of importNames) {
                const childPath = this.resolveDllPath(imp);
                // Yield to event loop periodically
                if (totalModules % 20 === 0) {
                    await new Promise(resolve => setImmediate(resolve));
                }
                const child = await buildNode(imp, childPath, depth + 1, childAncestors);
                children.push(child);
            }

            return { module, children, isCircular: false, depth };
        };

        const rootName = path.basename(rootPath);
        const rootNode = await buildNode(rootName, rootPath, 0, new Set());

        return {
            root: rootNode,
            totalModules,
            missingCount,
            circularCount,
            maxDepth,
        };
    }
}

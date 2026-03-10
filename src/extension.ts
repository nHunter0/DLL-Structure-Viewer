import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { parsePeFile } from './peParser';
import { parseElfFile } from './elfParser';
import { DependencyResolver } from './dependencyResolver';
import { getWebviewContent } from './webviewContent';
import { BinaryFormat } from './types';

/** Detect binary format by reading magic bytes */
function detectFormat(filePath: string): BinaryFormat | null {
    try {
        const fd = fs.openSync(filePath, 'r');
        const buf = Buffer.alloc(4);
        fs.readSync(fd, buf, 0, 4, 0);
        fs.closeSync(fd);

        // ELF: \x7fELF
        if (buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) {
            return 'elf';
        }
        // PE: MZ
        if (buf[0] === 0x4d && buf[1] === 0x5a) {
            return 'pe';
        }
        return null;
    } catch {
        return null;
    }
}

class BinaryEditorProvider implements vscode.CustomReadonlyEditorProvider {
    constructor(private readonly context: vscode.ExtensionContext) {}

    openCustomDocument(
        uri: vscode.Uri,
        _openContext: vscode.CustomDocumentOpenContext,
        _token: vscode.CancellationToken
    ): vscode.CustomDocument {
        return { uri, dispose: () => {} };
    }

    resolveCustomEditor(
        document: vscode.CustomDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): void {
        setupWebview(this.context, webviewPanel, document.uri);
    }
}

export function activate(context: vscode.ExtensionContext) {
    // Register custom editor provider
    const editorProvider = new BinaryEditorProvider(context);
    context.subscriptions.push(
        vscode.window.registerCustomEditorProvider(
            'dllViewer.structureView',
            editorProvider,
            {
                webviewOptions: { retainContextWhenHidden: true },
                supportsMultipleEditorsPerDocument: false,
            }
        )
    );

    // Right-click command for opening from context menu
    const command = vscode.commands.registerCommand(
        'dllViewer.viewStructure',
        async (uri?: vscode.Uri) => {
            if (!uri) {
                const files = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectMany: false,
                    filters: {
                        'Binary Files': ['dll', 'exe', 'sys', 'ocx', 'drv', 'so', 'cpl', 'scr', 'efi', 'mui', 'ax', 'ko', 'elf', 'axf'],
                        'All Files': ['*'],
                    },
                    title: 'Select a binary file',
                });
                if (!files || files.length === 0) return;
                uri = files[0];
            }

            await vscode.commands.executeCommand(
                'vscode.openWith',
                uri,
                'dllViewer.structureView'
            );
        }
    );

    context.subscriptions.push(command);
}

function setupWebview(
    context: vscode.ExtensionContext,
    panel: vscode.WebviewPanel,
    uri: vscode.Uri
) {
    const filePath = uri.fsPath;
    const fileName = path.basename(filePath);

    panel.webview.options = {
        enableScripts: true,
        localResourceRoots: [],
    };

    const format = detectFormat(filePath);
    panel.title = format === 'elf' ? `ELF: ${fileName}` : `DLL: ${fileName}`;

    // Generate nonce for CSP
    const nonce = crypto.randomBytes(16).toString('hex');

    // Set webview content
    panel.webview.html = getWebviewContent(panel.webview, nonce);

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(
        async (message) => {
            if (message.type === 'ready') {
                try {
                    if (format === 'elf') {
                        const elfData = parseElfFile(filePath);
                        panel.webview.postMessage({ type: 'elfData', data: elfData });
                    } else {
                        const peData = parsePeFile(filePath);
                        panel.webview.postMessage({ type: 'peData', data: peData });

                        // Resolve dependencies in the background (PE only)
                        const resolver = new DependencyResolver(path.dirname(filePath));
                        const tree = await resolver.resolve(filePath, {
                            maxDepth: 10,
                            onProgress: (current, count) => {
                                panel.webview.postMessage({
                                    type: 'progress',
                                    data: { current, count },
                                });
                            },
                        });
                        panel.webview.postMessage({ type: 'dependencyTree', data: tree });
                    }
                } catch (err: any) {
                    panel.webview.postMessage({
                        type: 'error',
                        data: { message: err.message || 'Failed to parse binary file' },
                    });
                }
            }
        },
        undefined,
        context.subscriptions
    );

    // Set panel icon
    panel.iconPath = {
        light: vscode.Uri.file(path.join(context.extensionPath, 'media', 'icon.png')),
        dark: vscode.Uri.file(path.join(context.extensionPath, 'media', 'icon.png')),
    };
}

export function deactivate() {}

import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import { parsePeFile } from './peParser';
import { DependencyResolver } from './dependencyResolver';
import { getWebviewContent } from './webviewContent';

class DllEditorProvider implements vscode.CustomReadonlyEditorProvider {
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
    // Register custom editor provider — this makes it the default for .dll files
    const editorProvider = new DllEditorProvider(context);
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

    // Also keep the right-click command for opening from context menu
    const command = vscode.commands.registerCommand(
        'dllViewer.viewStructure',
        async (uri?: vscode.Uri) => {
            if (!uri) {
                const files = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectMany: false,
                    filters: {
                        'PE Files': ['dll', 'exe', 'sys', 'ocx', 'drv'],
                        'All Files': ['*'],
                    },
                    title: 'Select a DLL or EXE file',
                });
                if (!files || files.length === 0) return;
                uri = files[0];
            }

            // Open using the custom editor
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

    panel.title = `DLL: ${fileName}`;

    // Generate nonce for CSP
    const nonce = crypto.randomBytes(16).toString('hex');

    // Set webview content
    panel.webview.html = getWebviewContent(panel.webview, nonce);

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(
        async (message) => {
            if (message.type === 'ready') {
                try {
                    const peData = parsePeFile(filePath);
                    panel.webview.postMessage({ type: 'peData', data: peData });

                    // Resolve dependencies in the background
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
                } catch (err: any) {
                    panel.webview.postMessage({
                        type: 'error',
                        data: { message: err.message || 'Failed to parse PE file' },
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

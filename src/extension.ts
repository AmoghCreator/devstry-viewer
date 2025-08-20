/**
 * Main entry point for the Devstry Viewer VSCode extension.
 * Provides commands for browsing and selecting devlog markdown files.
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// Devlog utilities
import { getDevlogSection, parseLineRange, readDevlogFileSafe, getDevlogMarkdownFiles } from './devlogUtils';
// Workspace and messaging utilities
import { getWorkspaceRoot, getLatestDevlogFile, escapeRegExp, showWarningIf, getWorkspaceSubdirOrWarn } from './vscodeUtils';


/**
 * Returns the HTML for the devlog webview panel for a given file and line.
 * @param file Relative path to the file being viewed.
 * @param line Line number in the file.
 * @returns HTML string for the webview panel.
 */
function getDevlogPanelHtml(file: string, line: number): string {
	// Get devlog directory (try 'devlog' and 'devLog')
	const workspaceRoot = getWorkspaceRoot();
	let cardsHtml = '<em>No devlog files found.</em>';

	if (!workspaceRoot) {
		cardsHtml = `<div style="margin-top:1em;font-size:0.95em;color:#e00;">Workspace root not found.</div>`;
		return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: sans-serif; padding: 2em; background: #f4f6fa; }
                </style>
            </head>
            <body>
                ${cardsHtml}
            </body>
            </html>
        `;
	}

	let devlogDir = path.join(workspaceRoot, 'devlog');
	if (!fs.existsSync(devlogDir)) {
		devlogDir = path.join(workspaceRoot, 'devLog');
	}

	function splitDevlogSectionToCards(section: string): string[] {
		const cardRegex = /##### \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z[\s\S]*?(?=(?:\n##### \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)|$)/g;
		const cards: string[] = [];
		let match;
		while ((match = cardRegex.exec(section)) !== null) {
			cards.push(match[0].trim());
		}
		return cards;
	}

	if (fs.existsSync(devlogDir) && file) {
		// Get all markdown files with their full paths and stats
		const files = fs.readdirSync(devlogDir)
			.filter(f => f.endsWith('.md'))
			.map(f => {
				const fullPath = path.join(devlogDir, f);
				const stat = fs.statSync(fullPath);
				return { file: f, fullPath, mtime: stat.mtime };
			})
			.sort((a, b) => b.mtime.getTime() - a.mtime.getTime()); // Most recent first

		if (files.length === 0) {
			cardsHtml = `<div style="margin-top:1em;font-size:0.95em;color:#e00;">No devlog markdown files found.</div>`;
		} else {
			cardsHtml = files.map(({ file: devlogFile, fullPath, mtime }) => {
				const devlogContent = readDevlogFileSafe(fullPath);
				if (!devlogContent) {
					return `<div style="margin-top:1em;font-size:0.95em;color:#e00;">Could not read devlog file: ${devlogFile}</div>`;
				}
				const section = getDevlogSection(devlogContent, file);
				if (!section) {
					return `<div style="margin-top:1em;font-size:0.95em;color:#e00;">No devlog section found for this file in <strong>${devlogFile}</strong>.</div>`;
				}
				const cards = splitDevlogSectionToCards(section);
				if (cards.length === 0) {
					return `<div style="margin-top:1em;font-size:0.95em;color:#e00;">No devlog cards found for this file in <strong>${devlogFile}</strong>.</div>`;
				}
				return `
                    <section style="margin-bottom:2em;">
                        <div style="font-size:1.1em;font-weight:bold;color:#007acc;margin-bottom:0.5em;">
                            ${devlogFile} <span style="font-size:0.9em;color:#888;">(${mtime.toLocaleString()})</span>
                        </div>
                        <div id="devlog-card-container" style="display: flex; overflow-x: auto; gap: 1.5em; padding-bottom: 1em;">
                            ${cards.map(card => `
                                <div class="devlog-card" style="min-width:350px; max-width:400px; background:#fff; border-radius:10px; box-shadow:0 2px 8px #0002; padding:1em; margin-bottom:1em; flex:0 0 auto; overflow-x:auto;">
                                    <div class="markdown-body">${card}</div>
                                </div>
                            `).join('')}
                        </div>
                    </section>
                `;
			}).join('');
		}
	}

	return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <style>
                body { font-family: sans-serif; padding: 2em; background: #f4f6fa; }
                .file { font-size: 1.2em; color: #333; margin-bottom: 1em; }
                .line { font-size: 2em; color: #007acc; margin-bottom: 1em; }
                #devlog-card-container { scrollbar-width: thin; scrollbar-color: #007acc #e0e0e0; }
                .devlog-card { transition: box-shadow 0.2s; }
                .devlog-card:hover { box-shadow: 0 4px 16px #007acc33; }
                /* Github markdown style (minimal) */
                .markdown-body table { border-collapse: collapse; max-width: 100%; display: block; margin-bottom: 1em; overflow-x: auto; }
                .markdown-body th, .markdown-body td { border: 1px solid #ddd; padding: 4px 8px; }
                .markdown-body th { background: #f6f8fa; }
                .markdown-body code { background: #f6f8fa; border-radius: 4px; padding: 2px 4px; }
                .markdown-body { font-size: 0.98em; }
            </style>
            <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
            <script>
                window.addEventListener('DOMContentLoaded', () => {
                    document.querySelectorAll('.markdown-body').forEach(el => {
                        const raw = el.textContent;
                        el.innerHTML = marked.parse(raw, { gfm: true });
                    });
                });
            </script>
        </head>
        <body>
            <div class="file">File: <strong>${file || 'No file'}</strong></div>
            <div class="line">Current Line: <strong>${line}</strong></div>
            ${cardsHtml}
        </body>
        </html>
    `;
}

/**
 * Activates the extension and registers commands.
 * @param context VSCode extension context.
 */
export function activate(context: vscode.ExtensionContext) {
	// Command: Open Change Browser (webview for current file/line)
	const openChangeBrowserDisposable = vscode.commands.registerCommand('devstry-viewer.openChangeBrowser', () => {
		const panel = vscode.window.createWebviewPanel(
			'devlogPanel',
			'Devlog Change',
			vscode.ViewColumn.Two,
			{ enableScripts: true }
		);

		/**
		 * Finds and returns change blocks for the current line in the devlog.
		 * @param devlogPath Path to devlog markdown file.
		 * @param fileName Name of the file being viewed.
		 * @param line Line number in the file.
		 */
		function getChangeForLine(devlogPath: string, fileName: string, line: number): string {
			const content = fs.readFileSync(devlogPath, 'utf8');
			const section = getDevlogSection(content, fileName);
			if (!section) return 'No devlog section found for this file.';

			// Find all change blocks with line numbers
			const changeBlockRegex = /\*\*Lines ([\d\-]+)\*\* \| \*\*(\d+) change tracked\*\*\n\n##### ([^\n]+)\n([\s\S]*?)(?=\n\*\*Lines|\n##|$)/g;
			let result = '';
			let found = false;
			let match;
			while ((match = changeBlockRegex.exec(section)) !== null) {
				const linesStr = match[1]; // e.g. "1-2"
				const lines = parseLineRange(linesStr);
				if (lines.includes(line)) {
					found = true;
					result += match[0].trim() + '\n\n';
				}
			}
			return found ? result : 'No tracked change for this line.';
		}

		/**
		 * Updates the webview panel with the current file and line.
		 */
		const updatePanel = () => {
			const editor = vscode.window.activeTextEditor;
			const line = editor ? editor.selection.active.line + 1 : 1;
			const file = editor ? editor.document.uri.fsPath : '';
			panel.webview.html = getDevlogPanelHtml(file, line);
		};

		updatePanel();

		// Listen for editor/selection changes to update panel
		const selectionListener = vscode.window.onDidChangeTextEditorSelection(() => updatePanel());
		const editorListener = vscode.window.onDidChangeActiveTextEditor(() => updatePanel());

		panel.onDidDispose(() => {
			selectionListener.dispose();
			editorListener.dispose();
		});
	});
	context.subscriptions.push(openChangeBrowserDisposable);

	// Command: Open Recent Markdown (shows latest devlog file)
	const openRecentMarkdownDisposable = vscode.commands.registerCommand('devstry-viewer.openRecentMarkdown', async () => {
		const devlogPath = getLatestDevlogFile();
		if (showWarningIf(!devlogPath, 'No devlog markdown files found.')) return;
		vscode.window.showInformationMessage(`Would open: ${devlogPath}`);
	});
	context.subscriptions.push(openRecentMarkdownDisposable);

	// Command: Select Markdown (lists all devlog markdown files)
	const selectMarkdownDisposable = vscode.commands.registerCommand('devstry-viewer.selectMarkdown', async () => {
		const devlogDir = getWorkspaceSubdirOrWarn('devLog', 'No devlog directory found.');
		if (!devlogDir) return;
		const files = getDevlogMarkdownFiles(devlogDir);
		if (showWarningIf(files.length === 0, 'No devlog markdown files found.')) return;
		vscode.window.showInformationMessage(`Would select: ${files.join(', ')}`);
	});
	context.subscriptions.push(selectMarkdownDisposable);
}

/**
 * Deactivates the extension.
 */
export function deactivate() { }

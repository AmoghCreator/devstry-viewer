// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "devstry-viewer" is now active!');

	// Helper: Get all .md files in devLog
	async function getMarkdownFiles(): Promise<vscode.Uri[]> {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) return [];
		const devLogUri = vscode.Uri.joinPath(workspaceFolders[0].uri, 'devLog');
		try {
			const files = await vscode.workspace.fs.readDirectory(devLogUri);
			return files
				.filter(([name, type]) => name.endsWith('.md') && type === vscode.FileType.File)
				.map(([name]) => vscode.Uri.joinPath(devLogUri, name));
		} catch {
			return [];
		}
	}

	// Helper: Show markdown in webview
	async function showMarkdownFile(uri: vscode.Uri) {
		let panel = vscode.window.createWebviewPanel(
			'markdownViewer',
			`Markdown: ${uri.path.split('/').pop()}`,
			vscode.ViewColumn.Two,
			{ enableScripts: true }
		);
		const content = (await vscode.workspace.fs.readFile(uri)).toString();
		const { marked } = await import('marked');
		const htmlContent = `<html>
			<head>
				<style>
					body { font-family: sans-serif; padding: 2em; }
					pre, code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
					#popout-btn { position: absolute; top: 10px; right: 10px; padding: 6px 12px; background: #007acc; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
				</style>
			</head>
			<body>
				<button id="popout-btn">Pop Out</button>
				${marked(content)}
				<script>
					const vscode = acquireVsCodeApi();
					document.getElementById('popout-btn').onclick = () => {
						vscode.postMessage({ command: 'popout' });
					};
				</script>
			</body>
		</html>`;
		panel.webview.html = htmlContent;
		panel.webview.onDidReceiveMessage(async message => {
			if (message.command === 'popout') {
				const tmp = require('os').tmpdir();
				const fs = require('fs');
				const path = require('path');
				const fileName = `devstry-viewer-${Date.now()}.html`;
				const filePath = path.join(tmp, fileName);
				fs.writeFileSync(filePath, htmlContent, 'utf8');
				await vscode.env.openExternal(vscode.Uri.file(filePath));
			}
		});
	}

	// Command: Open most recent markdown
	const openRecentDisposable = vscode.commands.registerCommand('devstry-viewer.openRecentMarkdown', async () => {
		const files = await getMarkdownFiles();
		if (files.length === 0) {
			vscode.window.showWarningMessage('No markdown files found in devLog.');
			return;
		}
		let recentFile = files[0];
		let recentStat = await vscode.workspace.fs.stat(recentFile);
		for (const file of files) {
			const stat = await vscode.workspace.fs.stat(file);
			if (stat.mtime > recentStat.mtime) {
				recentFile = file;
				recentStat = stat;
			}
		}
		await showMarkdownFile(recentFile);
	});

	// Command: Select markdown file
	const selectDisposable = vscode.commands.registerCommand('devstry-viewer.selectMarkdown', async () => {
		const picked = await vscode.window.showOpenDialog({
			canSelectMany: false,
			openLabel: 'Open Markdown',
			filters: { 'Markdown files': ['md'] }
		});
		if (!picked || picked.length === 0) {
			vscode.window.showWarningMessage('No markdown file selected.');
			return;
		}
		await showMarkdownFile(picked[0]);
	});

	// Hello World command (unchanged)
	const disposable = vscode.commands.registerCommand('devstry-viewer.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from devstry-viewer!');
	});

	context.subscriptions.push(disposable, openRecentDisposable, selectDisposable);
	// --- Command: Show change details for current line ---
	const showChangeDetailsDisposable = vscode.commands.registerCommand('devstry-viewer.showChangeDetailsForLine', async () => {
		// Get active editor
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showWarningMessage('No active editor.');
			return;
		}
		const filePath = editor.document.uri.fsPath;
		const lineNumber = editor.selection.active.line + 1; // VSCode lines are 0-based

		// Prompt user to select change tracker markdown file
		const picked = await vscode.window.showOpenDialog({
			canSelectMany: false,
			openLabel: 'Select Change Tracker Markdown',
			filters: { 'Markdown files': ['md'] }
		});
		if (!picked || picked.length === 0) {
			vscode.window.showWarningMessage('No change tracker markdown file selected.');
			return;
		}
		const markdownUri = picked[0];
		const markdownContent = (await vscode.workspace.fs.readFile(markdownUri)).toString();

		// Parse and lookup
		const files = parseChangeTrackerMarkdown(markdownContent);
		// Normalize file path for lookup (match markdown format)
		const relPath = vscode.workspace.asRelativePath(filePath);
		const details = getChangeDetailsForLine(files, '/' + relPath, lineNumber);

		if (!details.scope) {
			vscode.window.showInformationMessage(`No tracked changes found for ${relPath} line ${lineNumber}.`);
			return;
		}

		// Build message
		let msg = `Change details for ${relPath} line ${lineNumber}:\n`;
		if (details.changeRow) {
			msg += `- Change: ${details.changeRow.before} → ${details.changeRow.after}\n`;
			if (details.changeRow.highlight) msg += `- Highlight: ${details.changeRow.highlight}\n`;
		}
		if (details.aiInsight) {
			msg += `- AI Insight: ${details.aiInsight}\n`;
		}
		if (details.suggestions && details.suggestions.length > 0) {
			msg += `- Suggestions:\n  ${details.suggestions.map(s => '- ' + s).join('\n  ')}\n`;
		}
		if (details.scope.explanation) {
			msg += `- Scope Explanation: ${details.scope.explanation}\n`;
		}
		vscode.window.showInformationMessage(msg);
	});

	context.subscriptions.push(showChangeDetailsDisposable);
}

// This method is called when your extension is deactivated
// --- Change Tracker Markdown Parser ---

export interface ChangeTrackerFile {
	filePath: string;
	scopes: ChangeTrackerScope[];
}

export interface ChangeTrackerScope {
	name: string;
	lineStart: number;
	lineEnd: number;
	changeCount: number;
	changes: ChangeTrackerEntry[];
	explanation?: string;
}

export interface ChangeTrackerEntry {
	timestamp: string;
	changes: ChangeTableRow[];
	aiInsight?: string;
	suggestions?: string[];
}

export interface ChangeTableRow {
	line: number;
	highlight?: string; // 🟡, 🔴, 🟢
	before: string;
	after: string;
}

/**
 * Parses a custom change tracker markdown string and returns a structured array of ChangeTrackerFile objects.
 *
 * The markdown format tracks code changes, AI insights, and suggestions mapped to specific line numbers in source files.
 *
 * @param markdown The change tracker markdown string to parse.
 * @returns Array of ChangeTrackerFile objects, each representing a file and its tracked changes.
 *
 * Example usage:
 *   const markdown = `...`; // Load sample markdown string
 *   const files = parseChangeTrackerMarkdown(markdown);
 *   // files[0].filePath, files[0].scopes, etc.
 */
export function parseChangeTrackerMarkdown(markdown: string): ChangeTrackerFile[] {
	const fileRegex = /^## (.+)$/gm;
	const scopeRegex = /\*\*(.+?)\*\* \| \*\*Lines (\d+)-(\d+)\*\* \| \*\*(\d+) change tracked\*\*/g;
	const changeEntryRegex = /##### ([\d\-T:\.Z]+)([\s\S]*?)(?=#####|$)/g;
	const changeTableRegex = /\| Line \| Before \| After \|([\s\S]*?)\n\n/g;
	const aiInsightRegex = /\*\*AI Insight\*\*([\s\S]*?)(?=\*\*Suggestions\*\*|$)/;
	const suggestionsRegex = /\*\*Suggestions\*\*([\s\S]*?)(?=\n\n|$)/;
	const explanationRegex = /\*\*Explanation\*\*([\s\S]*?)(?=\n\n|$)/;

	const files: ChangeTrackerFile[] = [];
	let fileMatch: RegExpExecArray | null;
	let fileSectionStart = 0;

	while ((fileMatch = fileRegex.exec(markdown)) !== null) {
		const filePath = fileMatch[1].trim();
		const nextFileMatch = fileRegex.exec(markdown);
		const sectionEnd = nextFileMatch ? nextFileMatch.index : markdown.length;
		const fileSection = markdown.slice(fileMatch.index, sectionEnd);

		const scopes: ChangeTrackerScope[] = [];
		let scopeMatch: RegExpExecArray | null;
		const scopeRegexLocal = /\*\*(.+?)\*\* \| \*\*Lines (\d+)-(\d+)\*\* \| \*\*(\d+) change tracked\*\*/g;
		while ((scopeMatch = scopeRegexLocal.exec(fileSection)) !== null) {
			const scopeName = scopeMatch[1].trim();
			const lineStart = parseInt(scopeMatch[2], 10);
			const lineEnd = parseInt(scopeMatch[3], 10);
			const changeCount = parseInt(scopeMatch[4], 10);

			// Find scope block
			const scopeStart = scopeMatch.index;
			const nextScopeMatch = scopeRegexLocal.exec(fileSection);
			const scopeEnd = nextScopeMatch ? nextScopeMatch.index : fileSection.length;
			const scopeBlock = fileSection.slice(scopeStart, scopeEnd);

			// Explanation
			let explanation: string | undefined;
			const explanationMatch = explanationRegex.exec(scopeBlock);
			if (explanationMatch) {
				explanation = explanationMatch[1].trim();
			}

			// Change entries
			const changes: ChangeTrackerEntry[] = [];
			let changeEntryMatch: RegExpExecArray | null;
			const changeEntryRegexLocal = /##### ([\d\-T:\.Z]+)([\s\S]*?)(?=#####|$)/g;
			while ((changeEntryMatch = changeEntryRegexLocal.exec(scopeBlock)) !== null) {
				const timestamp = changeEntryMatch[1].trim();
				const entryBlock = changeEntryMatch[2];

				// Change table
				const changeTableRows: ChangeTableRow[] = [];
				const changeTableRegexLocal = /\|([^\n]+)\|([^\n]+)\|([^\n]+)\|/g;
				let tableRowMatch: RegExpExecArray | null;
				const tableBlockMatch = changeTableRegex.exec(entryBlock);
				if (tableBlockMatch) {
					const tableBlock = tableBlockMatch[1];
					const tableRowRegex = /\| ([^\|]+) \| `([^`]*)` \| `([^`]*)` \|/g;
					let rowMatch: RegExpExecArray | null;
					while ((rowMatch = tableRowRegex.exec(tableBlock)) !== null) {
						let lineStr = rowMatch[1].trim();
						let highlight: string | undefined;
						let lineNum: number;
						if (/^[🟡🔴🟢]/.test(lineStr)) {
							highlight = lineStr[0];
							lineStr = lineStr.slice(1).trim();
						}
						lineNum = parseInt(lineStr, 10);
						changeTableRows.push({
							line: lineNum,
							highlight,
							before: rowMatch[2],
							after: rowMatch[3]
						});
					}
				}

				// AI Insight
				let aiInsight: string | undefined;
				const aiInsightMatch = aiInsightRegex.exec(entryBlock);
				if (aiInsightMatch) {
					aiInsight = aiInsightMatch[1].trim();
				}

				// Suggestions
				let suggestions: string[] | undefined;
				const suggestionsMatch = suggestionsRegex.exec(entryBlock);
				if (suggestionsMatch) {
					suggestions = suggestionsMatch[1]
						.split('\n')
						.map(s => s.replace(/^- /, '').trim())
						.filter(s => s.length > 0);
				}

				changes.push({
					timestamp,
					changes: changeTableRows,
					aiInsight,
					suggestions
				});
			}

			scopes.push({
				name: scopeName,
				lineStart,
				lineEnd,
				changeCount,
				changes,
				explanation
			});
		}

		files.push({
			filePath,
			scopes
		});
	}

	return files;
}

// --- Sample usage for testing ---
// const markdown = `...`; // Load sample markdown string
// const parsed = parseChangeTrackerMarkdown(markdown);
// console.log(JSON.stringify(parsed, null, 2));
export function deactivate() { }

// --- Utility: Get change details for file and line number ---

/**
 * Finds the change details for a given file path and line number.
 * Returns: { scope, changeEntry, changeRow, aiInsight, suggestions }
 */
/**
 * Finds the change details for a given file path and line number.
 * @param files Parsed change tracker files from parseChangeTrackerMarkdown().
 * @param filePath The file path to look up.
 * @param lineNumber The line number to look up.
 * @returns Object containing scope, changeEntry, changeRow, aiInsight, suggestions.
 *
 * Example usage:
 *   const details = getChangeDetailsForLine(files, '/src/app.js', 34);
 *   // details.scope, details.changeEntry, details.changeRow, details.aiInsight, details.suggestions
 */
export function getChangeDetailsForLine(
	files: ChangeTrackerFile[],
	filePath: string,
	lineNumber: number
): {
	scope?: ChangeTrackerScope;
	changeEntry?: ChangeTrackerEntry;
	changeRow?: ChangeTableRow;
	aiInsight?: string;
	suggestions?: string[];
} {
	const file = files.find(f => f.filePath === filePath);
	if (!file) return {};

	for (const scope of file.scopes) {
		if (lineNumber >= scope.lineStart && lineNumber <= scope.lineEnd) {
			for (const entry of scope.changes) {
				for (const row of entry.changes) {
					if (row.line === lineNumber) {
						return {
							scope,
							changeEntry: entry,
							changeRow: row,
							aiInsight: entry.aiInsight,
							suggestions: entry.suggestions
						};
					}
				}
			}
			// If no exact match, return scope info
			return { scope };
		}
	}
	return {};
}

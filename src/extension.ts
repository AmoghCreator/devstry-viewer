import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { createHash } from 'crypto';

export function getDevlogSectionHashes(devlogPath: string): Record<string, Record<number, string>> {
	const content = fs.readFileSync(devlogPath, 'utf8');
	const result: Record<string, Record<number, string>> = {};

	// Find all file sections
	const fileSectionRegex = /^##\s+([^\n]+)[\s\S]*?(?=^##\s+|$)/gm;
	let fileMatch;
	while ((fileMatch = fileSectionRegex.exec(content)) !== null) {
		const fileName = fileMatch[1].trim();
		const sectionContent = fileMatch[0];

		// Find all change blocks in this section
		const changeBlockRegex = /\*\*Lines ([\d\-]+)\*\* \| \*\*(\d+) change tracked\*\*[\s\S]*?(?=\*\*Lines|\n##|$)/g;
		let changeMatch;
		while ((changeMatch = changeBlockRegex.exec(sectionContent)) !== null) {
			const linesStr = changeMatch[1];
			const lines = parseLineRange(linesStr);
			const blockContent = changeMatch[0];

			// Hash the block content
			const hash = createHash('sha256').update(blockContent).digest('hex');

			if (!result[fileName]) result[fileName] = {};
			for (const line of lines) {
				result[fileName][line] = hash;
			}
		}
	}
	return result;
}

function parseLineRange(str: string): number[] {
	// e.g. "1-2" => [1,2], "5" => [5]
	if (str.includes('-')) {
		const [start, end] = str.split('-').map(Number);
		const arr = [];
		for (let i = start; i <= end; i++) arr.push(i);
		return arr;
	}
	return [Number(str)];
}


export function activate(context: vscode.ExtensionContext) {
	const openChangeBrowserDisposable = vscode.commands.registerCommand('devstry-viewer.openChangeBrowser', () => {
		const panel = vscode.window.createWebviewPanel(
			'devlogPanel',
			'Devlog Change',
			vscode.ViewColumn.Two,
			{ enableScripts: true }
		);

		function getWorkspaceRoot(): string | null {
			const folders = vscode.workspace.workspaceFolders;
			if (!folders || folders.length === 0) return null;
			return folders[0].uri.fsPath;
		}

		function getLatestDevlogFile(): string | null {
			const root = getWorkspaceRoot();
			if (!root) return null;
			const devlogDir = path.join(root, 'devLog');
			if (!fs.existsSync(devlogDir) || !fs.statSync(devlogDir).isDirectory()) return null;
			const files = fs.readdirSync(devlogDir)
				.filter(f => f.endsWith('.md'))
				.map(f => ({ name: f, time: fs.statSync(path.join(devlogDir, f)).mtime.getTime() }))
				.sort((a, b) => b.time - a.time);
			return files.length > 0 ? path.join(devlogDir, files[0].name) : null;
		}

		// Parse devlog for file and line, return change block(s) for that line
		function getChangeForLine(devlogPath: string, fileName: string, line: number): string {
			const content = fs.readFileSync(devlogPath, 'utf8');
			// Find section for file
			const sectionRegex = new RegExp(`^##\\s+${escapeRegExp(fileName)}[\\s\\S]*?(?=^##\\s+|\\Z)`, 'm');
			const sectionMatch = content.match(sectionRegex);
			if (!sectionMatch) return 'No devlog section found for this file.';
			const section = sectionMatch[0];

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

		// removed duplicate parseLineRange, now top-level

		function escapeRegExp(str: string): string {
			return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		}

		const updatePanel = () => {
			const editor = vscode.window.activeTextEditor;
			const line = editor ? editor.selection.active.line + 1 : 1;
			const file = editor ? vscode.workspace.asRelativePath(editor.document.uri) : '';
			const devlogPath = getLatestDevlogFile();
			let changeHtml = '<em>No devlog file found.</em>';
			let hashHtml = '';
			if (devlogPath && file) {
				const fs = require('fs');
				const path = require('path');
				const marked = require('marked');
				let devlogContent = "";
				try {
					devlogContent = fs.readFileSync(devlogPath, 'utf8');
				} catch (e) {
					console.error('[Devlog Section Debug] Failed to read devlog:', e);
					changeHtml = `<div style="margin-top:1em;font-size:0.95em;color:#e00;">Could not read devlog file.</div>`;
					hashHtml = "";
					return;
				}

				// Manual section extraction for reliability
				function escapeRegExp(str: string) {
					return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
				}
				const fileBasename = path.basename(file);
				const sectionRegex = /^##\s+.*$/gm;
				const headings: number[] = [];
				let match;
				while ((match = sectionRegex.exec(devlogContent)) !== null) {
					headings.push(match.index);
				}
				let foundSection = "";
				for (let i = 0; i < headings.length; i++) {
					const headingLine = devlogContent.substring(headings[i], devlogContent.indexOf('\n', headings[i]));
					if (headingLine.includes(fileBasename)) {
						const start = headings[i];
						const end = (i + 1 < headings.length) ? headings[i + 1] : devlogContent.length;
						foundSection = devlogContent.substring(start, end);
						break;
					}
				}

				if (!foundSection) {
					console.warn(`[Devlog Section Debug] No section found for file "${file}".`);
					changeHtml = `<div style="margin-top:1em;font-size:0.95em;color:#e00;">No devlog section found for this file.</div>`;
					hashHtml = "";
				} else {
					const renderedHtml = marked.parse(foundSection);
					changeHtml = `<div style="font-size:1.05em;">${renderedHtml}</div>`;
					hashHtml = "";
				}
			}
			panel.webview.html = `
			<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<style>
					body { font-family: sans-serif; padding: 2em; }
					.file { font-size: 1.2em; color: #333; margin-bottom: 1em; }
					.line { font-size: 2em; color: #007acc; margin-bottom: 1em; }
					pre { background: #f6f8fa; padding: 1em; border-radius: 6px; }
				</style>
			</head>
			<body>
				<div class="file">File: <strong>${file || 'No file'}</strong></div>
				<div class="line">Current Line: <strong>${line}</strong></div>
				${changeHtml}
				${hashHtml}
			</body>
			</html>
		`;
		};

		updatePanel();

		const selectionListener = vscode.window.onDidChangeTextEditorSelection(() => {
			updatePanel();
		});
		const editorListener = vscode.window.onDidChangeActiveTextEditor(() => {
			updatePanel();
		});

		panel.onDidDispose(() => {
			selectionListener.dispose();
			editorListener.dispose();
		});
	});

	context.subscriptions.push(openChangeBrowserDisposable);
}

export function deactivate() { }

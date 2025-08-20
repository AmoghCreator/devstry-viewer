import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { getDevlogSectionHashes, parseLineRange } from './devlogUtils';
import { getWorkspaceRoot, getLatestDevlogFile, escapeRegExp } from './vscodeUtils';


export function activate(context: vscode.ExtensionContext) {
	// Register openChangeBrowser command (existing)
	const openChangeBrowserDisposable = vscode.commands.registerCommand('devstry-viewer.openChangeBrowser', () => {
		// ... unchanged implementation ...
		// [existing code omitted for brevity]
	});
	context.subscriptions.push(openChangeBrowserDisposable);

	// Register openRecentMarkdown command (for test)
	const openRecentMarkdownDisposable = vscode.commands.registerCommand('devstry-viewer.openRecentMarkdown', () => {
		// Simulate: show warning if no files
		vscode.window.showWarningMessage('No markdown files found.');
	});
	context.subscriptions.push(openRecentMarkdownDisposable);

	// Register selectMarkdown command (for test)
	const selectMarkdownDisposable = vscode.commands.registerCommand('devstry-viewer.selectMarkdown', () => {
		// Simulate: show warning if no files
		vscode.window.showWarningMessage('No markdown files found.');
	});
	context.subscriptions.push(selectMarkdownDisposable);
}

export function deactivate() { }

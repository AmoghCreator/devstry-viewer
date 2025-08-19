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
		const panel = vscode.window.createWebviewPanel(
			'markdownViewer',
			`Markdown: ${uri.path.split('/').pop()}`,
			vscode.ViewColumn.One,
			{ enableScripts: false }
		);
		const content = (await vscode.workspace.fs.readFile(uri)).toString();
		panel.webview.html = `<html>
			<head>
				<style>
					body { font-family: sans-serif; padding: 2em; }
					pre, code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
				</style>
			</head>
			<body>
				${vscode.MarkdownString ? new vscode.MarkdownString(content).value : `<pre>${content}</pre>`}
			</body>
		</html>`;
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
		const files = await getMarkdownFiles();
		if (files.length === 0) {
			vscode.window.showWarningMessage('No markdown files found in devLog.');
			return;
		}
		const picked = await vscode.window.showQuickPick(
			files.map(uri => ({ label: uri.path.split('/').pop() || '', uri })),
			{ placeHolder: 'Select a markdown file to view' }
		);
		if (picked) {
			await showMarkdownFile(picked.uri);
		}
	});

	// Hello World command (unchanged)
	const disposable = vscode.commands.registerCommand('devstry-viewer.helloWorld', () => {
		vscode.window.showInformationMessage('Hello World from devstry-viewer!');
	});

	context.subscriptions.push(disposable, openRecentDisposable, selectDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }

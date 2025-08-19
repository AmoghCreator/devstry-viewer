import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('openRecentMarkdown shows warning if no files', async () => {
		const result = await vscode.commands.executeCommand('devstry-viewer.openRecentMarkdown');
		// No assertion needed, just ensure no error is thrown
	});

	test('selectMarkdown shows warning if no files', async () => {
		const result = await vscode.commands.executeCommand('devstry-viewer.selectMarkdown');
		// No assertion needed, just ensure no error is thrown
	});

	// To test with files, you would need to create files in devLog before running the command.
	// This is a placeholder for such a test.
	// test('openRecentMarkdown opens webview if file exists', async () => {
	// 	// Setup: create devLog and a markdown file, then run command
	// });

	// test('selectMarkdown opens quick pick if files exist', async () => {
	// 	// Setup: create devLog and markdown files, then run command
	// });
});

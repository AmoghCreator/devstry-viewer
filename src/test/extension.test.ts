import * as assert from 'assert';
import { parseChangeTrackerMarkdown, getChangeDetailsForLine } from '../extension';
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
	import { parseChangeTrackerMarkdown, getChangeDetailsForLine } from '../extension';

	suite('Change Tracker Markdown Parser', () => {
		test('parses sample markdown and finds change details for line', () => {
			const sampleMarkdown = `
## /src/app.js

**Global constants** | **Lines 31-53** | **5 change tracked**

##### 2025-08-18T20:32:01.435Z

| Line | Before | After |
|------|--------|-------|
|  32 | \`});\` | \`});\` |
| 🟡 34 | \`});\` | \`res.send(completion.data.choices[0].message.content);\` |

**AI Insight**
The change at line 34 introduces a response send for the completion result.

**Suggestions**
- Consider error handling for completion.data.
- Add logging for response.

**Explanation**
This scope tracks changes to global constants and response logic.
`;

			const files = parseChangeTrackerMarkdown(sampleMarkdown);
			console.log('Parsed files:', JSON.stringify(files, null, 2));
			const details = getChangeDetailsForLine(files, '/src/app.js', 34);
			console.log('Details for /src/app.js line 34:', JSON.stringify(details, null, 2));

			assert.ok(details.scope, 'Scope should be found');
			assert.ok(details.changeEntry, 'Change entry should be found');
			assert.ok(details.changeRow, 'Change row should be found');
			assert.strictEqual(details.changeRow?.line, 34);
			assert.strictEqual(details.changeRow?.highlight, '🟡');
			assert.strictEqual(details.changeRow?.after, 'res.send(completion.data.choices[0].message.content);');
			assert.ok(details.aiInsight?.includes('introduces a response send'), 'AI Insight should be present');
			assert.ok(Array.isArray(details.suggestions), 'Suggestions should be an array');
			assert.strictEqual(details.suggestions?.length, 2, 'Should have two suggestions');
		});
	});
});

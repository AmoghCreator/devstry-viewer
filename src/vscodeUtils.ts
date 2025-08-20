// VS Code workspace and file utilities

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { escapeRegExp } from './devlogUtils';

/**
 * Returns the workspace root folder path, or undefined if not open.
 */
export function getWorkspaceRoot(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    return folders && folders.length > 0 ? folders[0].uri.fsPath : undefined;
}

/**
 * Finds the latest devlog markdown file in the workspace's devLog directory.
 * Returns the file path, or undefined if not found.
 */
export function getLatestDevlogFile(): string | undefined {
    const root = getWorkspaceRoot();
    if (!root) return undefined;
    const devlogDir = path.join(root, 'devLog');
    if (!fs.existsSync(devlogDir) || !fs.statSync(devlogDir).isDirectory()) return undefined;
    const files = fs.readdirSync(devlogDir)
        .filter(f => f.endsWith('.md'))
        .map(f => ({ name: f, time: fs.statSync(path.join(devlogDir, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time);
    return files.length > 0 ? path.join(devlogDir, files[0].name) : undefined;
}

// Re-export escapeRegExp for convenience
export { escapeRegExp };

/**
 * Shows a warning message if the condition is true, returns true if warning was shown.
 */
export function showWarningIf(condition: boolean, message: string): boolean {
    if (condition) {
        vscode.window.showWarningMessage(message);
        return true;
    }
    return false;
}

/**
 * Returns the path to a subdirectory in the workspace root, or shows a warning if not found.
 * @param subdir Name of the subdirectory (e.g. 'devLog')
 * @param missingMsg Message to show if missing
 */
export function getWorkspaceSubdirOrWarn(subdir: string, missingMsg: string): string | undefined {
    const root = getWorkspaceRoot();
    if (!root) {
        vscode.window.showWarningMessage('No workspace folder found.');
        return undefined;
    }
    const dir = path.join(root, subdir);
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
        vscode.window.showWarningMessage(missingMsg);
        return undefined;
    }
    return dir;
}
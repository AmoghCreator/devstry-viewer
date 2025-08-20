import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Returns the root path of the current workspace, or null if not available.
 */
export function getWorkspaceRoot(): string | null {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) return null;
    return folders[0].uri.fsPath;
}

/**
 * Returns the path to the latest devlog markdown file in the devLog directory, or null if not found.
 */
export function getLatestDevlogFile(): string | null {
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

/**
 * Escapes RegExp special characters in a string.
 */
export function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
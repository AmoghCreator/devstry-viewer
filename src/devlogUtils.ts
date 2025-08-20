// Devlog-specific utilities
import * as fs from 'fs';
import * as path from 'path';

/**
 * Parses a line range string like "1-3,5" into an array of numbers: [1,2,3,5]
 */
export function parseLineRange(str: string): number[] {
    const result: number[] = [];
    for (const part of str.split(',')) {
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(Number);
            for (let i = start; i <= end; i++) { result.push(i); }
        } else {
            result.push(Number(part));
        }
    }
    return result;
}

/**
 * Extracts the devlog section for a given file from the devlog markdown content.
 * Returns the section as a string, or empty string if not found.
 */
export function getDevlogSection(content: string, fileName: string): string {
    // Split content by lines for more precise control
    const lines = content.split('\n');
    const startPattern = new RegExp(`^[ \\t]*##\\s+.*${escapeRegExp(fileName)}(?:\\s|$)`);

    let startIndex = -1;
    let endIndex = lines.length;

    // Find the start of our section
    for (let i = 0; i < lines.length; i++) {
        if (startPattern.test(lines[i])) {
            startIndex = i;
            break;
        }
    }

    if (startIndex === -1) return '';

    // Find the end of our section (next ## that starts with a path)
    const nextSectionPattern = /^[ \t]*##\s+\/.*$/;
    for (let i = startIndex + 1; i < lines.length; i++) {
        if (nextSectionPattern.test(lines[i])) {
            endIndex = i;
            break;
        }
    }

    return lines.slice(startIndex, endIndex).join('\n');
}

/**
 * Escapes RegExp special characters in a string.
 */
export function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/**
 * Safely reads a devlog file and returns its content, or undefined if error.
 */
export function readDevlogFileSafe(devlogPath: string): string | undefined {
    try {
        return fs.readFileSync(devlogPath, 'utf8');
    } catch (e) {
        console.error('[DevlogUtils] Failed to read devlog file:', e);
        return undefined;
    }
}

/**
 * Returns all markdown files in the given devlog directory, or empty array if none.
 */
export function getDevlogMarkdownFiles(devlogDir: string): string[] {
    if (!fs.existsSync(devlogDir) || !fs.statSync(devlogDir).isDirectory()) return [];
    return fs.readdirSync(devlogDir).filter(f => f.endsWith('.md'));
}
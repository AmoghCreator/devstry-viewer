import * as fs from 'fs';
import { createHash } from 'crypto';

/**
 * Parses a line range string (e.g. "1-2" => [1,2], "5" => [5])
 */
export function parseLineRange(str: string): number[] {
    if (str.includes('-')) {
        const [start, end] = str.split('-').map(Number);
        const arr = [];
        for (let i = start; i <= end; i++) arr.push(i);
        return arr;
    }
    return [Number(str)];
}

/**
 * Returns a mapping of file sections and line hashes from a devlog markdown file.
 */
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
/**
 * Pattern detection for Claude Code permission prompts
 */

export interface DetectionPattern {
  name: string;
  regex: RegExp;
  extractCommand?: (match: RegExpMatchArray) => string | null;
  extractCwd?: (match: RegExpMatchArray) => string | null;
}

/**
 * Default patterns for Claude Code permission prompts
 * These will need refinement based on actual Claude Code CLI output
 */
export const DEFAULT_PATTERNS: DetectionPattern[] = [
  {
    name: "bash_permission",
    // Matches patterns like: "Allow command execution? (y/n)"
    regex: /allow.*command.*execution.*\(y\/n\)/i,
    extractCommand: () => null, // Will be extracted from context
  },
  {
    name: "file_write_permission",
    // Matches patterns like: "Write to file? (y/n)"
    regex: /write.*file.*\(y\/n\)/i,
    extractCommand: () => null,
  },
  {
    name: "generic_permission",
    // Generic fallback pattern: require a question mark before (y/n) to reduce false positives
    regex: /\?\s*\(y\/n\)\s*$/i,
    extractCommand: () => null,
  },
];

/**
 * Detection result
 */
export interface DetectionResult {
  matched: boolean;
  patternName?: string;
  command?: string;
  cwd?: string;
  rawPrompt: string;
}

/**
 * Line buffer for multi-line pattern detection
 */
export class LineBuffer {
  private lines: string[] = [];
  private maxLines = 50; // Keep last 50 lines for context

  /**
   * Add data to buffer
   */
  add(data: string): void {
    // Split by newlines and add to buffer
    const newLines = data.split(/\r?\n/);

    // If last line doesn't end with newline, merge with previous incomplete line
    if (this.lines.length > 0 && !data.startsWith("\n") && !data.startsWith("\r")) {
      const lastLine = this.lines.pop() || "";
      newLines[0] = lastLine + newLines[0];
    }

    this.lines.push(...newLines);

    // Trim buffer to max size
    if (this.lines.length > this.maxLines) {
      this.lines = this.lines.slice(-this.maxLines);
    }
  }

  /**
   * Get last N lines
   */
  getLastLines(n: number): string[] {
    return this.lines.slice(-n);
  }

  /**
   * Get last complete line
   */
  getLastLine(): string {
    return this.lines[this.lines.length - 1] || "";
  }

  /**
   * Get all lines as context
   */
  getContext(lines = 10): string {
    return this.getLastLines(lines).join("\n");
  }

  /**
   * Clear buffer
   */
  clear(): void {
    this.lines = [];
  }
}

/**
 * Pattern detector
 */
export class PatternDetector {
  private patterns: DetectionPattern[];
  private buffer: LineBuffer;

  constructor(patterns?: DetectionPattern[]) {
    this.patterns = patterns || DEFAULT_PATTERNS;
    this.buffer = new LineBuffer();
  }

  /**
   * Process incoming data and check for pattern match
   */
  process(data: string): DetectionResult {
    this.buffer.add(data);

    // Check last few lines for pattern match
    const lastLine = this.buffer.getLastLine();
    const context = this.buffer.getContext(5);

    for (const pattern of this.patterns) {
      const match = lastLine.match(pattern.regex);

      if (match) {
        return {
          matched: true,
          patternName: pattern.name,
          command: pattern.extractCommand ? (pattern.extractCommand(match) ?? undefined) : undefined,
          cwd: pattern.extractCwd ? (pattern.extractCwd(match) ?? undefined) : undefined,
          rawPrompt: context,
        };
      }
    }

    return {
      matched: false,
      rawPrompt: "",
    };
  }

  /**
   * Clear internal buffer
   */
  reset(): void {
    this.buffer.clear();
  }

  /**
   * Add custom pattern
   */
  addPattern(pattern: DetectionPattern): void {
    this.patterns.push(pattern);
  }

  /**
   * Get current patterns
   */
  getPatterns(): DetectionPattern[] {
    return [...this.patterns];
  }
}

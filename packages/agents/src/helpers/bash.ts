/**
 * Removes a leading `bash -lc` wrapper from a command string and
 * optionally strips a single pair of matching wrapping quotes
 * (`'` or `"`) that encompass the *entire* remaining command.
 *
 * The removal is **case-insensitive** and tolerant to extra whitespace:
 * - Any leading whitespace before `bash` is ignored
 * - There must be **at least one space** between `bash` and `-lc`
 * - Any amount of whitespace *after* `-lc` is removed
 * - If the pattern does **not** occur at the start of the string
 *   (ignoring leading whitespace), the original string is returned
 *
 * Quote-stripping behaviour:
 * - After the `bash -lc` prefix (if present) is removed, the function
 *   checks whether the remaining command is wrapped **entirely** in a
 *   **single pair** of matching quotes
 *   (either `'single-quotes'` or `"double-quotes"`).
 * - If so, that outer pair of quotes is removed-inner quotes or
 *   mismatched/unbalanced quotes are **left untouched**.
 * - The removal occurs **after** the prefix has been trimmed, so
 *   commands without the `bash -lc` wrapper still benefit from the
 *   quote-clean-up.
 *
 * @param {string} command - The raw command entered by the user/tool.
 * @returns {string} The cleaned command without a leading `bash -lc` wrapper
 *                   and without surrounding quotes (if they formed a full,
 *                   matching pair).
 *
 * @example
 * stripBashLcPrefix('bash -lc   ls -la'); // "ls -la"
 * stripBashLcPrefix('echo hi');           // "echo hi"
 * stripBashLcPrefix("bash -lc 'ls -la'"); // "ls -la"
 * stripBashLcPrefix('bash -lc   "echo hi"'); // "echo hi"
 * stripBashLcPrefix("echo 'partial quote"); // "echo 'partial quote"
 */
export function stripBashLcPrefix(command: string): string {
  // Match: optional leading whitespace, "bash", ≥1 space, "-lc",
  // then either ≥1 space or end-of-string.
  const withoutPrefix = command.replace(/^\s*bash\s+-lc(?:\s+|$)/i, '')

  // Trim outer whitespace that may have been left behind
  let cleaned = withoutPrefix.trim()

  // If the entire remaining text is wrapped in matching single or double
  // quotes, remove that outer pair of quotes only.
  const firstChar = cleaned[0]
  const lastChar = cleaned[cleaned.length - 1]
  const isWrappedInQuotes =
    cleaned.length >= 2 &&
    (firstChar === '"' || firstChar === "'") &&
    firstChar === lastChar

  if (isWrappedInQuotes) {
    cleaned = cleaned.slice(1, -1)
  }

  return cleaned
}

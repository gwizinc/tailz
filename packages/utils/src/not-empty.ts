/**
 * Returns true if the value is not null or undefined.
 * @param value - The value to check
 * @returns True if the value is not null or undefined
 */
export function isNotEmpty<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

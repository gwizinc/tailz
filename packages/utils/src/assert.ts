/**
 * Asserts that a condition is true, throwing an error if it's not.
 * @param condition - The condition to check
 * @param message - Optional error message to throw if condition is false
 * @throws Error if condition is false
 */
export function assert(
  condition: unknown,
  message?: string,
): asserts condition {
  if (!condition) {
    throw new Error(message || 'Assertion failed')
  }
}

/**
 * Asserts that a value is not null or undefined.
 * @param value - The value to check
 * @param message - Optional error message to throw if value is null/undefined
 * @throws Error if value is null or undefined
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message?: string,
): asserts value is T {
  assert(value != null, message || 'Value is null or undefined')
}

/**
 * Asserts that a value is a string.
 * @param value - The value to check
 * @param message - Optional error message to throw if value is not a string
 * @throws Error if value is not a string
 */
export function assertString(
  value: unknown,
  message?: string,
): asserts value is string {
  assert(typeof value === 'string', message || 'Value is not a string')
}

/**
 * Asserts that a value is a number.
 * @param value - The value to check
 * @param message - Optional error message to throw if value is not a number
 * @throws Error if value is not a number
 */
export function assertNumber(
  value: unknown,
  message?: string,
): asserts value is number {
  assert(typeof value === 'number', message || 'Value is not a number')
}

/**
 * Asserts that a value is a boolean.
 * @param value - The value to check
 * @param message - Optional error message to throw if value is not a boolean
 * @throws Error if value is not a boolean
 */
export function assertBoolean(
  value: unknown,
  message?: string,
): asserts value is boolean {
  assert(typeof value === 'boolean', message || 'Value is not a boolean')
}

/**
 * Asserts that a value is an object.
 * @param value - The value to check
 * @param message - Optional error message to throw if value is not an object
 * @throws Error if value is not an object
 */
export function assertObject(
  value: unknown,
  message?: string,
): asserts value is Record<string, unknown> {
  assert(
    typeof value === 'object' && value !== null,
    message || 'Value is not an object',
  )
}

/**
 * Asserts that a value is an array.
 * @param value - The value to check
 * @param message - Optional error message to throw if value is not an array
 * @throws Error if value is not an array
 */
export function assertArray<T>(
  value: unknown,
  message?: string,
): asserts value is T[] {
  assert(Array.isArray(value), message || 'Value is not an array')
}

/**
 * Asserts that a value is a string, and is not empty.
 * @param value - The value to check
 * @param message - Optional error message to throw if value is not a non-empty string
 * @throws Error if value is not a non-empty string
 */
export function assertIsStringAndNotEmpty(
  value: unknown,
  message?: string,
): asserts value is string {
  assertString(value, message)
  assert(value.trim().length > 0, message || 'Value is an empty string')
}

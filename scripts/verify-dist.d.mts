// Types for the dependency-free verify-dist script, so its checks can be
// imported and unit-tested with full type-safety.
export function collectFailures(distDir: string): {
  failures: string[]
  checked: number
}

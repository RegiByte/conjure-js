// Auto-generated — do not edit directly.
// Re-generate with: npm run gen:core-source
import { clojure_coreSource } from './clojure-core-source'
import { clojure_stringSource } from './clojure-string-source'

export const builtInNamespaceSources: Record<string, () => string> = {
  'clojure.core': () => clojure_coreSource,
  'clojure.string': () => clojure_stringSource,
}

export function getBuiltInNamespaceSource(nsName: string): string | null {
  const loader = builtInNamespaceSources[nsName]
  return loader ? loader() : null
}

'use client';

// Runs before any component renders on the client.
// Object.hasOwn is ES2022 — missing in older Safari/Node runtimes and some bundler targets.
if (typeof Object.hasOwn === 'undefined') {
  (Object as { hasOwn?: unknown }).hasOwn = function hasOwn(
    obj:  object,
    prop: PropertyKey,
  ): boolean {
    return Object.prototype.hasOwnProperty.call(obj, prop);
  };
}

export function Polyfills() {
  return null;
}

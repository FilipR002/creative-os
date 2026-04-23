// ─── Phase 5.7 — Hard client-scope enforcement ───────────────────────────────
//
// Data classification:
//
//   GLOBAL (no clientId required):
//     • trend signals, aggregated cross-client patterns, anonymized learning
//
//   CLIENT-SCOPED (clientId REQUIRED — throw if missing):
//     • CreativeMemory, decision history, fatigue state, exploration state,
//       execution cache, observability traces
//
// Usage:
//   assertClientScope(clientId);   // throws CLIENT_SCOPE_REQUIRED if falsy
//   assertClientScope(ctx.clientId);

/**
 * TypeScript assertion function that narrows the type of `clientId` to `string`
 * and throws at runtime if the value is falsy (undefined, null, or empty string).
 *
 * Callers in client-scoped services MUST call this before any read or write.
 * If the guard throws, it means a code path is missing a clientId — it is a
 * developer error, not a user-facing condition.
 */
export function assertClientScope(
  clientId: string | null | undefined,
): asserts clientId is string {
  if (!clientId) {
    throw new Error('CLIENT_SCOPE_REQUIRED');
  }
}

/**
 * Returns true when the value is a valid, non-anonymous clientId.
 * Use for early guards that need a boolean rather than an assertion.
 */
export function isClientScoped(clientId: string | null | undefined): clientId is string {
  return !!clientId;
}

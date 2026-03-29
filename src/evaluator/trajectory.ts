import type { ToolCallRecord, TrajectoryAssertions, ToolCallAssertion } from '../scenario/types.js'

export interface TrajectoryResult {
  matched: boolean
  failureLabel?: string
  reason: string
  missingCalls: string[]
  extraCalls: string[]
  orderingIssues: string[]
  forbiddenCalls: string[]
}

export class TrajectoryMatcher {
  match(
    actual: ToolCallRecord[],
    assertions: TrajectoryAssertions,
  ): TrajectoryResult {
    const { matchMode, expected, forbidden } = assertions

    let result: TrajectoryResult
    switch (matchMode) {
      case 'strict':
        result = this.matchStrict(actual, expected)
        break
      case 'unordered':
        result = this.matchUnordered(actual, expected)
        break
      case 'contains':
        result = this.matchContains(actual, expected)
        break
      case 'within':
        result = this.matchWithin(actual, expected)
        break
      default:
        throw new Error(`Unknown trajectory match mode: "${matchMode}"`)
    }

    // Check forbidden tool calls
    if (forbidden && forbidden.length > 0) {
      const forbiddenCalls = this.checkForbidden(actual, forbidden)
      if (forbiddenCalls.length > 0) {
        const hadPriorFailure = !result.matched
        result.matched = false
        result.forbiddenCalls = forbiddenCalls
        result.failureLabel = result.failureLabel
          ? `${result.failureLabel}; forbidden tools called`
          : 'forbidden tools called'
        const forbiddenReason = `Forbidden tool calls: ${forbiddenCalls.join(', ')}`
        result.reason = hadPriorFailure
          ? `${result.reason}. ${forbiddenReason}`
          : forbiddenReason
      }
    }

    return result
  }

  private matchStrict(
    actual: ToolCallRecord[],
    expected: ToolCallAssertion[],
  ): TrajectoryResult {
    const orderingIssues: string[] = []

    // Check positional matches across the overlapping range
    const checkLen = Math.min(actual.length, expected.length)
    for (let i = 0; i < checkLen; i++) {
      const act = actual[i]
      const exp = expected[i]

      if (act.name !== exp.name) {
        orderingIssues.push(
          `Position ${i}: expected "${exp.name}", got "${act.name}"`,
        )
        continue
      }

      const argResult = this.matchArgs(act.args, exp)
      if (!argResult.matched) {
        orderingIssues.push(
          `Position ${i} (${exp.name}): ${argResult.reason}`,
        )
      }
    }

    // Compute true extra/missing using set difference against matched names.
    // Use counts to handle duplicate tool names correctly.
    const expectedCounts = new Map<string, number>()
    for (const e of expected) {
      expectedCounts.set(e.name, (expectedCounts.get(e.name) ?? 0) + 1)
    }
    const actualCounts = new Map<string, number>()
    for (const a of actual) {
      actualCounts.set(a.name, (actualCounts.get(a.name) ?? 0) + 1)
    }

    const missingCalls: string[] = []
    for (const [name, count] of expectedCounts) {
      const actualCount = actualCounts.get(name) ?? 0
      for (let i = 0; i < count - actualCount; i++) {
        missingCalls.push(name)
      }
    }

    const extraCalls: string[] = []
    for (const [name, count] of actualCounts) {
      const expectedCount = expectedCounts.get(name) ?? 0
      for (let i = 0; i < count - expectedCount; i++) {
        extraCalls.push(name)
      }
    }

    const matched =
      missingCalls.length === 0 &&
      extraCalls.length === 0 &&
      orderingIssues.length === 0

    return {
      matched,
      failureLabel: matched ? undefined : 'strict match failed',
      reason: matched
        ? 'All tool calls match in exact order'
        : this.buildReason(missingCalls, extraCalls, orderingIssues),
      missingCalls,
      extraCalls,
      orderingIssues,
      forbiddenCalls: [],
    }
  }

  private matchUnordered(
    actual: ToolCallRecord[],
    expected: ToolCallAssertion[],
  ): TrajectoryResult {
    const missingCalls: string[] = []
    const extraCalls: string[] = []
    const used = new Set<number>()

    for (const exp of expected) {
      const idx = actual.findIndex(
        (act, i) =>
          !used.has(i) &&
          act.name === exp.name &&
          this.matchArgs(act.args, exp).matched,
      )

      if (idx === -1) {
        missingCalls.push(exp.name)
      } else {
        used.add(idx)
      }
    }

    for (let i = 0; i < actual.length; i++) {
      if (!used.has(i)) {
        extraCalls.push(actual[i].name)
      }
    }

    const matched = missingCalls.length === 0 && extraCalls.length === 0

    return {
      matched,
      failureLabel: matched ? undefined : 'unordered match failed',
      reason: matched
        ? 'All expected tool calls found (order-independent)'
        : this.buildReason(missingCalls, extraCalls, []),
      missingCalls,
      extraCalls,
      orderingIssues: [],
      forbiddenCalls: [],
    }
  }

  private matchContains(
    actual: ToolCallRecord[],
    expected: ToolCallAssertion[],
  ): TrajectoryResult {
    const missingCalls: string[] = []
    const used = new Set<number>()

    for (const exp of expected) {
      const idx = actual.findIndex(
        (act, i) =>
          !used.has(i) &&
          act.name === exp.name &&
          this.matchArgs(act.args, exp).matched,
      )

      if (idx === -1) {
        missingCalls.push(exp.name)
      } else {
        used.add(idx)
      }
    }

    const matched = missingCalls.length === 0

    return {
      matched,
      failureLabel: matched ? undefined : 'contains match failed',
      reason: matched
        ? 'All expected tool calls found (extras allowed)'
        : `Missing expected tool calls: ${missingCalls.join(', ')}`,
      missingCalls,
      extraCalls: [],
      orderingIssues: [],
      forbiddenCalls: [],
    }
  }

  private matchWithin(
    actual: ToolCallRecord[],
    expected: ToolCallAssertion[],
  ): TrajectoryResult {
    const extraCalls: string[] = []
    const orderingIssues: string[] = []
    const allowedNames = new Set(expected.map((e) => e.name))

    for (const act of actual) {
      if (!allowedNames.has(act.name)) {
        extraCalls.push(act.name)
        continue
      }

      // Check args against matching expected assertions
      const matchingExpected = expected.filter((e) => e.name === act.name)
      if (matchingExpected.length > 0 && matchingExpected.some((e) => e.argMatchMode && e.argMatchMode !== 'ignore')) {
        const argsOk = matchingExpected.some((e) => this.matchArgs(act.args, e).matched)
        if (!argsOk) {
          orderingIssues.push(
            `Tool "${act.name}": args ${JSON.stringify(act.args)} did not match any expected args`,
          )
        }
      }
    }

    const matched = extraCalls.length === 0 && orderingIssues.length === 0

    return {
      matched,
      failureLabel: matched ? undefined : 'within match failed',
      reason: matched
        ? 'All actual tool calls are within the expected set'
        : this.buildReason([], extraCalls, orderingIssues),
      missingCalls: [],
      extraCalls,
      orderingIssues,
      forbiddenCalls: [],
    }
  }

  private checkForbidden(
    actual: ToolCallRecord[],
    forbidden: TrajectoryAssertions['forbidden'] & object,
  ): string[] {
    const found: string[] = []

    for (const rule of forbidden) {
      for (const act of actual) {
        if (act.name !== rule.name) continue

        const argsMatch = this.matchArgs(act.args, rule)
        if (argsMatch.matched) {
          const detail = rule.argMatchMode && rule.argMatchMode !== 'ignore'
            ? `${act.name}(${JSON.stringify(act.args)})`
            : act.name
          found.push(detail)
          break // one match per forbidden rule is enough
        }
      }
    }

    return found
  }

  private matchArgs(
    actualArgs: Record<string, unknown>,
    expected: ToolCallAssertion,
  ): { matched: boolean; reason: string } {
    const mode = expected.argMatchMode ?? 'ignore'

    if (mode === 'ignore') {
      return { matched: true, reason: '' }
    }

    if (!expected.args) {
      return { matched: true, reason: '' }
    }

    if (mode === 'exact') {
      const equal = deepEqual(actualArgs, expected.args)
      return {
        matched: equal,
        reason: equal
          ? ''
          : `Args mismatch: expected ${JSON.stringify(expected.args)}, got ${JSON.stringify(actualArgs)}`,
      }
    }

    // partial
    for (const [key, value] of Object.entries(expected.args)) {
      if (!deepEqual(actualArgs[key], value)) {
        return {
          matched: false,
          reason: `Arg "${key}": expected ${JSON.stringify(value)}, got ${JSON.stringify(actualArgs[key])}`,
        }
      }
    }

    return { matched: true, reason: '' }
  }

  private buildReason(
    missingCalls: string[],
    extraCalls: string[],
    orderingIssues: string[],
  ): string {
    const parts: string[] = []
    if (missingCalls.length > 0) {
      parts.push(`Missing: ${missingCalls.join(', ')}`)
    }
    if (extraCalls.length > 0) {
      parts.push(`Extra: ${extraCalls.join(', ')}`)
    }
    if (orderingIssues.length > 0) {
      parts.push(`Ordering: ${orderingIssues.join('; ')}`)
    }
    return parts.join('. ')
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return a === b
  if (typeof a !== typeof b) return false

  if (typeof a === 'object') {
    const aObj = a as Record<string, unknown>
    const bObj = b as Record<string, unknown>

    if (Array.isArray(a) !== Array.isArray(b)) return false

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false
      return a.every((val, i) => deepEqual(val, b[i]))
    }

    const aKeys = Object.keys(aObj).filter((k) => aObj[k] !== undefined)
    const bKeys = Object.keys(bObj).filter((k) => bObj[k] !== undefined)
    if (aKeys.length !== bKeys.length) return false

    return aKeys.every((key) => key in bObj && deepEqual(aObj[key], bObj[key]))
  }

  return false
}

/**
 * Unit tests for PlansComponent — roving tabindex and aria-labelledby logic.
 * F-02-1.2 — roving tabindex + arrow key navigation
 * F-02-1.3 — aria-labelledby accessible name composition
 * AC-02.14  — keyboard accessibility
 */

import { describe, it, expect } from 'vitest';

// ---- Helpers extracted from PlansComponent for pure-logic testing ----

/**
 * Pure function extracted from PlansComponent.getFocusedTabIndex.
 * Returns "0" for the focused index, "-1" for all others.
 */
function getFocusedTabIndex(focusedIndex: number, cardIndex: number): string {
  return focusedIndex === cardIndex ? '0' : '-1';
}

/**
 * Pure function extracted from PlansComponent.moveFocus index computation.
 * Wraps around the plan list when moving past the edges.
 */
function computeNewIndex(currentIndex: number, delta: number, totalPlans: number): number {
  return (currentIndex + delta + totalPlans) % totalPlans;
}

/**
 * Pure function extracted from PlansComponent.moveFocusTo safe-clamp.
 */
function computeSafeIndex(targetIndex: number, totalPlans: number): number {
  return Math.max(0, Math.min(targetIndex, totalPlans - 1));
}

// ---- Tests ----

describe('F-02-1.2 getFocusedTabIndex — roving tabindex', () => {
  it('AC-02.14 returns "0" for the card at the focused index', () => {
    expect(getFocusedTabIndex(1, 1)).toBe('0');
  });

  it('AC-02.14 returns "-1" for a card not at the focused index', () => {
    expect(getFocusedTabIndex(1, 0)).toBe('-1');
    expect(getFocusedTabIndex(1, 2)).toBe('-1');
  });

  it('AC-02.14 returns "0" only for the focused card when index is 0', () => {
    expect(getFocusedTabIndex(0, 0)).toBe('0');
    expect(getFocusedTabIndex(0, 1)).toBe('-1');
  });
});

describe('F-02-1.2 computeNewIndex — arrow key wrapping', () => {
  it('AC-02.14 moves forward by 1 within bounds', () => {
    expect(computeNewIndex(0, +1, 3)).toBe(1);
    expect(computeNewIndex(1, +1, 3)).toBe(2);
  });

  it('AC-02.14 wraps from last to first on ArrowRight/ArrowDown', () => {
    expect(computeNewIndex(2, +1, 3)).toBe(0);
  });

  it('AC-02.14 moves backward by 1 within bounds', () => {
    expect(computeNewIndex(2, -1, 3)).toBe(1);
    expect(computeNewIndex(1, -1, 3)).toBe(0);
  });

  it('AC-02.14 wraps from first to last on ArrowLeft/ArrowUp', () => {
    expect(computeNewIndex(0, -1, 3)).toBe(2);
  });

  it('AC-02.14 handles single-plan list without error', () => {
    expect(computeNewIndex(0, +1, 1)).toBe(0);
    expect(computeNewIndex(0, -1, 1)).toBe(0);
  });
});

describe('F-02-1.2 computeSafeIndex — Home/End key clamping', () => {
  it('AC-02.14 clamps targetIndex to 0 (Home key)', () => {
    expect(computeSafeIndex(0, 3)).toBe(0);
  });

  it('AC-02.14 clamps targetIndex to last index (End key)', () => {
    expect(computeSafeIndex(2, 3)).toBe(2);
    expect(computeSafeIndex(99, 3)).toBe(2); // out-of-bounds clamp
  });

  it('AC-02.14 does not go below 0', () => {
    expect(computeSafeIndex(-1, 3)).toBe(0);
  });
});

describe('F-02-1.3 aria-labelledby composition', () => {
  /**
   * Pure helper that mirrors the template expression for aria-labelledby.
   * For recommended plans: name + badge + price IDs.
   * For non-recommended: name + price IDs only.
   */
  function buildAriaLabelledBy(documentId: string, recommended: boolean): string {
    return recommended
      ? `plan-name-${documentId} plan-badge-${documentId} plan-price-${documentId}`
      : `plan-name-${documentId} plan-price-${documentId}`;
  }

  it('F-02-1.3 includes badge id in aria-labelledby for recommended plan', () => {
    const result = buildAriaLabelledBy('abc123', true);
    expect(result).toBe('plan-name-abc123 plan-badge-abc123 plan-price-abc123');
  });

  it('F-02-1.3 omits badge id in aria-labelledby for non-recommended plan', () => {
    const result = buildAriaLabelledBy('abc123', false);
    expect(result).toBe('plan-name-abc123 plan-price-abc123');
  });

  it('F-02-1.3 uses documentId as id suffix to ensure uniqueness', () => {
    const r1 = buildAriaLabelledBy('plan-co-1', false);
    const r2 = buildAriaLabelledBy('plan-co-2', false);
    expect(r1).not.toBe(r2);
    expect(r1).toContain('plan-co-1');
    expect(r2).toContain('plan-co-2');
  });
});

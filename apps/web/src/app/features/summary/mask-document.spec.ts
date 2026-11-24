/**
 * Tests for maskDocument function (AC-03.2, AC-03.16, RN-03.11, G-03.1).
 * AC-03.2  — document number is shown masked.
 * AC-03.16 — full document number does not appear in DOM.
 */
import { describe, it, expect } from 'vitest';
import { maskDocument } from './summary.component';

describe('AC-03.2 maskDocument — last 4 non-separator chars visible (G-03.1)', () => {
  it('AC-03.2 masks plain 10-digit Colombia cédula', () => {
    // 1023456789 → ******6789 (6 masked, 4 visible)
    expect(maskDocument('1023456789')).toBe('******6789');
  });

  it('AC-03.2 masks Chile RUT with hyphen separator — preserves hyphen in position', () => {
    // 12345678-5 → *****678-5 (non-sep chars: 1234567 8 5 → last 4 non-sep: 6,7,8,5; hyphen at pos 8)
    expect(maskDocument('12345678-5')).toBe('*****678-5');
  });

  it('AC-03.2 masks short document number — 7 digits', () => {
    // 9876543 → ***6543 (3 masked, 4 visible)
    expect(maskDocument('9876543')).toBe('***6543');
  });

  it('AC-03.2 document exactly 4 chars — nothing masked', () => {
    expect(maskDocument('1234')).toBe('1234');
  });

  it('AC-03.2 document 3 chars — nothing masked (fewer than 4)', () => {
    expect(maskDocument('123')).toBe('123');
  });

  it('AC-03.2 handles empty string', () => {
    expect(maskDocument('')).toBe('');
  });

  it('AC-03.16 full original number does not appear in masked output', () => {
    const original = '1023456789';
    const masked = maskDocument(original);
    expect(masked).not.toBe(original);
    expect(masked).not.toContain(original);
  });

  it('AC-03.16 full RUT does not appear in masked output', () => {
    const original = '12345678-5';
    const masked = maskDocument(original);
    expect(masked).not.toBe(original);
  });

  it('AC-03.2 separator-only characters in a mixed doc are preserved', () => {
    // '1234-5678-9': non-sep indices (right to left): 10,8,7,6,5,3,2,1,0
    // last 4 non-sep: indices 10(9), 8(8), 7(7), 6(6) → visibleSet={6,7,8,10}
    // result: ****-*678-9
    expect(maskDocument('1234-5678-9')).toBe('****-*678-9');
  });
});

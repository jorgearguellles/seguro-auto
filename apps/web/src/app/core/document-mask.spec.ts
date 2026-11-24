/**
 * Tests for maskDocument and isDocumentKey (AC-03.2, AC-03.16, RN-03.11, G-03.1, F-03-1.1).
 * AC-03.2  — document number is shown masked (last 4 non-separator chars visible).
 * AC-03.16 — full document number does not appear in masked output.
 * F-03-1.1 — isDocumentKey matches country-suffixed keys (documentNumber_CO, rut_CL, etc.).
 */
import { describe, it, expect } from 'vitest';
import { maskDocument, isDocumentKey } from './document-mask';

describe('AC-03.2 maskDocument — last 4 non-separator chars visible (G-03.1)', () => {
  it('AC-03.2 masks plain 10-digit Colombia cédula', () => {
    // 1023456789 → ******6789 (6 masked, 4 visible)
    expect(maskDocument('1023456789')).toBe('******6789');
  });

  it('AC-03.2 masks Chile RUT with hyphen separator — preserves hyphen in position', () => {
    // 12345678-5: non-sep chars right-to-left: 5,8,7,6,5,4,3,2,1 at indices 10,8,7,6,5,4,3,2,1,0
    // last 4 non-sep: index 10(5), 8(8), 7(7), 6(6) → visibleSet={6,7,8,10}
    // result: *****678-5
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
    // '1234-5678-9': last 4 non-sep: index 10(9), 8(8), 7(7), 6(6) → ****-*678-9
    expect(maskDocument('1234-5678-9')).toBe('****-*678-9');
  });
});

describe('F-03-1.1 isDocumentKey — prefix matching for country-suffixed keys', () => {
  it('F-03-1.1 matches documentNumber (bare key)', () => {
    expect(isDocumentKey('documentNumber')).toBe(true);
  });

  it('F-03-1.1 matches documentNumber_CO (real CO seed key)', () => {
    expect(isDocumentKey('documentNumber_CO')).toBe(true);
  });

  it('F-03-1.1 matches documentNumber_CL variant', () => {
    expect(isDocumentKey('documentNumber_CL')).toBe(true);
  });

  it('F-03-1.1 matches rut (bare)', () => {
    expect(isDocumentKey('rut')).toBe(true);
  });

  it('F-03-1.1 matches rut_CL (real CL seed key)', () => {
    expect(isDocumentKey('rut_CL')).toBe(true);
  });

  it('F-03-1.1 matches cedula (bare)', () => {
    expect(isDocumentKey('cedula')).toBe(true);
  });

  it('F-03-1.1 matches cedula_co (mixed case)', () => {
    expect(isDocumentKey('cedula_co')).toBe(true);
  });

  it('F-03-1.1 does NOT match fullName', () => {
    expect(isDocumentKey('fullName')).toBe(false);
  });

  it('F-03-1.1 does NOT match firstName_CO', () => {
    expect(isDocumentKey('firstName_CO')).toBe(false);
  });

  it('F-03-1.1 does NOT match plate_CO', () => {
    expect(isDocumentKey('plate_CO')).toBe(false);
  });

  it('F-03-1.1 does NOT match vehicleYear', () => {
    expect(isDocumentKey('vehicleYear')).toBe(false);
  });

  it('F-03-1.1 does NOT match empty string', () => {
    expect(isDocumentKey('')).toBe(false);
  });
});

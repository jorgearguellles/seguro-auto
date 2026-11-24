/**
 * Tests for plan.schema.ts (ADR-007, ADR-006 pattern).
 * AC-02.13 — tolerant parsing; invalid plans discarded + logged.
 * AC-02.16 — currency ↔ country mismatch discards plan.
 * AC-02.1  — active:false discarded (defense in depth).
 * RN-02.7  — sorted by order asc; ties by documentId asc.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parsePlans } from './plan.schema';
import * as logger from '../logger';

// ---- Fixtures ----

const validCoPlan = {
  documentId: 'plan-co-1',
  name: 'Plan Básico',
  shortDescription: 'Cobertura esencial',
  basePrice: 1200000,
  currency: 'COP',
  coverages: [{ label: 'Responsabilidad civil', description: null, order: 0 }],
  benefits: [],
  order: 1,
  recommended: false,
  active: true,
  country: { code: 'CO' },
};

const validClPlan = {
  documentId: 'plan-cl-1',
  name: 'Plan Todo Riesgo',
  shortDescription: 'Cobertura total',
  basePrice: 45000,
  currency: 'CLP',
  coverages: [{ label: 'Todo riesgo', description: 'Cobertura completa', order: 0 }],
  benefits: [{ label: 'Asistencia vial', description: null, order: 0 }],
  order: 1,
  recommended: true,
  active: true,
  country: { code: 'CL' },
};

const planWithoutCoverages = {
  ...validCoPlan,
  documentId: 'plan-no-coverages',
  coverages: [], // invalid: min(1)
};

const planWithMissingBasePrice = {
  ...validCoPlan,
  documentId: 'plan-no-price',
  basePrice: undefined,
};

const planWithMissingCurrency = {
  ...validCoPlan,
  documentId: 'plan-no-currency',
  currency: undefined,
};

const planWithMismatchedCurrency = {
  ...validCoPlan,
  documentId: 'plan-mismatch',
  currency: 'CLP', // CO plan with CLP → invalid (AC-02.16)
  country: { code: 'CO' },
};

const inactivePlan = {
  ...validCoPlan,
  documentId: 'plan-inactive',
  active: false, // discarded by z.literal(true)
};

describe('AC-02.13 parsePlans — tolerant parsing', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'logStructured').mockImplementation(() => undefined);
  });

  it('AC-02.13 returns empty array for invalid envelope', () => {
    const result = parsePlans({ notData: [] });
    expect(result).toEqual([]);
    expect(logger.logStructured).toHaveBeenCalledWith(
      'strapi.plans.envelopeInvalid',
      expect.any(Object),
    );
  });

  it('AC-02.13 discards plan without coverages and logs documentId', () => {
    const raw = { data: [validCoPlan, planWithoutCoverages] };
    const result = parsePlans(raw);
    expect(result).toHaveLength(1);
    expect(result[0].documentId).toBe('plan-co-1');
    expect(logger.logStructured).toHaveBeenCalledWith(
      'strapi.plans.planDiscarded',
      expect.objectContaining({ documentId: 'plan-no-coverages' }),
    );
  });

  it('AC-02.13 discards plan with missing basePrice', () => {
    const raw = { data: [validCoPlan, planWithMissingBasePrice] };
    const result = parsePlans(raw);
    expect(result).toHaveLength(1);
    expect(logger.logStructured).toHaveBeenCalledWith(
      'strapi.plans.planDiscarded',
      expect.objectContaining({ documentId: 'plan-no-price' }),
    );
  });

  it('AC-02.13 discards plan with missing currency', () => {
    const raw = { data: [validCoPlan, planWithMissingCurrency] };
    const result = parsePlans(raw);
    expect(result).toHaveLength(1);
    expect(logger.logStructured).toHaveBeenCalledWith(
      'strapi.plans.planDiscarded',
      expect.objectContaining({ documentId: 'plan-no-currency' }),
    );
  });

  it('AC-02.13 valid plans are returned', () => {
    const raw = { data: [validCoPlan] };
    const result = parsePlans(raw);
    expect(result).toHaveLength(1);
    expect(result[0].documentId).toBe('plan-co-1');
  });

  it('AC-02.13 returns empty array when envelope data is empty', () => {
    expect(parsePlans({ data: [] })).toEqual([]);
  });
});

describe('AC-02.16 parsePlans — currency ↔ country validation', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'logStructured').mockImplementation(() => undefined);
  });

  it('AC-02.16 discards plan whose currency does not match country (CO + CLP)', () => {
    const raw = { data: [validCoPlan, planWithMismatchedCurrency] };
    const result = parsePlans(raw);
    expect(result).toHaveLength(1);
    expect(result[0].documentId).toBe('plan-co-1');
    expect(logger.logStructured).toHaveBeenCalledWith(
      'strapi.plans.planDiscarded',
      expect.objectContaining({ documentId: 'plan-mismatch' }),
    );
  });

  it('AC-02.16 accepts CL plan with CLP currency', () => {
    const raw = { data: [validClPlan] };
    const result = parsePlans(raw);
    expect(result).toHaveLength(1);
    expect(result[0].currency).toBe('CLP');
  });
});

describe('AC-02.1 parsePlans — defense in depth for inactive plans', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'logStructured').mockImplementation(() => undefined);
  });

  it('AC-02.1 discards plan with active: false (defense in depth)', () => {
    const raw = { data: [validCoPlan, inactivePlan] };
    const result = parsePlans(raw);
    expect(result).toHaveLength(1);
    expect(logger.logStructured).toHaveBeenCalledWith(
      'strapi.plans.planDiscarded',
      expect.objectContaining({ documentId: 'plan-inactive' }),
    );
  });
});

describe('RN-02.7 parsePlans — ordering', () => {
  beforeEach(() => {
    vi.spyOn(logger, 'logStructured').mockImplementation(() => undefined);
  });

  it('RN-02.7 sorts plans by order ascending', () => {
    const p1 = { ...validCoPlan, documentId: 'z', order: 5 };
    const p2 = { ...validCoPlan, documentId: 'a', order: 1 };
    const p3 = { ...validCoPlan, documentId: 'm', order: 3 };
    const raw = { data: [p1, p2, p3] };
    const result = parsePlans(raw);
    expect(result.map((p) => p.order)).toEqual([1, 3, 5]);
  });

  it('RN-02.7 resolves order ties by documentId ascending', () => {
    const p1 = { ...validCoPlan, documentId: 'zzz', order: 5 };
    const p2 = { ...validCoPlan, documentId: 'aaa', order: 5 };
    const raw = { data: [p1, p2] };
    const result = parsePlans(raw);
    expect(result[0].documentId).toBe('aaa');
    expect(result[1].documentId).toBe('zzz');
  });
});

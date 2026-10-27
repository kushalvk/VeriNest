jest.mock('../../models/Property', () => ({ exists: jest.fn() }));

const {
    tokenCoverage,
    isRecentBillYear,
} = require('../propertyVerificationService');

describe('tokenCoverage', () => {
    it('is order-insensitive for names', () => {
        expect(tokenCoverage('Kushal Patel', 'Owner: PATEL KUSHAL R')).toBe(100);
    });
    it('reports partial matches', () => {
        expect(tokenCoverage('Kushal Patel', 'Owner: Kushal Shah')).toBe(50);
    });
    it('returns null when there is nothing to compare', () => {
        expect(tokenCoverage('', 'anything')).toBeNull();
    });
});

describe('isRecentBillYear', () => {
    const now = new Date('2026-10-27');
    it('accepts the current and previous financial year', () => {
        expect(isRecentBillYear('2026-27', now)).toBe(true);
        expect(isRecentBillYear('2025-26', now)).toBe(true);
    });
    it('rejects older bills', () => {
        expect(isRecentBillYear('2024-25', now)).toBe(false);
    });
    it('returns null when the year is unreadable', () => {
        expect(isRecentBillYear(undefined, now)).toBeNull();
    });
});
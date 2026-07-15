const { computeTrustScore } = require('../trustScoreService');

const verifiedDoc = (documentType) => ({
  documentType,
  verificationStatus: 'verified',
});

describe('computeTrustScore', () => {
  test('no verified documents and incomplete profile → zero score, empty reasons', () => {
    const profile = {
      policeVerificationStatus: 'pending',
      currentAddress: { city: 'Pune' }, // permanent address missing
      monthlySalary: undefined,
    };

    const { score, reasons } = computeTrustScore(profile, []);

    expect(score).toBe(0);
    expect(reasons).toEqual([]);

    // also holds with no profile at all
    const noProfile = computeTrustScore(null, []);
    expect(noProfile.score).toBe(0);
    expect(noProfile.reasons).toEqual([]);
  });

  test('2 verified docs + police verification + complete addresses + salary → exact sum', () => {
    const profile = {
      policeVerificationStatus: 'verified',
      currentAddress: { city: 'Pune' },
      permanentAddress: { city: 'Nashik' },
      monthlySalary: 45000,
    };
    const docs = [verifiedDoc('aadhaar'), verifiedDoc('pan')];

    const { score, reasons } = computeTrustScore(profile, docs);

    // 2 × 15 (docs) + 15 (police) + 10 (addresses) + 10 (salary) = 65
    expect(score).toBe(65);
    expect(reasons).toHaveLength(5);
    expect(reasons).toEqual(
      expect.arrayContaining([
        'Verified aadhaar document (+15)',
        'Verified pan document (+15)',
        'Police verification completed (+15)',
        'Profile addresses complete (+10)',
        'Employment salary information provided (+10)',
      ])
    );
    // deterministic: same inputs, same output
    expect(computeTrustScore(profile, docs)).toEqual({ score, reasons });
  });

  test('5+ distinct verified document types → document factor caps at +45', () => {
    const docs = [
      verifiedDoc('aadhaar'),
      verifiedDoc('pan'),
      verifiedDoc('passport'),
      verifiedDoc('salary_slip'),
      verifiedDoc('bank_statement'),
      verifiedDoc('driving_license'),
    ];

    const docsOnly = computeTrustScore(null, docs);
    expect(docsOnly.score).toBe(45); // not 90
    expect(docsOnly.reasons).toHaveLength(3); // only the 3 counted types listed

    // duplicates of one type count once
    const dupes = computeTrustScore(null, [verifiedDoc('aadhaar'), verifiedDoc('aadhaar')]);
    expect(dupes.score).toBe(15);
    expect(dupes.reasons).toHaveLength(1);

    // even with every other rule contributing, total stays within 0–100
    const maxProfile = {
      policeVerificationStatus: 'verified',
      currentAddress: { city: 'A' },
      permanentAddress: { city: 'B' },
      monthlySalary: 99999,
    };
    const maxed = computeTrustScore(maxProfile, docs);
    expect(maxed.score).toBe(80); // 45 + 15 + 10 + 10
    expect(maxed.score).toBeLessThanOrEqual(100);
    expect(maxed.score).toBeGreaterThanOrEqual(0);
  });

  test('rental history ratings: +2 per full star above avg 3, capped, still ≤100', () => {
    // avg 5 → +4
    const fiveStar = computeTrustScore(null, [], [
      { tenantRating: 5 },
      { tenantRating: 5 },
    ]);
    expect(fiveStar.score).toBe(4);
    expect(fiveStar.reasons).toEqual(['Positive rental history rating (+4)']);

    // avg 4 → +2
    const fourStar = computeTrustScore(null, [], [{ tenantRating: 4 }]);
    expect(fourStar.score).toBe(2);

    // avg ≤ 3 → no bonus, no reason
    const threeStar = computeTrustScore(null, [], [{ tenantRating: 3 }]);
    expect(threeStar.score).toBe(0);
    expect(threeStar.reasons).toEqual([]);

    // unrated records and tenant-given ratings are ignored
    const unrated = computeTrustScore(null, [], [{ landlordRating: 5 }, {}]);
    expect(unrated.score).toBe(0);
    expect(unrated.reasons).toEqual([]);

    // everything maxed: 45 + 15 + 10 + 10 + 4 = 84, still within 0–100
    const maxProfile = {
      policeVerificationStatus: 'verified',
      currentAddress: { city: 'A' },
      permanentAddress: { city: 'B' },
      monthlySalary: 90000,
    };
    const docs = ['aadhaar', 'pan', 'passport', 'salary_slip'].map(verifiedDoc);
    const total = computeTrustScore(maxProfile, docs, [{ tenantRating: 5 }]);
    expect(total.score).toBe(84);
    expect(total.score).toBeLessThanOrEqual(100);
  });
});

// Fields a tenant must have filled in before applying to a property.
// Names match the TenantProfile schema (Task 4) exactly.
const REQUIRED_FIELDS = [
  { name: 'dob', get: (p) => p.dob },
  { name: 'occupation', get: (p) => p.occupation },
  {
    name: 'monthlySalary',
    get: (p) => (p.monthlySalary !== undefined && p.monthlySalary !== null ? p.monthlySalary : undefined),
  },
  { name: 'currentAddress.city', get: (p) => p.currentAddress?.city },
  { name: 'emergencyContact.name', get: (p) => p.emergencyContact?.name },
];

/**
 * Checks whether a tenant profile has the minimum fields required to apply
 * to a property. Pass null/undefined when no profile exists at all.
 * Returns { complete: boolean, missingFields: string[] }.
 */
const isTenantProfileComplete = (tenantProfile) => {
  if (!tenantProfile) {
    return {
      complete: false,
      missingFields: REQUIRED_FIELDS.map((f) => f.name),
    };
  }

  const missingFields = REQUIRED_FIELDS.filter((f) => {
    const value = f.get(tenantProfile);
    return value === undefined || value === null || value === '';
  }).map((f) => f.name);

  return { complete: missingFields.length === 0, missingFields };
};

module.exports = { isTenantProfileComplete };

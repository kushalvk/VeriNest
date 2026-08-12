/**
 * Demo (guest) accounts.
 *
 * Two fixed, publicly advertised logins — one tenant, one landlord — so a
 * visitor can explore the whole product without signing up. They are ordinary
 * accounts: every feature genuinely works, writes really hit the database.
 * What makes them safe is that the demo workspace is REBUILT FROM SCRATCH on
 * every demo sign-in (see resetDemoWorkspace, called from the login
 * controller), so whatever the previous visitor did is wiped and the next one
 * always starts from the same curated snapshot.
 *
 * Consequences worth knowing:
 *  - Two people demoing at the same time share one workspace; the second
 *    login resets the first one's data mid-session. Acceptable for a public
 *    demo, and the reason these accounts must never hold anything real.
 *  - Both accounts are reset together, not just the one signing in — the
 *    seeded application/verification request are shared records, so resetting
 *    half of the pair would leave dangling state.
 *  - Demo users are marked isDemo:true, which the frontend uses to show the
 *    "demo mode" banner.
 */
const User = require('../models/User');
const TenantProfile = require('../models/TenantProfile');
const LandlordProfile = require('../models/LandlordProfile');
const Document = require('../models/Document');
const Property = require('../models/Property');
const Application = require('../models/Application');
const Agreement = require('../models/Agreement');
const RentalHistory = require('../models/RentalHistory');
const VerificationRequest = require('../models/VerificationRequest');
const TrustScoreHistory = require('../models/TrustScoreHistory');
const Notification = require('../models/Notification');
const authService = require('./authService');
const trustScoreService = require('./trustScoreService');

/**
 * The advertised credentials. Passwords are intentionally public — they are
 * handed out on the login page — so these accounts get `role` fixed here and
 * can never be admin. Override the passwords with DEMO_TENANT_PASSWORD /
 * DEMO_LANDLORD_PASSWORD if you'd rather not use the defaults.
 */
const DEMO_ACCOUNTS = [
  {
    key: 'tenant',
    role: 'tenant',
    label: 'Demo Tenant',
    fullName: 'Aarav Sharma (Demo)',
    email: 'demo.tenant@verinest.app',
    phone: '9900000001',
    password: process.env.DEMO_TENANT_PASSWORD || 'DemoTenant@123',
    description:
      'Profile, document uploads with OCR, trust score, property search and rental applications.',
  },
  {
    key: 'landlord',
    role: 'landlord',
    label: 'Demo Landlord',
    fullName: 'Meera Patel (Demo)',
    email: 'demo.landlord@verinest.app',
    phone: '9900000002',
    password: process.env.DEMO_LANDLORD_PASSWORD || 'DemoLandlord@123',
    description:
      'Property listings, incoming applications, tenant verification requests and agreements.',
  },
];

const DEMO_EMAILS = DEMO_ACCOUNTS.map((a) => a.email);

/** Cloudinary's public demo assets — no account or upload needed. */
const SAMPLE_IMAGE =
  'https://res.cloudinary.com/demo/image/upload/w_800,h_600,c_fill/sample.jpg';
const SAMPLE_DOC_IMAGE =
  'https://res.cloudinary.com/demo/image/upload/w_800,c_fit/sample.jpg';

const daysFromNow = (days) => new Date(Date.now() + days * 86400000);
const daysAgo = (days) => new Date(Date.now() - days * 86400000);

const isDemoEmail = (email) =>
  typeof email === 'string' && DEMO_EMAILS.includes(email.trim().toLowerCase());

/**
 * Public shape for GET /api/auth/demo-accounts — deliberately includes the
 * password, which is the whole point of a demo login. Only accounts that
 * actually exist in this database are returned, so the login page hides the
 * section entirely until `npm run seed:demo` has been run.
 */
const listDemoAccounts = async () => {
  const existing = await User.find({ email: { $in: DEMO_EMAILS }, isDemo: true }).select(
    'email'
  );
  const seeded = new Set(existing.map((u) => u.email));
  return DEMO_ACCOUNTS.filter((a) => seeded.has(a.email)).map((a) => ({
    role: a.role,
    label: a.label,
    email: a.email,
    password: a.password,
    description: a.description,
  }));
};

/**
 * Ids of the seeded demo accounts — for queries that must leave demo-owned
 * records out, such as the public property search. Matches on the fixed emails
 * (indexed) rather than isDemo, and returns [] before `npm run seed:demo` has
 * been run.
 */
const getDemoUserIds = async () => {
  const users = await User.find({ email: { $in: DEMO_EMAILS }, isDemo: true }).select(
    '_id'
  );
  return users.map((u) => u._id);
};

/**
 * Creates the demo users if missing and re-applies their canonical fields
 * (password, role, active status) if they already exist. Idempotent — safe to
 * run on every seed and on every demo login.
 */
const ensureDemoAccounts = async () => {
  const users = {};

  for (const account of DEMO_ACCOUNTS) {
    const password = await authService.hashPassword(account.password);
    const user = await User.findOneAndUpdate(
      { email: account.email },
      {
        $set: {
          fullName: account.fullName,
          phone: account.phone,
          password,
          role: account.role,
          authProvider: 'local',
          isDemo: true,
          isEmailVerified: true,
          isPhoneVerified: true,
          accountStatus: 'active',
        },
      },
      { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
    );
    users[account.key] = user;
  }

  return users;
};

/** Removes every record the demo accounts own. */
const wipeDemoData = async (tenant, landlord) => {
  const ids = [tenant._id, landlord._id];
  const partyFilter = {
    $or: [{ tenantId: { $in: ids } }, { landlordId: { $in: ids } }],
  };
  // Applications from real users onto demo properties are demo data too.
  const propertyIds = (await Property.find({ landlordId: landlord._id }).select('_id')).map(
    (p) => p._id
  );

  await Promise.all([
    TenantProfile.deleteMany({ userId: { $in: ids } }),
    LandlordProfile.deleteMany({ userId: { $in: ids } }),
    Document.deleteMany({ tenantId: { $in: ids } }),
    TrustScoreHistory.deleteMany({ tenantId: { $in: ids } }),
    Notification.deleteMany({ receiverId: { $in: ids } }),
    VerificationRequest.deleteMany(partyFilter),
    Agreement.deleteMany(partyFilter),
    RentalHistory.deleteMany(partyFilter),
    Application.deleteMany(
      propertyIds.length
        ? { $or: [...partyFilter.$or, { propertyId: { $in: propertyIds } }] }
        : partyFilter
    ),
    Property.deleteMany({ landlordId: landlord._id }),
  ]);
};

/**
 * Rebuilds the curated snapshot: profiles, three listings, two documents (one
 * verified, one awaiting admin review), two applications (one pending, one
 * accepted), a pending verification request and a few notifications so the
 * bell is not empty.
 */
const seedDemoData = async (tenant, landlord) => {
  await LandlordProfile.create({
    userId: landlord._id,
    companyName: 'Patel Estates (Demo)',
    gstNumber: '24AAAAA0000A1Z5',
    address: '14 Riverside Avenue',
    city: 'Ahmedabad',
    state: 'Gujarat',
    bio: 'Family-run letting agency managing serviced apartments since 2011. This is a demo account.',
  });

  await TenantProfile.create({
    userId: tenant._id,
    dob: new Date('1996-04-18'),
    gender: 'Male',
    occupation: 'Software Engineer',
    companyName: 'Northwind Technologies',
    designation: 'Senior Developer',
    employmentType: 'Full Time',
    monthlySalary: 92000,
    currentAddress: {
      addressLine1: 'Flat 302, Lakeview Residency',
      addressLine2: 'Satellite Road',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pincode: '380015',
    },
    permanentAddress: {
      addressLine1: '7 Gandhi Nagar',
      city: 'Surat',
      state: 'Gujarat',
      pincode: '395003',
    },
    emergencyContact: { name: 'Priya Sharma', relation: 'Sister', phone: '9900000003' },
    familyMembers: [{ name: 'Priya Sharma', relation: 'Sister', age: 27 }],
    policeVerificationStatus: 'verified',
  });

  const properties = await Property.insertMany([
    {
      landlordId: landlord._id,
      title: '2BHK Apartment in Ahmedabad — Satellite',
      description:
        'Bright corner flat with a covered balcony, five minutes from the metro. Demo listing.',
      propertyType: 'Apartment',
      rent: 24000,
      securityDeposit: 75000,
      furnishing: 'Semi-Furnished',
      bedrooms: 2,
      bathrooms: 2,
      area: 1080,
      amenities: ['parking', 'lift', 'security', 'power backup'],
      address: {
        addressLine: '12 Satellite Road',
        city: 'Ahmedabad',
        state: 'Gujarat',
        pincode: '380015',
      },
      images: [{ publicId: 'demo/sample', url: SAMPLE_IMAGE }],
      availability: daysFromNow(7),
      rules: ['No smoking', 'Vegetarian preferred'],
      status: 'available',
    },
    {
      landlordId: landlord._id,
      title: '3BHK Villa in Ahmedabad — Bopal',
      description: 'Independent villa with a private garden and covered parking. Demo listing.',
      propertyType: 'Villa',
      rent: 45000,
      securityDeposit: 150000,
      furnishing: 'Furnished',
      bedrooms: 3,
      bathrooms: 3,
      area: 2100,
      amenities: ['parking', 'garden', 'security', 'power backup'],
      address: {
        addressLine: '5 Bopal Cross Road',
        city: 'Ahmedabad',
        state: 'Gujarat',
        pincode: '380058',
      },
      images: [{ publicId: 'demo/sample', url: SAMPLE_IMAGE }],
      availability: daysFromNow(21),
      rules: ['No pets'],
      status: 'available',
    },
    {
      landlordId: landlord._id,
      title: 'Studio Apartment in Mumbai — Andheri East',
      description: 'Compact studio ideal for a working professional. Demo listing.',
      propertyType: 'Studio',
      rent: 32000,
      securityDeposit: 100000,
      furnishing: 'Furnished',
      bedrooms: 1,
      bathrooms: 1,
      area: 520,
      amenities: ['lift', 'gym', 'security'],
      address: {
        addressLine: '88 Chakala Road',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400059',
      },
      images: [{ publicId: 'demo/sample', url: SAMPLE_IMAGE }],
      availability: daysFromNow(3),
      rules: [],
      status: 'available',
    },
  ]);

  await Document.insertMany([
    {
      tenantId: tenant._id,
      documentType: 'aadhaar',
      cloudinary: { publicId: 'demo/sample', url: SAMPLE_DOC_IMAGE },
      extractedData: {
        name: 'Aarav Sharma',
        aadhaarNumber: 'XXXX XXXX 4821',
        dob: '18/04/1996',
      },
      verificationStatus: 'verified',
      verifiedAt: daysAgo(9),
      ocrStatus: 'done',
      remarks: 'Verified during onboarding.',
    },
    {
      tenantId: tenant._id,
      documentType: 'salary_slip',
      cloudinary: { publicId: 'demo/sample', url: SAMPLE_DOC_IMAGE },
      extractedData: { employer: 'Northwind Technologies', netPay: '92,000' },
      verificationStatus: 'pending',
      ocrStatus: 'done',
    },
  ]);

  const [pendingApplication, acceptedApplication] = await Application.create([
    {
      tenantId: tenant._id,
      propertyId: properties[0]._id,
      landlordId: landlord._id,
      status: 'pending',
      message: 'Hi! I work nearby and would love to view this flat over the weekend.',
      appliedAt: daysAgo(2),
    },
    {
      tenantId: tenant._id,
      propertyId: properties[1]._id,
      landlordId: landlord._id,
      status: 'accepted',
      message: 'Looking for a long-term rental — happy to share all my documents.',
      appliedAt: daysAgo(6),
    },
  ]);

  await VerificationRequest.create({
    landlordId: landlord._id,
    tenantId: tenant._id,
    applicationId: acceptedApplication._id,
    accessType: '24_hours',
    status: 'pending',
  });

  await Notification.insertMany([
    {
      receiverId: tenant._id,
      title: 'Document verified',
      message: 'Your Aadhaar document was verified and your trust score has been updated.',
      type: 'push',
      event: 'general',
      isRead: false,
    },
    {
      receiverId: tenant._id,
      title: 'Application accepted',
      message: `Your application for "${properties[1].title}" was accepted.`,
      type: 'push',
      event: 'application',
      isRead: false,
    },
    {
      receiverId: tenant._id,
      title: 'Verification access requested',
      message: 'A landlord has requested access to your verification profile.',
      type: 'push',
      event: 'verification_request',
      isRead: false,
    },
    {
      receiverId: landlord._id,
      title: 'New rental application',
      message: `${tenant.fullName} applied for "${properties[0].title}".`,
      type: 'push',
      event: 'application',
      isRead: false,
    },
  ]);

  // Real scoring pass, so the demo trust score and its history entry are
  // produced by the same code path as a live account.
  await trustScoreService.recalculateAndPersist(tenant._id, 'System');

  return {
    properties: properties.length,
    applications: [pendingApplication, acceptedApplication].length,
  };
};

/**
 * Wipe + reseed both demo accounts. Called on every demo sign-in, and by
 * `npm run seed:demo`.
 */
const resetDemoWorkspace = async () => {
  const { tenant, landlord } = await ensureDemoAccounts();
  await wipeDemoData(tenant, landlord);
  const summary = await seedDemoData(tenant, landlord);
  return { tenant, landlord, ...summary };
};

module.exports = {
  DEMO_ACCOUNTS,
  isDemoEmail,
  getDemoUserIds,
  listDemoAccounts,
  ensureDemoAccounts,
  resetDemoWorkspace,
};

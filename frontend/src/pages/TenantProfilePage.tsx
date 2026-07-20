import { useEffect, useRef, useState, type FormEvent } from 'react';
import * as profileApi from '../api/profileApi';
import { getApiError } from '../api/client';
import AddressFields from '../components/AddressFields';
import { FieldError, FormAlert, buttonClass, inputClass, labelClass } from '../components/AuthCard';
import type { Address, EmploymentType, Gender, TenantProfile } from '../api/profileApi';

const AADHAAR_REGEX = /^\d{12}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const GENDERS: Gender[] = ['Male', 'Female', 'Other'];
const EMPLOYMENT_TYPES: EmploymentType[] = ['Full Time', 'Part Time', 'Business', 'Student', 'Other'];

const emptyAddress: Address = { addressLine1: '', addressLine2: '', city: '', state: '', pincode: '' };

interface FormState {
  dob: string;
  gender: '' | Gender;
  occupation: string;
  companyName: string;
  designation: string;
  employmentType: '' | EmploymentType;
  monthlySalary: string;
  aadhaarNumber: string;
  panNumber: string;
  passportNumber: string;
  currentAddress: Address;
  permanentAddress: Address;
  emergencyContact: { name: string; relation: string; phone: string };
  familyMembers: Array<{ name: string; relation: string; age: string }>;
}

const emptyForm: FormState = {
  dob: '', gender: '', occupation: '', companyName: '', designation: '',
  employmentType: '', monthlySalary: '', aadhaarNumber: '', panNumber: '', passportNumber: '',
  currentAddress: { ...emptyAddress }, permanentAddress: { ...emptyAddress },
  emergencyContact: { name: '', relation: '', phone: '' },
  familyMembers: [],
};

const fromProfile = (p: TenantProfile): FormState => ({
  dob: p.dob ? p.dob.slice(0, 10) : '',
  gender: p.gender ?? '',
  occupation: p.occupation ?? '',
  companyName: p.companyName ?? '',
  designation: p.designation ?? '',
  employmentType: p.employmentType ?? '',
  monthlySalary: p.monthlySalary != null ? String(p.monthlySalary) : '',
  aadhaarNumber: p.aadhaarNumber ?? '',
  panNumber: p.panNumber ?? '',
  passportNumber: p.passportNumber ?? '',
  currentAddress: { ...emptyAddress, ...p.currentAddress },
  permanentAddress: { ...emptyAddress, ...p.permanentAddress },
  emergencyContact: {
    name: p.emergencyContact?.name ?? '',
    relation: p.emergencyContact?.relation ?? '',
    phone: p.emergencyContact?.phone ?? '',
  },
  familyMembers: (p.familyMembers ?? []).map((m) => ({
    name: m.name ?? '', relation: m.relation ?? '', age: m.age != null ? String(m.age) : '',
  })),
});

// Empty strings are stripped so optional enum/number fields don't trip
// backend schema validation; the backend remains the authority.
const toPayload = (f: FormState): TenantProfile => {
  const str = (v: string) => (v.trim() ? v.trim() : undefined);
  const addr = (a: Address) => {
    const out: Address = {};
    (Object.keys(a) as Array<keyof Address>).forEach((k) => {
      if (a[k]?.trim()) out[k] = a[k]!.trim();
    });
    return Object.keys(out).length ? out : undefined;
  };
  return {
    dob: str(f.dob),
    gender: f.gender || undefined,
    occupation: str(f.occupation),
    companyName: str(f.companyName),
    designation: str(f.designation),
    employmentType: f.employmentType || undefined,
    monthlySalary: f.monthlySalary.trim() ? Number(f.monthlySalary) : undefined,
    aadhaarNumber: str(f.aadhaarNumber),
    panNumber: str(f.panNumber),
    passportNumber: str(f.passportNumber),
    currentAddress: addr(f.currentAddress),
    permanentAddress: addr(f.permanentAddress),
    emergencyContact:
      f.emergencyContact.name || f.emergencyContact.relation || f.emergencyContact.phone
        ? {
            name: str(f.emergencyContact.name),
            relation: str(f.emergencyContact.relation),
            phone: str(f.emergencyContact.phone),
          }
        : undefined,
    familyMembers: f.familyMembers
      .filter((m) => m.name.trim() || m.relation.trim() || m.age.trim())
      .map((m) => ({
        name: str(m.name),
        relation: str(m.relation),
        age: m.age.trim() ? Number(m.age) : undefined,
      })),
  };
};

const sectionClass = 'rounded-lg border border-line bg-surface p-5';
const sectionTitle = 'mb-3 text-sm font-semibold uppercase tracking-wide text-ink-faint';

export default function TenantProfilePage() {
  const [mode, setMode] = useState<'loading' | 'create' | 'edit'>('loading');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<{ aadhaarNumber?: string; panNumber?: string }>({});
  const [banner, setBanner] = useState<{ tone: 'error' | 'success'; message: string } | null>(null);
  const [sameAsCurrent, setSameAsCurrent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Synchronous re-entry guard: state updates are async, so a fast double
  // submit could fire two concurrent saves before `submitting` flips. A ref
  // blocks the second one immediately.
  const submitLock = useRef(false);

  useEffect(() => {
    let cancelled = false;
    profileApi
      .getMyTenantProfile()
      .then((profile) => {
        if (cancelled) return;
        if (profile) {
          setForm(fromProfile(profile));
          setMode('edit');
        } else {
          setMode('create');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setMode('create');
          setBanner({ tone: 'error', message: getApiError(err) });
        }
      });
    return () => { cancelled = true; };
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const validate = (f: FormState) => {
    const errors: typeof fieldErrors = {};
    if (f.aadhaarNumber && !AADHAAR_REGEX.test(f.aadhaarNumber)) {
      errors.aadhaarNumber = 'Aadhaar must be exactly 12 digits';
    }
    if (f.panNumber && !PAN_REGEX.test(f.panNumber)) {
      errors.panNumber = 'PAN format: AAAAA9999A (5 letters, 4 digits, 1 letter)';
    }
    return errors;
  };

  const onSameAsCurrent = (checked: boolean) => {
    setSameAsCurrent(checked);
    if (checked) set('permanentAddress', { ...form.currentAddress });
  };

  const addFamilyMember = () =>
    set('familyMembers', [...form.familyMembers, { name: '', relation: '', age: '' }]);
  const removeFamilyMember = (index: number) =>
    set('familyMembers', form.familyMembers.filter((_, i) => i !== index));
  const setFamilyMember = (index: number, key: 'name' | 'relation' | 'age', value: string) =>
    set('familyMembers', form.familyMembers.map((m, i) => (i === index ? { ...m, [key]: value } : m)));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitLock.current || submitting || mode === 'loading') return;
    setBanner(null);

    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    submitLock.current = true;
    setSubmitting(true);
    try {
      const payload = toPayload(form);
      const saved = await profileApi.saveTenantProfile(payload);
      setForm(fromProfile(saved));
      setMode('edit');
      setBanner({ tone: 'success', message: mode === 'create' ? 'Profile created successfully.' : 'Profile updated successfully.' });
      window.scrollTo({ top: 0 });
    } catch (err) {
      // Map backend field validation back onto the field when possible.
      const message = getApiError(err);
      if (/aadhaar/i.test(message)) setFieldErrors({ aadhaarNumber: message });
      else if (/PAN/i.test(message)) setFieldErrors({ panNumber: message });
      setBanner({ tone: 'error', message });
      window.scrollTo({ top: 0 });
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  if (mode === 'loading') {
    return <main className="flex items-center justify-center py-24 text-ink-faint">Loading profile…</main>;
  }

  return (
    <main className="pb-16">
      <form onSubmit={onSubmit} noValidate className="mx-auto mt-8 max-w-3xl space-y-6 px-4">
        <div>
          <h1 className="text-2xl font-bold text-ink" data-testid="profile-title">
            {mode === 'create' ? 'Complete your tenant profile' : 'Edit your tenant profile'}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            A complete profile is required before applying to properties.
          </p>
        </div>

        {banner && <FormAlert tone={banner.tone} message={banner.message} />}

        <section className={sectionClass}>
          <h2 className={sectionTitle}>Personal details</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="dob" className={labelClass}>Date of birth</label>
              <input id="dob" type="date" className={inputClass} value={form.dob}
                onChange={(e) => set('dob', e.target.value)} />
            </div>
            <div>
              <label htmlFor="gender" className={labelClass}>Gender</label>
              <select id="gender" className={inputClass} value={form.gender}
                onChange={(e) => set('gender', e.target.value as FormState['gender'])}>
                <option value="">Select…</option>
                {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className={sectionTitle}>Employment</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="occupation" className={labelClass}>Occupation</label>
              <input id="occupation" className={inputClass} value={form.occupation}
                onChange={(e) => set('occupation', e.target.value)} />
            </div>
            <div>
              <label htmlFor="employmentType" className={labelClass}>Employment type</label>
              <select id="employmentType" className={inputClass} value={form.employmentType}
                onChange={(e) => set('employmentType', e.target.value as FormState['employmentType'])}>
                <option value="">Select…</option>
                {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="companyName" className={labelClass}>Company name</label>
              <input id="companyName" className={inputClass} value={form.companyName}
                onChange={(e) => set('companyName', e.target.value)} />
            </div>
            <div>
              <label htmlFor="designation" className={labelClass}>Designation</label>
              <input id="designation" className={inputClass} value={form.designation}
                onChange={(e) => set('designation', e.target.value)} />
            </div>
            <div>
              <label htmlFor="monthlySalary" className={labelClass}>Monthly salary (Rs.)</label>
              <input id="monthlySalary" type="number" min="0" className={inputClass} value={form.monthlySalary}
                onChange={(e) => set('monthlySalary', e.target.value)} />
            </div>
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className={sectionTitle}>Identity documents</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="aadhaarNumber" className={labelClass}>Aadhaar number</label>
              <input id="aadhaarNumber" inputMode="numeric" maxLength={12} className={inputClass}
                value={form.aadhaarNumber}
                onChange={(e) => set('aadhaarNumber', e.target.value.replace(/\D/g, ''))} />
              <FieldError message={fieldErrors.aadhaarNumber} />
            </div>
            <div>
              <label htmlFor="panNumber" className={labelClass}>PAN number</label>
              <input id="panNumber" maxLength={10} className={`${inputClass} uppercase`}
                value={form.panNumber}
                onChange={(e) => set('panNumber', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
              <FieldError message={fieldErrors.panNumber} />
            </div>
            <div>
              <label htmlFor="passportNumber" className={labelClass}>Passport number (optional)</label>
              <input id="passportNumber" className={inputClass} value={form.passportNumber}
                onChange={(e) => set('passportNumber', e.target.value.toUpperCase())} />
            </div>
          </div>
        </section>

        <section className={sectionClass}>
          <h2 className={sectionTitle}>Current address</h2>
          <AddressFields idPrefix="current" value={form.currentAddress}
            onChange={(next) => {
              set('currentAddress', next);
              if (sameAsCurrent) set('permanentAddress', { ...next });
            }} />
        </section>

        <section className={sectionClass}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className={`${sectionTitle} mb-0`}>Permanent address</h2>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-muted">
              <input type="checkbox" id="sameAsCurrent" checked={sameAsCurrent}
                onChange={(e) => onSameAsCurrent(e.target.checked)}
                className="h-4 w-4 rounded border-line-strong text-primary-600" />
              Same as current address
            </label>
          </div>
          <AddressFields idPrefix="permanent" value={form.permanentAddress}
            onChange={(next) => { set('permanentAddress', next); setSameAsCurrent(false); }} />
        </section>

        <section className={sectionClass}>
          <h2 className={sectionTitle}>Emergency contact</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(['name', 'relation', 'phone'] as const).map((key) => (
              <div key={key}>
                <label htmlFor={`emergency-${key}`} className={`${labelClass} capitalize`}>{key}</label>
                <input id={`emergency-${key}`} className={inputClass} value={form.emergencyContact[key]}
                  onChange={(e) => set('emergencyContact', { ...form.emergencyContact, [key]: e.target.value })} />
              </div>
            ))}
          </div>
        </section>

        <section className={sectionClass}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className={`${sectionTitle} mb-0`}>Family members (optional)</h2>
            <button type="button" onClick={addFamilyMember} data-testid="add-family-member"
              className="rounded-md border border-primary-300 px-3 py-1 text-sm font-medium text-primary-700 hover:bg-primary-50">
              + Add member
            </button>
          </div>
          {form.familyMembers.length === 0 && (
            <p className="text-sm text-ink-faint">No family members added.</p>
          )}
          <div className="space-y-3">
            {form.familyMembers.map((member, i) => (
              <div key={i} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_100px_auto]" data-testid="family-member-row">
                <div>
                  <label className={labelClass} htmlFor={`fm-name-${i}`}>Name</label>
                  <input id={`fm-name-${i}`} className={inputClass} value={member.name}
                    onChange={(e) => setFamilyMember(i, 'name', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass} htmlFor={`fm-relation-${i}`}>Relation</label>
                  <input id={`fm-relation-${i}`} className={inputClass} value={member.relation}
                    onChange={(e) => setFamilyMember(i, 'relation', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass} htmlFor={`fm-age-${i}`}>Age</label>
                  <input id={`fm-age-${i}`} type="number" min="0" className={inputClass} value={member.age}
                    onChange={(e) => setFamilyMember(i, 'age', e.target.value)} />
                </div>
                <button type="button" onClick={() => removeFamilyMember(i)}
                  className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50">
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>

        <button type="submit" className={buttonClass} disabled={submitting}>
          {submitting ? 'Saving…' : mode === 'create' ? 'Create profile' : 'Save changes'}
        </button>
      </form>
    </main>
  );
}

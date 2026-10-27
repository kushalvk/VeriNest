import type {
    PropertyVerification,
    PropertyVerificationStatus,
} from '../api/propertyApi';

export type Tone = 'good' | 'warn' | 'bad' | 'muted';

export const toneClass: Record<Tone, string> = {
    good: 'bg-green-100 text-green-800 border-green-200',
    warn: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    bad: 'bg-red-100 text-red-700 border-red-200',
    muted: 'bg-line text-ink-muted border-line-strong',
};

export const verificationBadge: Record<
    PropertyVerificationStatus,
    { label: string; tone: Tone }
> = {
    not_submitted: { label: 'Bill not uploaded', tone: 'muted' },
    pending: { label: 'Pending review', tone: 'warn' },
    verified: { label: 'Verified', tone: 'good' },
    rejected: { label: 'Rejected', tone: 'bad' },
};

const scoreTone = (n: number): Tone => (n >= 70 ? 'good' : n >= 40 ? 'warn' : 'bad');

/** Advisory signals for the admin reviewer — never a verdict on their own. */
export const autoCheckChips = (
    v?: PropertyVerification
): Array<{ label: string; tone: Tone }> => {
    const c = v?.autoChecks;
    if (!c) return [];
    const chips: Array<{ label: string; tone: Tone }> = [];

    chips.push(
        c.ownerNameMatch == null
            ? { label: 'Owner name: not readable', tone: 'muted' }
            : { label: `Owner name match ${c.ownerNameMatch}%`, tone: scoreTone(c.ownerNameMatch) }
    );
    chips.push(
        c.addressMatch == null
            ? { label: 'Address: not readable', tone: 'muted' }
            : { label: `Address match ${c.addressMatch}%`, tone: scoreTone(c.addressMatch) }
    );
    if (c.billYearValid === true) chips.push({ label: 'Bill year OK', tone: 'good' });
    else if (c.billYearValid === false)
        chips.push({ label: 'Old bill (not current/previous FY)', tone: 'bad' });
    else chips.push({ label: 'Bill year: not found', tone: 'muted' });

    if (c.duplicateBill)
        chips.push({ label: 'Same tax ID on another property', tone: 'bad' });
    if (c.lowOcrConfidence)
        chips.push({ label: 'Low OCR confidence — check image', tone: 'warn' });

    return chips;
};
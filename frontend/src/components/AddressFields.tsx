import type { Address } from '../api/profileApi';
import { inputClass, labelClass } from './AuthCard';

interface Props {
  idPrefix: string;
  value: Address;
  onChange: (next: Address) => void;
}

const FIELDS: Array<{ key: keyof Address; label: string; span2?: boolean }> = [
  { key: 'addressLine1', label: 'Address line 1', span2: true },
  { key: 'addressLine2', label: 'Address line 2', span2: true },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'pincode', label: 'Pincode' },
];

export default function AddressFields({ idPrefix, value, onChange }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {FIELDS.map(({ key, label, span2 }) => (
        <div key={key} className={span2 ? 'sm:col-span-2' : ''}>
          <label htmlFor={`${idPrefix}-${key}`} className={labelClass}>
            {label}
          </label>
          <input
            id={`${idPrefix}-${key}`}
            className={inputClass}
            value={value[key] ?? ''}
            onChange={(e) => onChange({ ...value, [key]: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}

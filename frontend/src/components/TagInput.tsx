import { useState, type KeyboardEvent } from 'react';
import { inputClass } from './AuthCard';

interface Props {
  id: string;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

/** Minimal tag input: Enter or comma adds a chip, × removes it. */
export default function TagInput({ id, value, onChange, placeholder }: Props) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const tag = draft.trim().replace(/,+$/, '');
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700">
              {tag}
              <button type="button" aria-label={`Remove ${tag}`}
                onClick={() => onChange(value.filter((t) => t !== tag))}
                className="text-primary-400 hover:text-primary-700">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input id={id} className={inputClass} value={draft} placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} onBlur={commit} />
    </div>
  );
}

'use client';

export default function ToggleSwitch({ checked, onChange, disabled = false, label }) {
  return (
    <label className={`relative inline-block w-[42px] h-6 flex-shrink-0 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="opacity-0 w-0 h-0 peer"
      />
      <span
        className={`absolute inset-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-forest-lt peer-focus-visible:ring-offset-2 ${
          checked ? 'bg-forest-mid' : 'bg-border'
        }`}
      />
      <span
        className={`absolute top-[3px] w-[18px] h-[18px] bg-white rounded-full transition-all ${
          checked ? 'left-[21px]' : 'left-[3px]'
        }`}
      />
    </label>
  );
}

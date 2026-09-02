'use client';

import { useState } from 'react';

export default function ToggleSwitch({ defaultChecked = true }) {
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <label className="relative inline-block w-[42px] h-6 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => setChecked((c) => !c)}
        className="opacity-0 w-0 h-0 peer"
      />
      <span
        className={`absolute inset-0 rounded-full transition-colors ${
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

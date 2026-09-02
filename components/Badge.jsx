const COLOR_MAP = {
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  blue: 'bg-blue-100 text-blue-800',
  purple: 'bg-violet-100 text-violet-800',
  rose: 'bg-rose-100 text-rose-800',
};

export default function Badge({ text, color = 'green', className = '' }) {
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${COLOR_MAP[color] || COLOR_MAP.green} ${className}`}
    >
      {text}
    </span>
  );
}

export function Stars({ value }) {
  return <span className="text-amber text-[13px]">{value}</span>;
}

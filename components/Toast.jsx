export default function Toast({ message, show }) {
  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 bg-ink text-white px-5 py-2.5 rounded-xl text-sm font-medium shadow-card-lg z-[999] transition-opacity duration-200 pointer-events-none ${
        show ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {message}
    </div>
  );
}

export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden bg-ink-950">
      <div className="absolute inset-0 bg-grid-fade bg-[size:44px_44px] opacity-[0.35] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
      <div className="absolute -left-32 -top-24 h-80 w-80 rounded-full bg-neon-violet/[0.13] blur-[100px]" />
      <div className="absolute -right-36 top-1/4 h-96 w-96 rounded-full bg-neon-cyan/[0.055] blur-[110px]" />
      <div className="absolute -bottom-40 left-1/3 h-96 w-80 rounded-full bg-neon-lime/[0.055] blur-[120px]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon-lime/25 to-transparent" />
      <div className="noise absolute inset-0 opacity-[0.035]" />
    </div>
  );
}

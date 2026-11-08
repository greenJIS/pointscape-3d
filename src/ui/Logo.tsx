export function Logo({ className = '' }: { readonly className?: string }) {
  return (
    <h1
      className={`flex flex-col items-center leading-[0.9] font-black tracking-tight perspective-[700px] ${className}`}
    >
      <span className="block logo-word">Pointscape</span>
      <span className="mt-1 block logo-3d text-[2.6em] leading-none tracking-wider">
        3D
      </span>
    </h1>
  );
}

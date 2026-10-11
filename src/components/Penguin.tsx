import { motion } from 'framer-motion';

/**
 * One of the Madagascar penguins, drawn in CSS: a black egg of a body with a white front, an
 * orange beak and feet, two flippers. `wave` swings the right flipper up and down, for the
 * "smile and wave" goodbye. `size` is his height in pixels.
 */
export function Penguin({ size, wave = false, mohawk = false }: { size: number; wave?: boolean; mohawk?: boolean }) {
  const w = size * 0.62;
  const h = size;
  return (
    <div className="relative" style={{ width: w + size * 0.3, height: h + size * 0.06 }}>
      {/* Left flipper, at his side. */}
      <div
        className="absolute rounded-full bg-[#1f2937]"
        style={{ width: size * 0.14, height: size * 0.42, left: size * 0.06, top: h * 0.4, rotate: '14deg' }}
      />
      {/* Right flipper: waving, or at his side. */}
      <motion.div
        className="absolute rounded-full bg-[#1f2937]"
        style={{ width: size * 0.14, height: size * 0.42, left: w + size * 0.1, top: h * 0.4, originY: 0.1 }}
        initial={{ rotate: -14 }}
        animate={wave ? { rotate: [-150, -110, -150] } : { rotate: -14 }}
        transition={wave ? { duration: 0.35, repeat: Infinity, ease: 'easeInOut' } : undefined}
      />
      {/* Body. */}
      <div
        className="absolute overflow-hidden"
        style={{
          width: w,
          height: h,
          left: size * 0.15,
          top: 0,
          borderRadius: '50% 50% 46% 46% / 58% 58% 42% 42%',
          background: 'linear-gradient(90deg, #111827, #374151 55%, #111827)',
        }}
      >
        {/* White front. */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{ width: w * 0.72, height: h * 0.72, bottom: h * 0.02, borderRadius: '50% 50% 45% 45% / 55% 55% 45% 45%', background: 'radial-gradient(circle at 50% 35%, #ffffff, #e5e7eb)' }}
        />
        {/* Eyes. */}
        {[0.3, 0.58].map((x) => (
          <div key={x} className="absolute rounded-full bg-white" style={{ width: w * 0.16, height: w * 0.18, left: w * x, top: h * 0.16 }}>
            <div className="absolute rounded-full bg-black" style={{ width: '50%', height: '50%', left: '30%', top: '30%' }} />
          </div>
        ))}
        {/* Brows: a squint, these are commandos. */}
        <div className="absolute bg-black" style={{ width: w * 0.5, height: size * 0.025, left: w * 0.25, top: h * 0.14 }} />
      </div>
      {/* Beak. */}
      <div
        className="absolute"
        style={{
          left: size * 0.15 + w * 0.36,
          top: h * 0.28,
          width: w * 0.28,
          height: h * 0.1,
          borderRadius: '40% 40% 50% 50%',
          background: 'linear-gradient(#fb923c, #ea580c)',
        }}
      />
      {/* Rico's mohawk. */}
      {mohawk && (
        <div
          className="absolute bg-[#111827]"
          style={{ left: size * 0.15 + w * 0.42, top: -size * 0.1, width: w * 0.16, height: size * 0.16, clipPath: 'polygon(0 100%, 20% 0, 45% 60%, 60% 0, 80% 55%, 100% 10%, 100% 100%)' }}
        />
      )}
      {/* Feet. */}
      {[0.12, 0.52].map((x) => (
        <div
          key={x}
          className="absolute rounded-full bg-[#f97316]"
          style={{ width: w * 0.36, height: size * 0.07, left: size * 0.15 + w * x, bottom: 0 }}
        />
      ))}
    </div>
  );
}

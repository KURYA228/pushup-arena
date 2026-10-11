import { motion } from 'framer-motion';

/**
 * A minion, drawn in CSS: a yellow capsule in blue dungarees, one goggle on a black strap (two
 * with `twoEyes`), little black boots. `run` bobs him and swings his feet, for the scenes where
 * he dashes across the screen. Sized by `size` — his height in pixels.
 */
export function Minion({ size, run = false, twoEyes = false }: { size: number; run?: boolean; twoEyes?: boolean }) {
  const w = size * 0.56;
  const h = size;
  const eye = w * (twoEyes ? 0.4 : 0.52);
  const goggle = (
    <span
      className="relative block rounded-full"
      style={{ width: eye, height: eye, background: 'radial-gradient(circle, #9ca3af 55%, #4b5563 58%, #6b7280)' }}
    >
      <span className="absolute inset-[18%] rounded-full bg-white">
        <span className="absolute left-[30%] top-[28%] h-[45%] w-[45%] rounded-full bg-[#5b3a1a]">
          <span className="absolute inset-[28%] rounded-full bg-black" />
        </span>
      </span>
    </span>
  );
  return (
    <motion.div
      className="relative"
      style={{ width: w, height: h + size * 0.08 }}
      animate={run ? { y: [0, -size * 0.06, 0] } : undefined}
      transition={run ? { duration: 0.22, repeat: Infinity, ease: 'easeInOut' } : undefined}
    >
      {/* Body. */}
      <div
        className="absolute left-0 top-0 overflow-hidden"
        style={{
          width: w,
          height: h,
          borderRadius: `${w / 2}px ${w / 2}px ${w * 0.35}px ${w * 0.35}px`,
          background: 'linear-gradient(90deg, #f5c518, #ffe14d 45%, #e0ad0b)',
          boxShadow: 'inset -3px 0 4px rgba(0,0,0,0.15)',
        }}
      >
        {/* Dungarees. */}
        <div className="absolute inset-x-0 bottom-0" style={{ height: h * 0.34, background: 'linear-gradient(#3b6fb6, #2a548f)' }} />
        <div className="absolute" style={{ left: w * 0.22, right: w * 0.22, bottom: h * 0.28, height: h * 0.12, background: '#3b6fb6', borderRadius: 3 }} />
        {/* Strap. */}
        <div className="absolute inset-x-0 bg-[#1f1f1f]" style={{ top: h * 0.26, height: size * 0.05 }} />
        {/* Smile. */}
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-b-full border-b-2 border-[#5b3a1a]"
          style={{ top: h * 0.46, width: w * 0.36, height: size * 0.06 }}
        />
      </div>
      {/* Goggles, on the strap. */}
      <div className="absolute left-1/2 flex -translate-x-1/2 gap-px" style={{ top: h * 0.26 - eye / 2 + size * 0.025 }}>
        {goggle}
        {twoEyes && goggle}
      </div>
      {/* Boots. */}
      {[0, 1].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-[#1f1f1f]"
          style={{ width: w * 0.32, height: size * 0.08, bottom: 0, left: i ? w * 0.56 : w * 0.12 }}
          animate={run ? { y: i ? [0, -size * 0.05, 0] : [-size * 0.05, 0, -size * 0.05] } : undefined}
          transition={run ? { duration: 0.22, repeat: Infinity } : undefined}
        />
      ))}
    </motion.div>
  );
}

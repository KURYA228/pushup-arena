import { motion } from 'framer-motion';

/**
 * Tsar Vladimir's people as little figures, in the same style as the minions and the Titans:
 * Antipka, the clerk who keeps the treasury, and the three bogatyrs. `size` is the height.
 */

/** Antipka: a red kaftan and a fur-trimmed cap, a brown beard, a fat ledger and a quill. */
export function Antipka({ size, writing = false, run = false }: { size: number; writing?: boolean; run?: boolean }) {
  const w = size * 0.7;
  return (
    <motion.div
      className="relative"
      style={{ width: w + size * 0.3, height: size }}
      animate={run ? { y: [0, -size * 0.05, 0] } : undefined}
      transition={run ? { duration: 0.22, repeat: Infinity } : undefined}
    >
      {/* Kaftan. */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{ top: size * 0.4, width: w * 0.78, height: size * 0.5, background: 'linear-gradient(180deg, #dc2626, #991b1b)', borderRadius: `${size * 0.08}px ${size * 0.08}px ${size * 0.04}px ${size * 0.04}px`, border: '2px solid #1f2937' }}
      >
        <div className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 bg-[#facc15]" />
        <div className="absolute inset-x-0 bottom-[22%] h-[4px] bg-[#facc15]" />
      </div>
      {/* Boots. */}
      {[0.3, 0.52].map((x) => (
        <div key={x} className="absolute rounded-b-md bg-[#78350f]" style={{ left: `${x * 100}%`, top: size * 0.88, width: size * 0.13, height: size * 0.12, border: '2px solid #1f2937' }} />
      ))}
      {/* Face and beard. */}
      <div className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ top: size * 0.12, width: w * 0.6, height: size * 0.32, background: '#fcd9b6', border: '2px solid #1f2937' }}>
        {[0.26, 0.6].map((x) => (
          <div key={x} className="absolute rounded-full bg-black" style={{ left: `${x * 100}%`, top: '35%', width: size * 0.045, height: size * 0.05 }} />
        ))}
        <div className="absolute left-1/2 -translate-x-1/2 rounded-b-[50%]" style={{ top: '58%', width: '86%', height: size * 0.2, background: '#8b5a2b', border: '2px solid #1f2937' }} />
      </div>
      {/* Cap with its fur band. */}
      <div className="absolute left-1/2 -translate-x-1/2 rounded-t-full bg-[#b91c1c]" style={{ top: -size * 0.02, width: w * 0.56, height: size * 0.18, border: '2px solid #1f2937' }} />
      <div className="absolute left-1/2 -translate-x-1/2 rounded-full bg-[#e7d3b0]" style={{ top: size * 0.12, width: w * 0.66, height: size * 0.07, border: '2px solid #1f2937' }} />
      {/* The ledger, and the quill going over it. */}
      <div className="absolute rounded-sm" style={{ left: w * 0.62, top: size * 0.5, width: size * 0.3, height: size * 0.22, background: 'linear-gradient(90deg, #f5f0e1 48%, #a16207 48% 52%, #f5f0e1 52%)', border: '2px solid #78350f' }} />
      <motion.div
        className="absolute"
        style={{ left: w * 0.78, top: size * 0.3, width: size * 0.05, height: size * 0.26, background: 'linear-gradient(180deg, #ffffff, #d1d5db)', borderRadius: '50% 50% 10% 10%', originY: 1 }}
        animate={writing ? { rotate: [10, -15, 10, -10, 12], x: [0, 3, -2, 4, 0] } : { rotate: 10 }}
        transition={writing ? { duration: 0.5, repeat: Infinity } : undefined}
      />
    </motion.div>
  );
}

/** A bogatyr: a pointed helmet, chainmail, a red cloak and a round shield; the beard tells which. */
export function Bogatyr({ size, beard, hair, shield = true }: { size: number; beard: string | null; hair: string; shield?: boolean }) {
  const w = size * 0.72;
  return (
    <div className="relative" style={{ width: w + size * 0.2, height: size }}>
      {/* Cloak behind. */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: size * 0.38, width: w * 0.95, height: size * 0.56, background: '#b91c1c', clipPath: 'polygon(20% 0, 80% 0, 100% 100%, 0 100%)' }} />
      {/* Chainmail. */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{ top: size * 0.4, width: w * 0.7, height: size * 0.46, borderRadius: `${size * 0.08}px`, border: '2px solid #1f2937', background: 'repeating-radial-gradient(circle at 50% 0, #9ca3af 0 2px, #6b7280 2px 4px)' }}
      >
        <div className="absolute inset-x-0 bottom-[20%] h-[4px] bg-[#78350f]" />
      </div>
      {[0.3, 0.52].map((x) => (
        <div key={x} className="absolute rounded-b-md bg-[#7f1d1d]" style={{ left: `${x * 100}%`, top: size * 0.86, width: size * 0.13, height: size * 0.14, border: '2px solid #1f2937' }} />
      ))}
      {/* Face, hair at the sides, beard. */}
      <div className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ top: size * 0.13, width: w * 0.56, height: size * 0.3, background: '#f5c9a0', border: '2px solid #1f2937' }}>
        <div className="absolute -left-[6%] top-[20%] h-[50%] w-[18%] rounded-full" style={{ background: hair }} />
        <div className="absolute -right-[6%] top-[20%] h-[50%] w-[18%] rounded-full" style={{ background: hair }} />
        {[0.26, 0.6].map((x) => (
          <div key={x} className="absolute rounded-full bg-black" style={{ left: `${x * 100}%`, top: '36%', width: size * 0.045, height: size * 0.05 }} />
        ))}
        {beard && (
          <div className="absolute left-1/2 -translate-x-1/2 rounded-b-[50%]" style={{ top: '58%', width: '88%', height: size * 0.2, background: beard, border: '2px solid #1f2937' }} />
        )}
      </div>
      {/* The helmet: a steel spike over a rim. */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: -size * 0.06, width: w * 0.58, height: size * 0.24, background: 'linear-gradient(90deg, #6b7280, #e5e7eb 45%, #6b7280)', clipPath: 'polygon(50% 0, 100% 75%, 100% 100%, 0 100%, 0 75%)' }} />
      {/* The shield, held in front. */}
      {shield && (
        <div
          className="absolute rounded-full"
          style={{
            left: w * 0.5,
            top: size * 0.44,
            width: size * 0.38,
            height: size * 0.38,
            background: 'radial-gradient(circle, #fde68a 0 12%, #b45309 13% 18%, #b91c1c 19% 80%, #facc15 81%)',
            border: '2px solid #1f2937',
          }}
        />
      )}
    </div>
  );
}

/** Alyosha, Dobrynya and Ilya — told apart by their beards. */
export const BOGATYRS = [
  { name: 'Алёша', beard: null, hair: '#d4a24c' },
  { name: 'Добрыня', beard: '#3f2a14', hair: '#3f2a14' },
  { name: 'Илья', beard: '#6b4423', hair: '#6b4423' },
] as const;

/**
 * The bogatyrs' guard while the treasury's paid for: their three shields stand in a row in
 * front of the tsar's picture. Each blow rings off them (a flash, keyed by `hitId`), and as the
 * paid blows run out they go, a shield at a time — cracked, and dropped. `left` blows remain of
 * `of`.
 */
export function BogatyrWall({ left, of, hitId }: { left: number; of: number; hitId: number | null }) {
  const standing = left > 0 ? Math.ceil((left / Math.max(1, of)) * 3) : 0;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-[2%] z-10 flex justify-center gap-1">
      {[0, 1, 2].map((i) => {
        const up = i < standing;
        return (
          <motion.div
            key={i}
            className="relative rounded-full"
            style={{
              width: 64,
              height: 64,
              background: 'radial-gradient(circle, #fde68a 0 12%, #b45309 13% 18%, #b91c1c 19% 80%, #facc15 81%)',
              border: '3px solid #1f2937',
              boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
            }}
            initial={{ y: 80, opacity: 0 }}
            animate={up ? { y: 0, opacity: 1, rotate: 0 } : { y: 90, opacity: 0, rotate: i === 1 ? 30 : -30 }}
            transition={up ? { type: 'spring', stiffness: 300, damping: 18, delay: 1.9 + i * 0.05 } : { duration: 0.5, ease: 'easeIn' }}
          >
            {/* The blow ringing off it. */}
            {up && hitId != null && (
              <motion.span
                key={hitId}
                className="absolute inset-0 rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.9), transparent 70%)' }}
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

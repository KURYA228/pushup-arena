import { motion } from 'framer-motion';

/**
 * The Teen Titans as little figures, drawn in CSS the way the minions and penguins are: a big
 * head on a small body, each in their own colours and with the one thing that makes them them.
 * `size` is the figure's height in pixels.
 */

function Head({ size, skin, children }: { size: number; skin: string; children?: React.ReactNode }) {
  return (
    <div className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ top: 0, width: size * 0.5, height: size * 0.46, background: skin, border: '2px solid #1f2937' }}>
      {children}
    </div>
  );
}

function Eyes({ size, color = '#ffffff', pupil = '#111827' }: { size: number; color?: string; pupil?: string }) {
  return (
    <>
      {[0.24, 0.56].map((x) => (
        <div key={x} className="absolute rounded-full" style={{ left: `${x * 100}%`, top: '42%', width: size * 0.1, height: size * 0.11, background: color, border: '1px solid #111827' }}>
          <div className="absolute rounded-full" style={{ inset: '28%', background: pupil }} />
        </div>
      ))}
    </>
  );
}

function Body({ size, color, belt }: { size: number; color: string; belt?: string }) {
  return (
    <div
      className="absolute left-1/2 -translate-x-1/2"
      style={{ top: size * 0.42, width: size * 0.4, height: size * 0.42, background: color, borderRadius: `${size * 0.1}px ${size * 0.1}px ${size * 0.06}px ${size * 0.06}px`, border: '2px solid #1f2937' }}
    >
      {belt && <div className="absolute inset-x-0" style={{ top: '60%', height: size * 0.05, background: belt }} />}
    </div>
  );
}

function Legs({ size, color }: { size: number; color: string }) {
  return (
    <>
      {[0.32, 0.54].map((x) => (
        <div key={x} className="absolute rounded-b-md" style={{ left: `${x * 100}%`, top: size * 0.8, width: size * 0.14, height: size * 0.2, background: color, border: '2px solid #1f2937' }} />
      ))}
    </>
  );
}

/** Cyborg: grey and blue armour, one human eye and one red electronic one, and the arm cannon. */
export function Cyborg({ size, aim = false }: { size: number; aim?: boolean }) {
  return (
    <div className="relative" style={{ width: size * 0.8, height: size }}>
      <Body size={size} color="linear-gradient(180deg, #cbd5e1, #64748b)" />
      <Legs size={size} color="#475569" />
      <Head size={size} skin="linear-gradient(90deg, #7c4a2d 50%, #cbd5e1 50%)">
        <div className="absolute rounded-full" style={{ left: '24%', top: '42%', width: size * 0.1, height: size * 0.11, background: '#fff', border: '1px solid #111' }}>
          <div className="absolute rounded-full bg-black" style={{ inset: '28%' }} />
        </div>
        <div className="absolute rounded-full" style={{ left: '58%', top: '42%', width: size * 0.1, height: size * 0.1, background: '#ef4444', boxShadow: '0 0 6px #ef4444' }} />
      </Head>
      {/* The cannon arm, raised to fire. */}
      <motion.div
        className="absolute rounded-md"
        style={{ left: size * 0.58, top: size * 0.46, width: size * 0.34, height: size * 0.14, background: 'linear-gradient(180deg, #94a3b8, #475569)', border: '2px solid #1f2937', originX: 0 }}
        animate={{ rotate: aim ? -8 : 50 }}
      >
        <div className="absolute rounded-full" style={{ right: -4, top: '15%', width: size * 0.1, height: size * 0.1, background: 'radial-gradient(circle, #e0f2fe, #38bdf8)', boxShadow: '0 0 8px #38bdf8' }} />
      </motion.div>
    </div>
  );
}

/** Starfire: orange skin, a mane of red hair, purple top, glowing green eyes and hands. */
export function Starfire({ size }: { size: number }) {
  return (
    <div className="relative" style={{ width: size * 0.8, height: size }}>
      {/* The hair, behind her. */}
      <div className="absolute left-1/2 -translate-x-1/2 rounded-[45%]" style={{ top: -size * 0.04, width: size * 0.66, height: size * 0.78, background: 'linear-gradient(180deg, #ef4444, #b91c1c)', border: '2px solid #1f2937' }} />
      <Body size={size} color="linear-gradient(180deg, #a855f7, #7e22ce)" />
      <Legs size={size} color="#7e22ce" />
      <Head size={size} skin="#fb923c">
        <Eyes size={size} color="#4ade80" pupil="#14532d" />
      </Head>
      {[0.02, 0.76].map((x) => (
        <motion.div
          key={x}
          className="absolute rounded-full"
          style={{ left: `${x * 100}%`, top: size * 0.5, width: size * 0.16, height: size * 0.16, background: 'radial-gradient(circle, #f0fdf4, #4ade80 60%)', boxShadow: '0 0 10px #4ade80' }}
          animate={{ scale: [1, 1.25, 1] }}
          transition={{ duration: 0.4, repeat: Infinity }}
        />
      ))}
    </div>
  );
}

/** Raven: a dark blue hooded cloak, grey face, the red gem on her brow. */
export function Raven({ size }: { size: number }) {
  return (
    <div className="relative" style={{ width: size * 0.8, height: size }}>
      {/* The cloak. */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{ top: size * 0.1, width: size * 0.74, height: size * 0.9, background: 'linear-gradient(180deg, #312e81, #1e1b4b)', clipPath: 'polygon(30% 0, 70% 0, 100% 100%, 0 100%)', border: '2px solid #1f2937' }}
      />
      {/* The hood. */}
      <div className="absolute left-1/2 -translate-x-1/2 rounded-t-full" style={{ top: -size * 0.04, width: size * 0.6, height: size * 0.52, background: '#312e81', border: '2px solid #1f2937' }} />
      <Head size={size} skin="#d1d5db">
        <Eyes size={size} color="#e5e7eb" pupil="#4c1d95" />
        <div className="absolute left-1/2 -translate-x-1/2 rounded-full" style={{ top: '18%', width: size * 0.06, height: size * 0.06, background: '#ef4444', boxShadow: '0 0 6px #ef4444' }} />
      </Head>
      {/* Her hands up, dark energy round them. */}
      {[0.02, 0.8].map((x) => (
        <motion.div
          key={x}
          className="absolute rounded-full"
          style={{ left: `${x * 100}%`, top: size * 0.36, width: size * 0.16, height: size * 0.16, background: 'radial-gradient(circle, #ddd6fe, #7c3aed 50%, #1e1b4b)', boxShadow: '0 0 12px #7c3aed' }}
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
      ))}
    </div>
  );
}

/** Beast Boy: green skin, pointed ears, the purple-and-black suit, a fang in his grin. */
export function BeastBoy({ size }: { size: number }) {
  return (
    <div className="relative" style={{ width: size * 0.8, height: size }}>
      <Body size={size} color="linear-gradient(90deg, #111827 50%, #7e22ce 50%)" />
      <Legs size={size} color="#111827" />
      {[-1, 1].map((d) => (
        <div
          key={d}
          className="absolute"
          style={{ left: d < 0 ? size * 0.08 : size * 0.58, top: size * 0.12, width: size * 0.14, height: size * 0.16, background: '#4ade80', clipPath: d < 0 ? 'polygon(100% 0, 100% 100%, 0 30%)' : 'polygon(0 0, 0 100%, 100% 30%)' }}
        />
      ))}
      <Head size={size} skin="#4ade80">
        <Eyes size={size} />
        <div className="absolute left-1/2 -translate-x-1/2 rounded-b-full border-b-2 border-[#14532d]" style={{ top: '70%', width: size * 0.18, height: size * 0.05 }} />
      </Head>
    </div>
  );
}

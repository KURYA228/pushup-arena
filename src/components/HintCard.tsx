import { motion } from 'framer-motion';
import { X } from 'lucide-react';

/** A dismissible tip card — the shared frame for every hint aimed at newcomers. */
export function HintCard({
  icon,
  title,
  children,
  onClose,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      className="relative mb-4 overflow-hidden rounded-2xl border border-arena-amber/40 bg-arena-surface p-4 pr-10"
    >
      <button
        onClick={onClose}
        aria-label="Скрыть подсказку"
        className="absolute right-2 top-2 rounded-full p-1.5 text-arena-text-dim active:scale-95"
      >
        <X size={14} />
      </button>
      <div className="flex items-center gap-2 text-sm font-semibold text-arena-text">
        <span className="text-arena-amber">{icon}</span>
        {title}
      </div>
      <div className="mt-1.5 text-xs leading-relaxed text-arena-text-dim">{children}</div>
    </motion.section>
  );
}

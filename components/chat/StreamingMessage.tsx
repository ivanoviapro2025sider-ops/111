import { motion } from 'framer-motion';

export function StreamingMessage({ content }: { content: string }) {
  return (
    <motion.div initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} className="whitespace-pre-wrap text-sm text-white/85">
      {content}
      <span className="ml-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-indigo-400/80 align-middle" />
    </motion.div>
  );
}

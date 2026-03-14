import { motion } from "framer-motion";

interface StreamingMessageProps {
  content: string;
}

export function StreamingMessage({ content }: StreamingMessageProps) {
  return (
    <motion.div
      initial={{ opacity: 0.5 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, repeat: Infinity, repeatType: "reverse" }}
      className="whitespace-pre-wrap text-sm text-zinc-100"
    >
      {content}
      <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-indigo-400 align-middle" />
    </motion.div>
  );
}

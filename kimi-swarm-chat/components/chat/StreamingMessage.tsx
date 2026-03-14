export function StreamingMessage({ content }: { content: string }) {
  return (
    <span>
      {content}
      <span className="ml-0.5 inline-block h-4 w-1 animate-pulse bg-indigo-400 align-middle" />
    </span>
  );
}

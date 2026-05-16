export function EmptyState({ message }: { message: string }) {
  return (
    <div className="mt-16 flex justify-center">
      <p
        className="text-text-secondary"
        style={{ fontSize: 14, fontWeight: 400, lineHeight: 1.3 }}
      >
        {message}
      </p>
    </div>
  );
}

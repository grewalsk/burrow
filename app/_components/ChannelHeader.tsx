export function ChannelHeader({
  name,
  description,
}: {
  name: string;
  description: string;
}) {
  return (
    <header className="flex flex-col gap-1">
      <h1
        className="text-text-primary"
        style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.3 }}
      >
        {name}
      </h1>
      <p
        className="text-text-secondary"
        style={{ fontSize: 12, fontWeight: 400, lineHeight: 1.3 }}
      >
        {description}
      </p>
    </header>
  );
}

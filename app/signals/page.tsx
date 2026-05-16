import { ChannelHeader } from "../_components/ChannelHeader";
import { SignalCard } from "../_components/SignalCard";
import { SEED_SIGNALS } from "../_data/signals";

export default function SignalsPage() {
  return (
    <div className="px-8 py-8">
      <ChannelHeader
        name="#signals"
        description="Reverse-chronological feed of what Scout pulled. Click any card to open its lead card."
      />
      {SEED_SIGNALS.length === 0 ? (
        <div className="mt-16 flex justify-center">
          <p
            className="text-text-secondary"
            style={{ fontSize: 14, fontWeight: 400, lineHeight: 1.3 }}
          >
            No signals yet. Scout runs every 30s.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {SEED_SIGNALS.map((s) => (
            <SignalCard key={s.id} signal={s} />
          ))}
        </div>
      )}
    </div>
  );
}

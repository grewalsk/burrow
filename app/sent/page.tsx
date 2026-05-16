import { ChannelHeader } from "../_components/ChannelHeader";
import { EmptyState } from "../_components/EmptyState";

export default function SentPage() {
  return (
    <div className="px-8 py-8">
      <ChannelHeader name="#sent" description="Replies you've approved." />
      <EmptyState message="Nothing sent yet." />
    </div>
  );
}

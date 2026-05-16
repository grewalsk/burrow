import { ChannelHeader } from "../_components/ChannelHeader";
import { EmptyState } from "../_components/EmptyState";

export default function AskPage() {
  return (
    <div className="px-8 py-8">
      <ChannelHeader name="#ask" description="A chat with Chief of Staff. Inline citations open the lead card." />
      <EmptyState message="Ask Chief of Staff anything about your pipeline." />
    </div>
  );
}

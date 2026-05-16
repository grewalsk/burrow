import { ChannelHeader } from "../_components/ChannelHeader";
import { EmptyState } from "../_components/EmptyState";

export default function BriefingPage() {
  return (
    <div className="px-8 py-8">
      <ChannelHeader name="#briefing" description="Chief of Staff's morning summary and competitor moves." />
      <EmptyState message="Your first briefing posts tomorrow morning." />
    </div>
  );
}

import { ChannelHeader } from "../_components/ChannelHeader";
import { EmptyState } from "../_components/EmptyState";

export default function DraftsPage() {
  return (
    <div className="px-8 py-8">
      <ChannelHeader name="#drafts" description="Replies waiting on your approval." />
      <EmptyState message="Nothing pending." />
    </div>
  );
}

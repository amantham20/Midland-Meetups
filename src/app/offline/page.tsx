import { PageHeader } from "@/components/PageHeader";

export default function OfflinePage() {
  return (
    <PageHeader
      kicker="PWA"
      title="You're offline"
      lede="Midland Meetups needs a connection to load live events and RSVPs. Reconnect and try again — once the app is installed, shells and assets stay cached for faster reopen."
    />
  );
}

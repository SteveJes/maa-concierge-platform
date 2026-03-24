import { ChatShell } from "@platform/ui-chat";

export default function HomePage() {
  return (
    <main style={{ maxWidth: 920, margin: "0 auto", padding: "2rem" }}>
      <h1>AI Concierge Web (Scaffold)</h1>
      <p>Next.js app shell ready for tenant-aware chat wiring.</p>
      <ChatShell />
    </main>
  );
}

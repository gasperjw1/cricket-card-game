import { lazy, Suspense } from "react";
import { CoinTossScreen } from "./screens/CoinTossScreen.tsx";
import { HomeScreen } from "./screens/HomeScreen.tsx";
import { InningsScreen } from "./screens/InningsScreen.tsx";
import { LobbyScreen } from "./screens/LobbyScreen.tsx";
import { useMatchClient } from "./state.ts";

// Lazy-loaded — only fetched when ?preview=story is in the URL. Keeps
// the main bundle clean of preview-only code.
const StoryPreviewScreen = lazy(() =>
  import("./screens/StoryPreviewScreen.tsx").then((m) => ({
    default: m.StoryPreviewScreen,
  })),
);

export function App() {
  const client = useMatchClient();
  return (
    <>
      <PortraitLock />
      <AppRouter client={client} />
    </>
  );
}

function AppRouter({ client }: { client: ReturnType<typeof useMatchClient> }) {
  // QA preview route — hits any time, doesn't require a match.
  if (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("preview") === "story"
  ) {
    return (
      <Suspense fallback={<main><h1>Loading preview…</h1></main>}>
        <StoryPreviewScreen />
      </Suspense>
    );
  }

  const inMatch = client.matchState !== null && client.mySlot !== null;
  if (!inMatch) return <HomeScreen client={client} />;
  const phase = client.matchState!.phase;
  if (phase === "coin-toss") return <CoinTossScreen client={client} />;
  if (phase === "innings" || phase === "innings-break" || phase === "match-over") {
    return <InningsScreen client={client} />;
  }
  return <LobbyScreen client={client} />;
}

// Hidden by default; CSS only reveals it on phone-sized landscape viewports.
// See `.portrait-lock` in index.css.
function PortraitLock() {
  return (
    <div className="portrait-lock" aria-hidden="true">
      <div className="portrait-lock-inner">
        <div className="portrait-lock-icon">📱</div>
        <h2>Please rotate your device</h2>
        <p>Swipe Sixer is designed for portrait mode on phones.</p>
      </div>
    </div>
  );
}

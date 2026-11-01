import { createFileRoute } from "@tanstack/react-router";
import { GameProvider } from "@/game/store";
import { Phone } from "@/components/game/Phone";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "wertперекуп — игра про перекупа" },
      { name: "description", content: "Покупай и перепродавай машины, открывай бизнесы, играй онлайн с другими перекупами." },
      { property: "og:title", content: "wertперекуп — игра про перекупа" },
      { property: "og:description", content: "Перекуп машин, бизнесы, биржа, казино и онлайн-рейтинг в одном телефоне." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <GameProvider>
      <Phone />
    </GameProvider>
  );
}

<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Game rules live as pure functions in `src/game/engine.ts` (tested in `engine.test.ts`); UI only calls them via `useGame().act` — keeps logic testable and UI thin.
- Game state is a single JSON blob saved to localStorage and, when signed in, to `game_saves` — simplest sync for a client-side game.
- Paid shop items are delivered only via rows in `item_grants` (server-written), applied once by grant id — payment webhooks just insert rows.
- Phone apps are in-page screens registered in `src/components/game/Phone.tsx`, not routes — the game is one phone UI.

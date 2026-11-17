<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Game architecture
- Rules (track, vehicle, AI, race, progression) live in `src/game/sim/` as plain TS with no React/three imports, so they stay unit-testable.
- Per-frame state lives in `src/game/runtime.ts`; zustand (`src/game/store.ts`) holds only UI state and the saved profile, because per-frame React updates would re-render 60x/s.
- One `useFrame` in `src/game/scene/Stepper.tsx` advances input, sim, poses, dust and camera in that order.
- Dev hooks: `window.__game` (`race`, `sim(seconds, autopilot)`, `standings()`) and `window.__three` (`scene`, `camera`, `gl`) exist only in dev for browser checks.
- Post-processing and shadows run only on the "high" quality setting, to keep low-end phones playable.
- tsconfig has `noUncheckedIndexedAccess`, `noPropertyAccessFromIndexSignature` and `exactOptionalPropertyTypes` off: game math indexes typed arrays everywhere and the checks added noise, not safety.
- The save key stays `dust-rally-save-v1` after the rename so existing progress survives.

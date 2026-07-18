# 🎬 The Cinematic Scrollytelling squad (NabuGate sub-agents)

Building an Apple-style, scroll-driven product page is not one designer's job —
it's a small crew of specialists. This project pairs with
[**NabuGate**](https://github.com/NabuxAi/NabuGate), the org's OpenAI-compatible
AI gateway, which lets us define each specialist as a **sub-agent** *from
outside* — one YAML file each, no code — and run it in a single API call.

## The seven roles

| Sub-agent (`model`)          | Role | Owns |
|------------------------------|------|------|
| `cine-creative-director`     | Creative / Art Director | The scroll storyboard, visual rhythm, one-message-per-scene sales arc |
| `cine-interactive-designer`  | Interactive Designer | Scroll/pointer → scene timeline: pins, scrubbing, reveal thresholds |
| `cine-motion-designer`       | Motion Designer | Transitions, easing, timing, camera moves — motion as meaning |
| `cine-3d-artist`             | 3D / CGI Artist | Product model, lighting, materials, the rendered frame sequence |
| `cine-frontend-developer`    | Creative Front-end Dev | The fast build: GSAP/ScrollTrigger, Canvas, WebGL, image/video scrubbing |
| `cine-content-strategist`    | UX Writer / Content Strategist | Per-scene copy, feature order, the sales narrative |
| `cine-performance-a11y`      | Performance & Accessibility Engineer | Smooth on weak phones + accessible, real reduced-motion path |

The canonical definitions live in NabuGate under
[`agents/`](https://github.com/NabuxAi/NabuGate/tree/main/agents) and load via
`agents_dir: "./agents"`.

## Run one

Point NabuGate at the agents, then call any of them like a model:

```bash
curl -X POST "$NABU_BASE_URL/v1/chat/completions" \
  -H "Authorization: Bearer $NABU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "cine-creative-director",
    "messages": [{ "role": "user",
      "content": "Storyboard a scroll-driven page for a premium tea brand called خشخاش." }]
  }'
```

NabuGate injects the agent's system prompt, routes to its underlying model with
the usual fallback chain, and streams the answer back — the whole squad behind
one endpoint and one key.

## How this app uses the gateway

`POST /api/generate-from-prompt` prefers NabuGate when `NABU_BASE_URL` is set
(see [`.env.example`](.env.example)), so the generator never calls a model
provider directly. Set `NABU_MODEL` to a normal alias (e.g. `nabu-smart`) for
the strict-JSON config step, or to a `cine-*` agent to bring a specialist's
voice into the creative pipeline. Grant a project key the whole squad with
`allow: ["cine-*"]`.

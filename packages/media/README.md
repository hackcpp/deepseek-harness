---
description: "The media group: Agent tools that generate images and speech or inspect and render Hyperframes video projects."
kind: "package-group"
---

# packages/media

English | [中文](README.zh.md)

## Summary

The media group lets an Agent generate or render media for a user. Its plugins create speech with Qwen3-TTS, create images with Evolink Z-Image-Turbo, or inspect and render local Hyperframes video projects. Remote providers own generated media availability and expiry; the harness does not store those returned bytes.

## Table of Contents

- [Packages](#packages)
- [Related documentation](#related-documentation)
- [Dev Note](#dev-note)

-----

<a id="packages"></a>
## Packages

| Package | Role | ctx key |
|---|---|---|
| [`speech-generation-qwen/`](speech-generation-qwen/README.md) | Generates speech with Qwen3-TTS through `generate_speech` | registers on `ctx.tools` |
| [`image-generation-evolink/`](image-generation-evolink/README.md) | Generates images with Evolink Z-Image-Turbo through `generate_image` | registers on `ctx.tools` |
| [`hyperframes-tools/`](hyperframes-tools/README.md) | Lints, snapshots, and renders Hyperframes projects through three video tools | registers on `ctx.tools` |

-----

<a id="related-documentation"></a>
## Related documentation

- [Tools subsystem](../../docs/subsystems/tools.md) — tool registration, execution, and presentation.
- [Tool catalog](../../docs/tool-catalog.md#deepseek-aidsh-speech-generation-qwen) — generated speech tool schema.
- [Speech generation decision](../../.agents/notes/implemented/feature/2026-09-29-qwen-speech-generation-tool.md) — enablement and result lifetime.
- [Image generation decision](../../.agents/notes/implemented/feature/2026-09-29-evolink-image-generation-tool.md) — asynchronous polling and enablement.
- [Hyperframes tools decision](../../.agents/notes/implemented/feature/2026-09-29-hyperframes-agent-tools.md) — CLI delegation, settings, and output paths.

-----

<a id="dev-note"></a>
## Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

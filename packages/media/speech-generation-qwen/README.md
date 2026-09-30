---
description: "Configure the Qwen3-TTS generate_speech Agent tool, its voice input, credential reference, and expiring audio URL result."
kind: "package-reference"
---

# @deepseek-ai/dsh-speech-generation-qwen

English | [中文](README.zh.md)

## Summary

`generate_speech` turns text into spoken audio with a selected Qwen3-TTS voice. The tool appears after a user enables Qwen text to speech in Settings > Plugins > Plugin configuration and saves the card. The provider returns a temporary audio URL; users must download audio before it expires. An API key is required for each call.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The base profile mounts this plugin with `enabled: true`; the Settings card controls live tool registration and can turn it off.

### When to choose it

Use this package when an Agent must create spoken audio from text and can use Alibaba Cloud's DashScope service. It sends text to the configured HTTPS endpoint and returns the provider's audio URL; the harness does not store audio bytes.

### Minimal configuration

Set `DASHSCOPE_API_KEY` in the launching environment or project `.env`, then enable the Qwen text to speech card and save. A composition may also enable it directly:

```yaml
- name: '@deepseek-ai/dsh-speech-generation-qwen'
  config:
    enabled: true
```

| Field | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Register `generate_speech` while enabled |
| `apiKeyEnv` | `DASHSCOPE_API_KEY` | Credential reference resolved for each call |
| `model` | `qwen3-tts-flash` | DashScope speech model |
| `endpoint` | Beijing DashScope multimodal generation endpoint | HTTPS API endpoint |
| `maxTextLength` | `500` | Maximum Unicode code points in the input text |
| `timeoutMs` | `60000` | Request timeout in milliseconds |

The generated [configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-speech-generation-qwen) lists the accepted fields. The call takes required `text` and `voice` strings, for example `generate_speech({ text: 'Hello', voice: 'Cherry' })`. The selected voice must be supported by the chosen model. A missing key, non-success HTTP status, invalid audio response, empty voice, or out-of-range text produces an error tool result.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The Settings section selects whether the tool is registered. Execution resolves the credential, sends one non-streaming DashScope request, validates the returned audio URL and expiry, and renders those values in the tool result. [`src/index.ts`](src/index.ts) owns registration and provider dispatch; [`src/invariant.ts`](src/invariant.ts) owns the package invariant companion.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Media package map](../README.md) — media generation packages.
- [Tool catalog](../../../docs/tool-catalog.md#deepseek-aidsh-speech-generation-qwen) — generated Agent tool schema.
- [Settings package](../../settings/settings/README.md) — durable section semantics.

-----

<a id="model-experience"></a>
## Model Experience

### Tool schemas

#### What the model sees

When enabled, the model sees the generated [`generate_speech` schema](../../../docs/tool-catalog.md#deepseek-aidsh-speech-generation-qwen) with required `text` and `voice`. Disabling the card removes the schema for subsequent requests.

#### Token effect

The schema adds a fixed input cost while enabled and visible. This package adds no system prompt.

#### KV Cache effect

The schema remains prefix-stable while its registration and fields are unchanged. Enabling or disabling it can invalidate reuse from the tool definition.

### Tool result and errors

#### What the model sees

Successful calls return `Audio: <url>`, `Voice: <voice>`, and `URL expires at: <ISO time>`. Failed calls return `Error: <message>`; the API key is never included in the result.

#### Token effect

Only a call adds its result or error text to retained history; URL length determines the result size.

#### KV Cache effect

The result follows the existing request prefix. New result text is append-only.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

The provider controls the returned audio's lifetime and supported voices.

- **Temporary URL** — the tool returns the provider URL without persisting audio bytes. The URL stops working after `expiresAt` (commonly about 24 hours).
- **Provider validation** — the tool checks that a voice is non-empty, but DashScope decides whether it supports that voice for the selected model.
- **No live provider check** — tests use simulated responses; a real API key is required to verify account permissions and audio playback.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

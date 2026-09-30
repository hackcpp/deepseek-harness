---
description: "Configure the Evolink Z-Image-Turbo generate_image Agent tool, polling interval, credential reference, and temporary image URL result."
kind: "package-reference"
---

# @deepseek-ai/dsh-image-generation-evolink

English | [中文](README.zh.md)

## Summary

`generate_image` creates an Evolink Z-Image-Turbo task from a text prompt and polls it until completion. The tool is enabled by default and can be disabled in Settings > Plugins > Plugin configuration. The provider returns temporary image URLs; users must download images within 24 hours. An API key is required for each call.

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

The base profile mounts this plugin with `enabled: true`; the Settings card controls live tool registration and can disable it.

### When to choose it

Use this package when an Agent must generate an image from a text prompt and the deployment can use Evolink. It creates an asynchronous Z-Image-Turbo task and returns the provider's completed image URLs; the harness does not store image bytes.

### Minimal configuration

Set `EVOLINK_API_KEY` in the launching environment or project `.env`; the default composition registers the tool automatically. A composition can disable it explicitly:

```yaml
- name: '@deepseek-ai/dsh-image-generation-evolink'
  config:
    enabled: false
```

| Field | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Register `generate_image` while enabled |
| `apiKeyEnv` | `EVOLINK_API_KEY` | Credential reference resolved for each call |
| `apiBaseUrl` | `https://api.evolink.ai/v1/` | HTTPS Evolink API directory URL |
| `pollIntervalMs` | `5000` | Delay between task-status requests in milliseconds |
| `timeoutMs` | `180000` | Total creation and polling timeout in milliseconds |

The generated [configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-image-generation-evolink) lists the accepted fields. The call requires `prompt` and accepts `size`, `seed`, and `nsfw_check`, for example `generate_image({ prompt: 'A moonlit lake', size: '16:9', seed: 42 })`. A missing key, non-success HTTP status, invalid provider response, failed or cancelled task, invalid prompt, or out-of-range seed produces an error tool result.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The Settings section selects whether the tool is registered. Execution resolves the credential, submits `POST /v1/images/generations`, waits five seconds between `GET /v1/tasks/{task_id}` requests, and returns the completed `results` URLs. [`src/index.ts`](src/index.ts) owns registration and provider dispatch; [`src/invariant.ts`](src/invariant.ts) owns the package invariant companion.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Evolink Z-Image-Turbo API](https://evolink.ai/z-image-turbo) — provider request fields and task workflow.
- [Media package map](../README.md) — media generation packages.
- [Tool catalog](../../../docs/tool-catalog.md#deepseek-aidsh-image-generation-evolink) — generated Agent tool schema.
- [Settings package](../../settings/settings/README.md) — durable section semantics.

-----

<a id="model-experience"></a>
## Model Experience

### Tool schemas

#### What the model sees

When enabled, the model sees the generated [`generate_image` schema](../../../docs/tool-catalog.md#deepseek-aidsh-image-generation-evolink) with required `prompt` and optional size, seed, and stricter content filtering. Disabling the card removes the schema for subsequent requests.

#### Token effect

The schema adds a fixed input cost while enabled and visible. This package adds no system prompt.

#### KV Cache effect

The schema remains prefix-stable while its registration and fields are unchanged. Enabling or disabling it can invalidate reuse from the tool definition.

### Tool result and errors

#### What the model sees

Successful calls return `Images (URLs expire after 24 hours):` followed by one or more URLs. Failed calls return `Error: <message>`; the API key is never included in the result.

#### Token effect

Only a call adds its result or error text to retained history; URL count and length determine the result size.

#### KV Cache effect

The result follows the existing request prefix. New result text is append-only.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

The provider controls task execution and returned image availability.

- **Temporary URLs** — the tool returns provider URLs without persisting image bytes. Download completed images within 24 hours.
- **Foreground polling** — the tool call remains active while polling. `timeoutMs` bounds the complete create-and-poll operation, and cancellation aborts the active request or delay.
- **No live provider check** — tests use simulated responses; a real API key is required to verify account permissions, billing, moderation, and generated image content.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

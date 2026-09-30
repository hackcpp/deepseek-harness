---
description: "Configure Agent tools that lint Hyperframes projects, render timestamp contact sheets, and produce MP4 video files through the bundled Hyperframes CLI."
kind: "package-reference"
---

# @deepseek-ai/dsh-hyperframes-tools

English | [中文](README.zh.md)

## Summary

This package lets an Agent validate a Hyperframes project, review selected timeline frames in one contact sheet, and render the project to MP4. It delegates each operation to Hyperframes instead of duplicating its project parser or renderer. The tools stay hidden until the user enables Hyperframes video tools in Settings > Plugins > Plugin configuration.

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

The base profile mounts the plugin with all three tools enabled; the Settings card can disable or re-enable them without restarting the Host.

### When to choose it

Choose this package when the project directory follows Hyperframes conventions and an Agent needs the same lint, snapshot, or render behavior as the Hyperframes CLI. Use ordinary filesystem and shell tools for projects that are not Hyperframes compositions.

### Minimal configuration

The Settings card is enabled initially. To mount the plugin directly with the same default:

```yaml
- name: '@deepseek-ai/dsh-hyperframes-tools'
  config:
    enabled: true
```

| Field | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Register `video_lint`, `video_snapshot`, and `video_render` |
| `executable` | bundled Hyperframes CLI | Override the executable in the subprocess execution world |
| `timeoutMs` | `600000` | Maximum duration of one foreground CLI invocation |
| `maxOutputBytes` | `262144` | Maximum retained bytes for each CLI output stream |

The generated [configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-hyperframes-tools) lists the accepted fields. Every tool requires `projectPath`. `video_snapshot` also requires one to nine non-negative timestamps in seconds.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The settings section registers or removes the three tool definitions as one unit. Each call resolves the configured executable through the subprocess service, starts the bundled Hyperframes CLI with bounded output and cooperative cancellation, and converts the CLI result into a typed tool value. `video_lint` preserves lint failures as a successful inspection result, while process, snapshot, and render failures become error tool results.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Media package map](../README.md) — related media tools.
- [Tool catalog](../../../docs/tool-catalog.md#deepseek-aidsh-hyperframes-tools) — generated Agent tool schemas.
- [Tools subsystem](../../../docs/subsystems/tools.md) — registration and execution behavior.
- [Subprocess package](../../subprocess/subprocess/README.md) — executable resolution, cancellation, and output collection.

-----

<a id="model-experience"></a>
## Model Experience

### Tool schemas

#### What the model sees

While enabled, the model sees the generated [`video_lint`, `video_snapshot`, and `video_render` schemas](../../../docs/tool-catalog.md#deepseek-aidsh-hyperframes-tools). Their required project path points to one Hyperframes project. The snapshot schema adds an ordered `times` array containing one to nine timestamps.

#### Token effect

The three schemas add a fixed input cost while enabled and visible. This package adds no system prompt.

#### KV Cache effect

The schemas remain prefix-stable while registration and configuration stay unchanged. Enabling or disabling the card changes the tool list and can invalidate reuse from the tool-definition prefix.

### Tool result and errors

#### What the model sees

`video_lint` returns a pass flag, error and warning counts, and Hyperframes findings. `video_snapshot` returns the contact-sheet path, snapshot directory, and captured timestamps. `video_render` returns the MP4 path. Invalid arguments, CLI launch failures, timeouts, missing contact sheets, and non-lint command failures produce error tool results.

#### Token effect

Only a call adds result or error text to retained history. Lint finding count controls the largest result.

#### KV Cache effect

Tool results append after the existing request prefix and do not change earlier cached content.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

Hyperframes owns browser, codec, and project compatibility, so the wrapper retains these operational constraints.

- **Foreground execution** — snapshots and MP4 renders occupy the tool call until Hyperframes exits or the configured timeout aborts it.
- **Snapshot directory replacement** — Hyperframes clears image files from `<project>/snapshots` before writing the selected frames and `contact-sheet.jpg`.
- **Fixed MP4 path** — `video_render` writes `<project>/renders/render.mp4`; a later call can replace that file.
- **Runtime dependencies** — Hyperframes may require Chrome, FFmpeg, fonts, codecs, or GPU support for a particular project. Tests simulate the subprocess results and do not prove every host can render every composition.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

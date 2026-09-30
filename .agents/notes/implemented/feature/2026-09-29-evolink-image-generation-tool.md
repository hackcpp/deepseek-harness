# Agent Note: Evolink image generation tool

Status: implemented

English | [中文](2026-09-29-evolink-image-generation-tool.zh.md)

## Problem

An Agent that needs visual output has no image-generation tool. Evolink exposes Z-Image-Turbo through an asynchronous create-and-query API, while the Web settings page cannot control the capability without a mounted Host settings section.

## Decision

`@deepseek-ai/dsh-image-generation-evolink` mounts only in the `video-app` bundle with registration enabled. Its `image-generation-evolink` settings section controls whether `generate_image` is visible to an Agent, and the browser's Plugin configuration tab stages and saves the same setting. A tool call resolves `EVOLINK_API_KEY` at execution time, creates a `z-image-turbo` task, and queries its status every five seconds until completion or a terminal error. The result carries the task ID and provider image URLs; the harness does not retain image bytes.

`pollIntervalMs` defaults to `5000` so deployment configuration records the requested polling cadence. `timeoutMs` bounds creation, waiting, and status requests together. The caller's cancellation signal aborts the same operation.

## Alternatives considered

**Always register the tool.** A visible tool that always fails without an API key would ask the model to use a capability the user has not enabled. Settings-driven registration keeps the model's available tools aligned with the saved switch.

**Return immediately with the task ID.** This would require another model-visible query tool or background-job integration before an Agent could obtain the generated image. Foreground polling provides one complete tool result for the expected short-running task.

**Store generated images locally.** Persistent media would require storage ownership, access control, and retention policy. Returning provider URLs preserves the direct API result and makes the temporary lifetime explicit.

## Consequences

The Agent can create images after the user enables the tool, and disabling it removes the schema from later requests without restarting the Host. Each call occupies one foreground tool execution while polling and fails when the configured timeout expires. Provider URLs expire after 24 hours, so downstream consumers must download them promptly. Provider credentials, billing, moderation, and image quality require a live account; local tests substitute task responses.

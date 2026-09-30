# Agent Note: Qwen speech generation tool

Status: implemented

English | [中文](2026-09-29-qwen-speech-generation-tool.zh.md)

## Problem

An Agent that needs spoken output has no tool for generating audio from text. The Web settings page cannot control such a capability without a mounted Host settings section.

## Decision

`@deepseek-ai/dsh-speech-generation-qwen` mounts only in the `video-app` bundle with registration enabled. Its `speech-generation-qwen` settings section controls whether `generate_speech` is visible to an Agent. The browser's Plugin configuration tab stages and saves the same setting. Tool calls take text and a Qwen3-TTS voice ID, resolve `DASHSCOPE_API_KEY` at execution time, and send one non-streaming DashScope request. The result carries the provider's audio URL and expiry; the harness does not retain audio bytes.

## Alternatives considered

**Require explicit opt-in.** That avoids exposing a tool before credentials are configured, but makes the shipped capability undiscoverable until the user finds its setting. Default-on registration keeps it immediately available while the saved switch still provides an explicit opt-out.

**Store the audio locally.** Persistent media would require an ownership and retention policy. Returning the provider URL preserves the direct API result and exposes its expiry to the model.

## Consequences

The Agent can request a specific supported voice by default, and the user can disable the tool in Settings. Calls still fail clearly until a provider credential is configured. The returned URL expires, so downstream consumers must download it before the reported time. Provider credentials and supported voices require a live account; local tests substitute provider responses.

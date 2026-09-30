# Agent Note: Video production preset

Status: implemented

English | [中文](2026-09-30-video-production-preset.zh.md)

## Problem

The general coding presets can edit a Hyperframes project and can inherit media tools from the Host, but they do not give a session a video-production identity, a review-gated workflow, or a stable script document for a future storyboard UI. Tool availability alone also does not prevent an Agent from generating visuals before narration timing is known or exporting an MP4 before the user requests it.

## Decision

Ship `video` as a built-in agent preset under `@deepseek-ai/dsh-agent-presets`. Its scoped persona defines three ordered stages: script writing, video production, and render/export. Entering every stage requires explicit user confirmation. The first stage writes a versioned `script.json` contract with ordered scenes, per-scene narration, visual intent, asset and audio paths, and eventual duration. The production stage creates every narration track first, measures its actual duration, then builds synchronized Hyperframes scenes; HTML animation is the default visual medium and generated images are optional per scene. The export stage invokes `video_render` only after an explicit MP4 request.

The preset mounts scoped persona, filesystem, platform shell, user-question, and todo rows needed to create one project directory per video and enforce the review boundaries. Media tools stay in the Host plane: the `video-app` bundle alone installs and enables Qwen speech, Evolink image, and Hyperframes, while `@deepseek-ai/dsh-hyperframes-tools` owns the direct `hyperframes` npm dependency and bundled CLI path. The base bundle has no video-media rows or dependencies. Sessions in the video profile inherit these registrations without duplicating Host rows inside the preset.

The built-in display fold and Web locale dictionaries map the system-trusted `video` id to localized name and description keys. Unknown or user-authored preset ids continue using their file metadata.

The shipped `video` profile composes `dsh-base`, `dsh-web-app`, and `dsh-video-app` in that order and selects `video` as its default Agent preset. The video bundle mounts a dual-face UI plugin: its Host half discovers versioned `script.json` projects below `DSH_VIDEO_PROJECTS_ROOT` (or the launch directory), and serves only contained project media through authenticated Connection routes; its Client half contributes an application-mode switch, project list, preview, and subtitle, visual, and audio tracks. The generic shell owns the mode slots and moves the existing Conversation surface into the right column, preserving Markdown, tool steps, streaming, and final-message folding rather than implementing another chat view.

## Alternatives considered

**Add video guidance to Standard mode.** This would add persistent prompt tokens and workflow constraints to every coding session, and it would not give users an explicit mode choice. A scoped preset confines both prompt and tool composition to sessions that select video production.

**Duplicate media rows inside the preset.** Scoped duplicates appear explicit but violate the one-row-one-plane rule and make the same tool schema compete across Host and preset scopes. The video bundle owns enablement, while Loader coverage proves the preset inherits each tool once.

**Replace the root Web layout in the video plugin.** A replacement would have to duplicate sidebar, Conversation, details, resizing, and scope ownership. Generic mode slots let the shell keep those responsibilities while the video package owns only its navigation and canvas.

**Copy the chat renderer into the video package.** This would fork Markdown, tool-call, reasoning-step, streaming, and folding behavior. Reusing the existing Conversation slot keeps one durable event projection and one presentation path.

**Store the script as Markdown.** Markdown is easy to read but is not a stable UI contract. Versioned JSON gives the future storyboard UI ordered, typed fields while remaining editable by the Agent and user.

**Render automatically after snapshots pass.** A successful preview is not user authorization for a potentially expensive final render. The persona stops at `ready-to-render` and requires a separate explicit MP4 request.

## Consequences

The preset roster and selector gain a fifth built-in mode, and the launcher gains a live `video` profile. Sessions on it receive the Host media tool names exactly once. The Web UI polls the configured root for `script.json` changes so Agent-written scene timing and assets appear without writing presentation state into the Session log. Project discovery is intentionally bounded to two directory levels by the shipped bundle and can be relocated with `DSH_VIDEO_PROJECTS_ROOT`; deeper layouts require an override. Provider credentials, audio downloads, browser availability, codecs, fonts, and render performance remain deployment requirements. `script.json` schema version 1 is now a UI-facing contract, so incompatible field changes require a new version or migration.

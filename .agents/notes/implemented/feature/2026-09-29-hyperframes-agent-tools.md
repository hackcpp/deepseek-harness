# Agent Note: Hyperframes Agent tools

Status: implemented

English | [中文](2026-09-29-hyperframes-agent-tools.zh.md)

## Problem

An Agent can edit a Hyperframes project but cannot invoke the project's own static checks, visual timeline review, or MP4 renderer through typed tools. Running arbitrary shell commands exposes more capability than these three operations require, and the Web settings page needs one saved switch that keeps the visible tool list aligned with user intent.

## Decision

`@deepseek-ai/dsh-hyperframes-tools` is a Cordis plugin in `packages/media`. Only the `video-app` bundle mounts it with `enabled: true`, and its `hyperframes-tools` settings section registers or removes `video_lint`, `video_snapshot`, and `video_render` together. The Plugin configuration tab saves the same live switch.

Each tool invokes the bundled Hyperframes CLI through `ctx.subprocess`. The subprocess service resolves the executable in its execution world, applies cancellation and a configurable deadline, and bounds both collected streams. `video_lint` runs `hyperframes lint --json` and represents reported source errors as a successful inspection value. `video_snapshot` passes one to nine exact timestamps to `hyperframes snapshot`, disables the automatic end frame, and requires Hyperframes to create the three-column contact sheet. `video_render` selects MP4 explicitly and writes the stable project-relative output `renders/render.mp4`.

## Alternatives considered

**Reimplement Hyperframes parsing and rendering.** A second validator, browser capture flow, or video encoder would drift from the project toolchain. CLI delegation keeps project semantics and diagnostics owned by Hyperframes.

**Remove the settings switch and make registration irreversible.** Default-on tools still need an operator escape hatch. Settings-driven registration can remove their schemas and executors without restarting the Host.

**Expose arbitrary Hyperframes arguments.** Free-form arguments would turn three bounded operations into a shell escape and make outputs unpredictable. The wrappers own fixed commands, output paths, timestamp limits, and result schemas.

**Return lint findings as a failed tool call.** Source errors are the expected result of an inspection, not an infrastructure failure. A successful value lets an Agent read counts and diagnostics, while launch failures, malformed CLI output, and render failures remain tool errors.

## Consequences

An Agent gets the same validator and renderer a Hyperframes author uses, with stable Agent Tool schemas and reversible registration. Snapshot and render calls remain foreground operations and can consume substantial browser, codec, CPU, and memory resources. Hyperframes clears image files in the project's snapshot directory, and repeated MP4 renders can replace the fixed output file. Focused tests execute the real Loader composition and simulate the subprocess outcomes; host-specific Chrome, FFmpeg, font, codec, and GPU combinations remain Hyperframes deployment concerns.

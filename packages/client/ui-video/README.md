# @deepseek-ai/dsh-client-ui-video

English | [中文](README.zh.md)

`dsh-client-ui-video` adds a video-production application mode to the Web shell. Its Host half recognizes session working directories containing `script.json` and serves their project assets through authenticated API routes. It discovers completed renders under `renders/`, serves byte ranges for browser playback and seeking, and keeps scene snapshots as the fallback before a render exists. Its Client half contributes the mode switch, session-backed project navigation, full-video or scene preview, and subtitle/visual/audio timeline while reusing the shipped Conversation surface for Agent interaction.

## Model Experience

The package does not add model-visible input. The `video` profile selects the user's `video` Agent preset, whose tools and prompt own video-production behavior.

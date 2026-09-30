# @deepseek-ai/dsh-client-ui-video

English | [中文](README.zh.md)

`dsh-client-ui-video` adds a video-production application mode to the Web shell. Its Host half discovers `script.json` projects below the configured project root and serves project assets through authenticated API routes. Its Client half contributes the mode switch, project navigation, preview, and subtitle/visual/audio timeline while reusing the shipped Conversation surface for Agent interaction.

## Model Experience

The package does not add model-visible input. The `video` profile selects the user's `video` Agent preset, whose tools and prompt own video-production behavior.

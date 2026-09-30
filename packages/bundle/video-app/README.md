# @deepseek-ai/dsh-video-app

English | [中文](README.zh.md)

`dsh-video-app` is the final bundle in the shipped `video` profile. It selects the `video` Agent preset, enables the Qwen speech, Evolink image, and Hyperframes tool plugins, and mounts the video workspace UI.

Each video project is the working directory of a DSH session. The video workspace derives its current and historical projects from session `cwd` values and recognizes a project when that directory contains `script.json`.

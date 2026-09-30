# @deepseek-ai/dsh-video-app

[English](README.md) | 中文

`dsh-video-app` 是内置 `video` profile 的最后一个 bundle。它选择 `video` Agent preset，启用通义千问语音、Evolink 图片和 Hyperframes 工具插件，并挂载视频工作台 UI。

每个视频项目对应一个 DSH 会话工作目录。视频工作区从会话的 `cwd` 获取当前与历史项目，并在该目录包含 `script.json` 时将其识别为视频项目。

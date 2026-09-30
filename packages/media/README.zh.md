---
description: "媒体包组：生成图片和语音，或检查并渲染 Hyperframes 视频项目的 Agent 工具。"
kind: "package-group"
---

# packages/media

[English](README.md) | 中文

## 概述

媒体包组让 Agent 为用户生成或渲染媒体。插件使用 Qwen3-TTS 生成语音、使用 Evolink Z-Image-Turbo 生成图片，或检查并渲染本地 Hyperframes 视频项目。远程提供方负责所生成媒体的可用性和过期时间；harness 不存储其返回的字节。

## 目录

- [包](#packages)
- [相关文档](#related-documentation)
- [开发备注](#dev-note)

-----

<a id="packages"></a>
## 包

| 包 | 职责 | ctx 键 |
|---|---|---|
| [`speech-generation-qwen/`](speech-generation-qwen/README.zh.md) | 通过 `generate_speech` 使用 Qwen3-TTS 生成语音 | 注册到 `ctx.tools` |
| [`image-generation-evolink/`](image-generation-evolink/README.zh.md) | 通过 `generate_image` 使用 Evolink Z-Image-Turbo 生成图片 | 注册到 `ctx.tools` |
| [`hyperframes-tools/`](hyperframes-tools/README.zh.md) | 通过三个视频工具检查、截图并渲染 Hyperframes 项目 | 注册到 `ctx.tools` |

-----

<a id="related-documentation"></a>
## 相关文档

- [工具子系统](../../docs/subsystems/tools.zh.md)——工具注册、执行与展示。
- [工具目录](../../docs/tool-catalog.zh.md#deepseek-aidsh-speech-generation-qwen)——生成的语音工具 schema。
- [语音生成决策](../../.agents/notes/implemented/feature/2026-09-29-qwen-speech-generation-tool.zh.md)——启用方式和结果有效期。
- [图片生成决策](../../.agents/notes/implemented/feature/2026-09-29-evolink-image-generation-tool.zh.md)——异步轮询与启用方式。
- [Hyperframes 工具决策](../../.agents/notes/implemented/feature/2026-09-29-hyperframes-agent-tools.zh.md)——CLI 委托、设置与输出路径。

-----

<a id="dev-note"></a>
## 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>

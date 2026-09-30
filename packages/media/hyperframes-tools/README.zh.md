---
description: "配置 Agent 工具，通过随包提供的 Hyperframes CLI 检查 Hyperframes 项目、渲染时间点九宫格并生成 MP4 视频文件。"
kind: "package-reference"
---

# @deepseek-ai/dsh-hyperframes-tools

[English](README.md) | 中文

## Summary

此包让 Agent 验证 Hyperframes 项目、在一张拼图中检查指定时间点的画面，并把项目渲染为 MP4。它把每项操作委托给 Hyperframes，不重复实现项目解析器或渲染器。在用户通过设置 > 插件 > 插件配置启用 Hyperframes 视频工具前，这些工具保持隐藏。

## Table of Contents

- [使用此包](#use-this-package)
- [了解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用此包

基础 profile 挂载此插件时默认启用全部三个工具；设置卡片无需重启 Host 即可禁用或重新启用它们。

### 何时选择

当项目目录遵循 Hyperframes 约定，且 Agent 需要与 Hyperframes CLI 相同的 lint、截图或渲染行为时，请选择此包。对于非 Hyperframes composition，请使用普通文件系统和 shell 工具。

### 最小配置

设置卡片初始为启用状态。若要直接挂载插件并使用相同默认值：

```yaml
- name: '@deepseek-ai/dsh-hyperframes-tools'
  config:
    enabled: true
```

| 字段 | 默认值 | 含义 |
|---|---|---|
| `enabled` | `true` | 注册 `video_lint`、`video_snapshot` 和 `video_render` |
| `executable` | 随包提供的 Hyperframes CLI | 覆盖子进程执行环境中的可执行文件 |
| `timeoutMs` | `600000` | 单次前台 CLI 调用的最长时间 |
| `maxOutputBytes` | `262144` | 每个 CLI 输出流最多保留的字节数 |

生成的[配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-hyperframes-tools)列出所有可接受字段。每个工具都要求 `projectPath`。`video_snapshot` 还要求一至九个非负秒数时间点。

-----

<a id="understand-the-implementation"></a>
## 了解实现

<details>
<summary>实现内部细节——点击展开</summary>

设置区段把三个工具定义作为整体注册或移除。每次调用通过子进程服务解析配置的可执行文件，以有界输出和协作式取消启动随包提供的 Hyperframes CLI，并把 CLI 结果转换成类型化工具值。`video_lint` 把 lint 失败保留为成功的检查结果；进程、截图和渲染失败则成为错误工具结果。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [媒体包索引](../README.zh.md)——相关媒体工具。
- [工具目录](../../../docs/tool-catalog.zh.md#deepseek-aidsh-hyperframes-tools)——生成的 Agent 工具 schema。
- [工具子系统](../../../docs/subsystems/tools.zh.md)——注册和执行行为。
- [子进程包](../../subprocess/subprocess/README.zh.md)——可执行文件解析、取消与输出收集。

-----

<a id="model-experience"></a>
## 模型体验

### 工具 schema

#### 模型看到的内容

启用后，模型会看到生成的 [`video_lint`、`video_snapshot` 和 `video_render` schema](../../../docs/tool-catalog.zh.md#deepseek-aidsh-hyperframes-tools)。它们必填的项目路径指向一个 Hyperframes 项目。截图 schema 还包含由一至九个时间点组成的有序 `times` 数组。

#### Token 影响

启用且可见时，三个 schema 增加固定的输入开销。此包不添加系统提示词。

#### KV Cache 影响

只要注册和配置保持不变，schema 就保持前缀稳定。启用或禁用卡片会改变工具列表，并可能使工具定义前缀的复用失效。

### 工具结果与错误

#### 模型看到的内容

`video_lint` 返回通过标志、错误和警告计数以及 Hyperframes 发现项。`video_snapshot` 返回拼图路径、截图目录和捕获的时间点。`video_render` 返回 MP4 路径。无效参数、CLI 启动失败、超时、拼图缺失以及非 lint 命令失败会产生错误工具结果。

#### Token 影响

只有调用会把结果或错误文本加入保留历史。lint 发现项数量决定最大结果。

#### KV Cache 影响

工具结果追加在现有请求前缀之后，不改变之前缓存的内容。

## 已知限制与后续工作

<a id="known-limitations-and-deferred-work"></a>

Hyperframes 负责浏览器、编解码器和项目兼容性，因此包装层保留以下运行限制。

- **前台执行**——截图和 MP4 渲染会占用工具调用，直到 Hyperframes 退出或配置的超时将其中止。
- **替换截图目录**——Hyperframes 在写入所选帧与 `contact-sheet.jpg` 前，会清理 `<project>/snapshots` 中的图片文件。
- **固定 MP4 路径**——`video_render` 写入 `<project>/renders/render.mp4`；后续调用可能替换该文件。
- **运行时依赖**——特定项目可能要求 Hyperframes 可用的 Chrome、FFmpeg、字体、编解码器或 GPU 支持。测试模拟子进程结果，不证明每个 Host 都能渲染每个 composition。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>

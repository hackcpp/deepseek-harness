---
description: "配置 Evolink Z-Image-Turbo generate_image Agent 工具、轮询间隔、凭据引用和临时图片 URL 结果。"
kind: "package-reference"
---

# @deepseek-ai/dsh-image-generation-evolink

[English](README.md) | 中文

## 概述

`generate_image` 根据文字提示创建 Evolink Z-Image-Turbo 任务，并轮询到任务完成。工具默认启用，也可以在“设置 > 插件 > 插件配置”中关闭。提供方返回临时图片 URL；用户须在 24 小时内下载图片。每次调用都需要 API Key。

## 目录

- [使用此包](#use-this-package)
- [了解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与待办工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用此包

基础 profile 以 `enabled: true` 挂载此插件；设置卡片实时控制工具注册，也可以将其关闭。

### 何时选择

当 Agent 需要根据文字提示生成图片，并且部署可以使用 Evolink 时，使用此包。插件创建异步 Z-Image-Turbo 任务并返回提供方完成后的图片 URL；harness 不存储图片字节。

### 最小配置

在启动环境或项目 `.env` 中设置 `EVOLINK_API_KEY` 后，默认组合会自动注册工具。组合也可以显式关闭：

```yaml
- name: '@deepseek-ai/dsh-image-generation-evolink'
  config:
    enabled: false
```

| 字段 | 默认值 | 含义 |
|---|---|---|
| `enabled` | `true` | 启用时注册 `generate_image` |
| `apiKeyEnv` | `EVOLINK_API_KEY` | 每次调用时解析的凭据引用 |
| `apiBaseUrl` | `https://api.evolink.ai/v1/` | Evolink HTTPS API 目录 URL |
| `pollIntervalMs` | `5000` | 两次任务状态请求之间的毫秒数 |
| `timeoutMs` | `180000` | 创建与轮询流程的总超时毫秒数 |

[配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-image-generation-evolink)列出接受的字段。调用需要 `prompt`，并可接受 `size`、`seed` 与 `nsfw_check`，例如 `generate_image({ prompt: 'A moonlit lake', size: '16:9', seed: 42 })`。缺少密钥、HTTP 非成功状态、无效提供方响应、失败或取消的任务、无效提示词或超出范围的种子都会产生错误工具结果。

-----

<a id="understand-the-implementation"></a>
## 了解实现

<details>
<summary>实现内部——点击展开</summary>

设置区段决定工具是否注册。执行时解析凭据，提交 `POST /v1/images/generations`，在两次 `GET /v1/tasks/{task_id}` 请求之间等待五秒，并返回完成响应中的 `results` URL。[`src/index.ts`](src/index.ts)负责注册与提供方调用；[`src/invariant.ts`](src/invariant.ts)负责包不变量伴随插件。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [Evolink Z-Image-Turbo API](https://evolink.ai/z-image-turbo)——提供方请求字段与任务流程。
- [媒体包映射](../README.zh.md)——媒体生成相关包。
- [工具目录](../../../docs/tool-catalog.zh.md#deepseek-aidsh-image-generation-evolink)——生成的 Agent 工具 schema。
- [设置包](../../settings/settings/README.zh.md)——持久设置区段语义。

-----

<a id="model-experience"></a>
## 模型体验

### 工具 schema

#### 模型看到的内容

启用后，模型看到带必填 `prompt` 以及可选尺寸、种子和更严格内容检查的[`generate_image` schema](../../../docs/tool-catalog.zh.md#deepseek-aidsh-image-generation-evolink)。关闭卡片后，后续请求不再包含此 schema。

#### Token 影响

启用且可见时，schema 增加固定输入开销。此包不添加系统提示词。

#### KV Cache 影响

注册状态与字段不变时，schema 的前缀保持稳定。启用或关闭可能使工具定义之后的缓存无法复用。

### 工具结果与错误

#### 模型看到的内容

成功调用返回 `Images (URLs expire after 24 hours):`，后面列出一个或多个 URL。失败调用返回 `Error: <message>`；API Key 不会出现在结果中。

#### Token 影响

仅调用会把结果或错误文本写入保留的历史；URL 数量和长度决定结果大小。

#### KV Cache 影响

结果位于已有请求前缀之后。新增结果文本仅追加。

## 已知限制与待办工作

<a id="known-limitations-and-deferred-work"></a>

提供方控制任务执行和返回图片的可用时间。

- **临时 URL**——工具返回提供方 URL，不持久化图片字节。完成后的图片应在 24 小时内下载。
- **前台轮询**——工具调用会在轮询期间保持活动。`timeoutMs` 限制完整的创建和轮询流程，取消操作会中止当前请求或等待。
- **未验证真实提供方**——测试使用模拟响应；需要真实 API Key 才能验证账户权限、计费、内容审核和生成图片内容。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>

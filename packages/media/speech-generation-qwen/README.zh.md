---
description: "配置 Qwen3-TTS generate_speech Agent 工具、音色输入、凭据引用和会过期的音频 URL 结果。"
kind: "package-reference"
---

# @deepseek-ai/dsh-speech-generation-qwen

[English](README.md) | 中文

## 概述

`generate_speech` 用选定的 Qwen3-TTS 音色将文字转换为语音。用户在“设置 > 插件 > 插件配置”中启用“千问文字转语音”并保存后，工具才会出现。提供方返回临时音频 URL；用户须在过期前下载音频。每次调用都需要 API Key。

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

当 Agent 需要从文字生成语音，并且部署可以使用阿里云百炼 DashScope 服务时，使用此包。插件把文字发送到配置的 HTTPS 端点并返回提供方音频 URL；harness 不存储音频字节。

### 最小配置

在启动环境或项目 `.env` 中设置 `DASHSCOPE_API_KEY`，再启用“千问文字转语音”卡片并保存。组合也可以直接启用：

```yaml
- name: '@deepseek-ai/dsh-speech-generation-qwen'
  config:
    enabled: true
```

| 字段 | 默认值 | 含义 |
|---|---|---|
| `enabled` | `true` | 启用时注册 `generate_speech` |
| `apiKeyEnv` | `DASHSCOPE_API_KEY` | 每次调用时解析的凭据引用 |
| `model` | `qwen3-tts-flash` | DashScope 语音模型 |
| `endpoint` | 北京地域 DashScope 多模态生成端点 | HTTPS API 端点 |
| `maxTextLength` | `500` | 输入文字的 Unicode 码点上限 |
| `timeoutMs` | `60000` | 请求超时毫秒数 |

[配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-speech-generation-qwen)列出接受的字段。调用需要 `text` 与 `voice` 字符串，例如 `generate_speech({ text: 'Hello', voice: 'Cherry' })`。所选音色必须受到对应模型支持。缺少密钥、HTTP 非成功状态、无效音频响应、空音色或超出长度限制的文字都会产生错误工具结果。

-----

<a id="understand-the-implementation"></a>
## 了解实现

<details>
<summary>实现内部——点击展开</summary>

设置区段决定工具是否注册。执行时解析凭据，发送一次非流式 DashScope 请求，校验返回的音频 URL 与过期时间，再渲染工具结果。[`src/index.ts`](src/index.ts)负责注册与提供方调用；[`src/invariant.ts`](src/invariant.ts)负责包不变量伴随插件。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [媒体包映射](../README.zh.md)——媒体生成相关包。
- [工具目录](../../../docs/tool-catalog.zh.md#deepseek-aidsh-speech-generation-qwen)——生成的 Agent 工具 schema。
- [设置包](../../settings/settings/README.zh.md)——持久设置区段语义。

-----

<a id="model-experience"></a>
## 模型体验

### 工具 schema

#### 模型看到的内容

启用后，模型看到带必填 `text` 与 `voice` 的[`generate_speech` schema](../../../docs/tool-catalog.zh.md#deepseek-aidsh-speech-generation-qwen)。关闭卡片后，后续请求不再包含此 schema。

#### Token 影响

启用且可见时，schema 增加固定输入开销。此包不添加系统提示词。

#### KV Cache 影响

注册状态与字段不变时，schema 的前缀保持稳定。启用或关闭可能使工具定义之后的缓存无法复用。

### 工具结果与错误

#### 模型看到的内容

成功调用返回 `Audio: <url>`、`Voice: <voice>` 与 `URL expires at: <ISO time>`。失败调用返回 `Error: <message>`；API Key 不会出现在结果中。

#### Token 影响

仅调用会把结果或错误文本写入保留的历史；URL 长度决定结果大小。

#### KV Cache 影响

结果位于已有请求前缀之后。新增结果文本仅追加。

## 已知限制与待办工作

<a id="known-limitations-and-deferred-work"></a>

提供方控制返回音频的有效期和支持的音色。

- **临时 URL**——工具返回提供方 URL，不持久化音频字节。URL 在 `expiresAt` 后失效（通常约 24 小时）。
- **提供方验证**——工具检查音色非空，但 DashScope 决定所选模型是否支持该音色。
- **未验证真实提供方**——测试使用模拟响应；需要真实 API Key 才能验证账户权限和音频播放。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

无。

</details>

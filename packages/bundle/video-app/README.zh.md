# @deepseek-ai/dsh-video-app

[English](README.md) | 中文

`dsh-video-app` 是内置 `video` profile 的最后一个 bundle。它选择 `video` Agent preset，启用通义千问语音、Evolink 图片和 Hyperframes 工具插件，并挂载视频工作台 UI。

可以通过 `DSH_VIDEO_PROJECTS_ROOT` 指定视频项目根目录，其后代目录中的每个视频项目各占一个文件夹。未设置时使用当前进程目录。

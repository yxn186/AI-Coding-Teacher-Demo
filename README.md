# 积木小老师

一个面向儿童的本地前端原型，包含任务区、舞台区、AI 小老师区、程序区、8 个任务、自由实验室、拖拽积木、运行反馈、语音示例，以及“本地后端转厂商 API”的统一接入方式。

当前版本已经接入两条真实能力：

- 文字提示：前端通过本地 `server/` 调用 DeepSeek。
- 朗读语音：前端通过本地 `server/` 调用豆包 TTS；如果豆包不可用，会自动回退到浏览器原生 `speechSynthesis`。

前端仍然保持原来的页面结构、任务系统、拖拽逻辑、运行逻辑、语音按钮、AI 小老师面板和统一适配器结构。前端不会直接请求厂商 API。

## 两种使用方式

### 方式一：只当本地前端原型使用

如果你现在只是想直接打开页面继续演示，可以：

1. 双击根目录里的 `index.html`
2. 用现代浏览器打开即可

这种情况下：

- 页面仍然能运行
- AI 小老师文案会走前端 mock 或本地默认兜底
- 朗读会走浏览器原生语音
- 不需要安装 Node.js

### 方式二：接入真实 AI 与真实 TTS

如果你要：

- 让 AI 小老师文字提示来自 DeepSeek
- 让页面朗读优先来自豆包 TTS

请按下面步骤做。

## 最简启动步骤

### 第一步：安装 Node.js

请先安装 Node.js，建议使用 Node.js 18 或更高版本。

如果你已经安装过，可以在终端里运行：

```powershell
node -v
```

如果能看到版本号，就可以继续。

### 第二步：打开终端并进入 `server` 文件夹

在项目根目录打开终端，然后执行：

```powershell
cd server
```

### 第三步：安装依赖

执行：

```powershell
npm install
```

安装完成后会生成 `node_modules`。

### 第四步：复制 `.env.example` 为 `.env`

在 `server` 文件夹里，把：

```text
.env.example
```

复制一份并改名为：

```text
.env
```

也可以用终端执行：

```powershell
Copy-Item .env.example .env
```

### 第五步：填写你自己的 DeepSeek 和豆包配置

真正需要填写的是：

`server/.env`

参考模板文件：

[server/.env.example](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/server/.env.example)

你至少需要填写这些占位：

```text
DEEPSEEK_API_KEY=YOUR_DEEPSEEK_API_KEY_HERE
DOUBAO_TTS_APPID=YOUR_DOUBAO_TTS_APPID_HERE
DOUBAO_TTS_TOKEN=YOUR_DOUBAO_TTS_TOKEN_HERE
DOUBAO_TTS_CLUSTER=YOUR_DOUBAO_TTS_CLUSTER_HERE
DOUBAO_TTS_VOICE_TYPE=YOUR_DOUBAO_TTS_VOICE_TYPE_HERE
```

其余默认配置可以先不改：

```text
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_TIMEOUT_MS=15000
DOUBAO_TTS_RATE=24000
DOUBAO_TTS_ENCODING=mp3
DOUBAO_TTS_SPEED_RATIO=1.0
DOUBAO_TTS_VOLUME_RATIO=1.0
DOUBAO_TTS_PITCH_RATIO=1.0
DOUBAO_TTS_TIMEOUT_MS=15000
PORT=3000
```

### 第六步：启动本地后端

在 `server` 文件夹执行：

```powershell
npm start
```

如果启动成功，终端会打印类似：

```text
DeepSeek server running at http://localhost:3000
```

如果 DeepSeek 或豆包配置缺失，服务仍然会启动，但终端会明确提示缺了哪一类配置，并自动回退到兜底能力。

### 第七步：检查后端是否已启动

先检查健康接口：

[http://localhost:3000/api/health](http://localhost:3000/api/health)

你会看到类似：

```json
{
  "provider": "deepseek",
  "status": "ready"
}
```

如果没填 DeepSeek Key，通常会看到：

```json
{
  "provider": "deepseek",
  "status": "missing_key"
}
```

### 第八步：再打开前端页面

后端启动后，再打开根目录里的 `index.html`。

此时前端默认会：

- 优先请求 `http://localhost:3000/api/tutor-reply` 获取 DeepSeek 文案
- 优先请求 `http://localhost:3000/api/tts` 获取豆包 TTS 音频
- 如果后端没启动、配置没填、请求超时或失败，会自动回退

你不需要修改前端其它文件。

## 这次的关键文件

### 后端文件

- [server/server.js](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/server/server.js)
- [server/deepseek.js](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/server/deepseek.js)
- [server/doubaoTts.js](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/server/doubaoTts.js)
- [server/.env.example](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/server/.env.example)
- [server/package.json](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/server/package.json)

### 前端文件

- [api.js](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/api.js)
- [speech.js](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/speech.js)
- [state.js](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/state.js)
- [render.js](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/render.js)
- [bootstrap.js](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/bootstrap.js)

## 前端现在怎么调用后端

前端其它层仍然不会直接写厂商请求。

统一通过：

```js
App.api.getTutorReply(context)
App.api.resolveVoiceIntent(promptId)
App.api.getHealth()
App.api.getTtsAudio(text)
```

这意味着：

- `bootstrap.js` 里的 `showTutorMessage(...)` 调用方式保留
- `render.js`、`runtime.js`、页面按钮都不直接知道 DeepSeek 或豆包
- `speech.js` 只知道“先请求本地 `/api/tts`，失败再回退浏览器朗读”

## 现在的朗读行为

页面里的这些朗读入口都会优先尝试豆包 TTS：

- 顶部“朗读当前任务”
- 顶部“跳过朗读”
- 顶部“停下”
- 右侧“小老师”区域的朗读按钮
- `showTutorMessage(..., { autoSpeak: true })` 触发的朗读

如果豆包返回成功：

- 会播放真实远程音频

如果豆包失败、未配置、超时、返回异常：

- 会自动回退到浏览器原生 `speechSynthesis`
- 页面不会因为 TTS 失败而不能演示

## 如何验证豆包 TTS 是否接通

### 方法一：看后端终端日志

每次前端请求 TTS，终端都会打印：

```text
[tts] request ...
```

如果成功，会打印：

```text
[tts] success ...
```

如果回退，会打印：

```text
[tts] fallback reason=... message=...
```

常见 fallback 原因包括：

- `missing_config`
- `text_empty`
- `text_too_long`
- `timeout`
- `request_failed`
- `invalid_response`

### 方法二：直接测本地接口

你可以用任意调试工具向本地后端发送：

`POST http://localhost:3000/api/tts`

请求体：

```json
{
  "text": "你好，我是积木小老师。"
}
```

成功时返回：

```json
{
  "audioBase64": "...",
  "format": "mp3",
  "source": "doubao"
}
```

失败时返回：

```json
{
  "audioBase64": "",
  "format": "mp3",
  "source": "fallback",
  "error": "missing_config: ..."
}
```

### 方法三：看页面调试面板

页面调试面板现在会显示：

- `最近提示来源`
- `最近朗读来源`
- `最近朗读错误`

如果最近一次朗读走了豆包，会看到：

```text
最近朗读来源：doubao
```

如果最近一次朗读走了浏览器回退，会看到：

```text
最近朗读来源：fallback
```

## 如果没有填豆包配置，会发生什么

如果 `server/.env` 里这些值没填完整：

```text
DOUBAO_TTS_APPID=YOUR_DOUBAO_TTS_APPID_HERE
DOUBAO_TTS_TOKEN=YOUR_DOUBAO_TTS_TOKEN_HERE
DOUBAO_TTS_CLUSTER=YOUR_DOUBAO_TTS_CLUSTER_HERE
DOUBAO_TTS_VOICE_TYPE=YOUR_DOUBAO_TTS_VOICE_TYPE_HERE
```

那么：

- `POST /api/tts` 会返回 `source: "fallback"`
- 后端会打印明确的 fallback 原因
- 页面朗读仍然可用，但改为浏览器原生语音
- 不会让前端崩掉

## API 模式说明

当前 `api.js` 仍支持三种模式：

- `auto`：默认模式。先请求本地后端，失败时自动回退 mock 或本地默认能力。
- `server`：强制走本地后端。
- `mock`：完全不请求后端。

如果你想临时切回 mock，可在浏览器控制台执行：

```js
JimuApp.api.setMode("mock")
```

如果想恢复自动模式：

```js
JimuApp.api.setMode("auto")
```

## 目录说明

- [index.html](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/index.html)：页面结构与经典脚本加载顺序
- [config.js](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/config.js)：任务、积木、角色、场景和提示配置
- [state.js](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/state.js)：状态、持久化、日志、统一错误处理
- [render.js](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/render.js)：渲染任务区、舞台区、AI 面板和程序区
- [runtime.js](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/runtime.js)：校验与执行逻辑
- [speech.js](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/speech.js)：远程 TTS 优先、浏览器朗读回退
- [bootstrap.js](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/bootstrap.js)：初始化与事件绑定
- [server/](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/server)：本地 DeepSeek + 豆包 TTS 后端

## 当前限制

- 当前环境里如果没有安装 Node.js，本仓库仍然只能做静态前端演示。
- 浏览器原生朗读仍然是重要兜底链路，不建议删除。
- 如果以后要接更多语音能力，仍建议继续放在 `server/` 下，由前端只请求本地后端。

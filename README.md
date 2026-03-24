# 积木小老师

一个面向儿童的本地前端原型，包含任务区、舞台区、AI 小老师区、程序区、8 个任务、自由实验室、拖拽积木、运行反馈、语音示例和浏览器朗读。

当前版本已经进入“真实 AI 接入第一步”：

- 前端仍然保留原来的页面结构、任务系统、拖拽逻辑、运行逻辑、语音按钮、AI 小老师面板和统一适配器结构。
- `speech.js` 仍然使用浏览器原生 `speechSynthesis`，暂时没有接入豆包 TTS。
- 新增了一个 `server/` 目录，用本地 Node.js + Express 后端去调用 DeepSeek 文字接口。
- 前端 `api.js` 现在支持 `auto / server / mock` 三种模式，默认是 `auto`：优先尝试本地后端，失败时自动回退到 mock。

## 你现在有两种使用方式

### 方式一：继续当纯前端原型使用

如果你现在只是想继续看页面、拖积木、跑任务，不用真实 AI，也可以像以前一样直接打开：

1. 双击根目录里的 `index.html`
2. 用现代浏览器打开即可

这种情况下：

- 页面仍然能运行
- AI 小老师文案会走前端 mock
- 朗读仍然使用浏览器原生语音
- 不需要安装 Node.js

### 方式二：接入 DeepSeek 真实文字提示

如果你要让 AI 小老师真正通过 DeepSeek 生成文字提示，请按下面步骤做。

## 用 DeepSeek 的最简步骤

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

安装完成后，会生成 `node_modules`。

### 第四步：复制 `.env.example` 为 `.env`

在 `server` 文件夹里，把：

```text
.env.example
```

复制一份并改名为：

```text
.env
```

你也可以用终端执行：

```powershell
Copy-Item .env.example .env
```

### 第五步：填写你的 DeepSeek API Key

打开这个文件：

[server/.env.example](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/server/.env.example)

真正需要填写的是复制出来的：

`server/.env`

请把这一行：

```text
DEEPSEEK_API_KEY=YOUR_DEEPSEEK_API_KEY_HERE
```

改成你自己的 key，例如：

```text
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxx
```

其他配置默认可以先不改：

```text
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_TIMEOUT_MS=15000
PORT=3000
```

### 第六步：启动后端

在 `server` 文件夹执行：

```powershell
npm start
```

如果启动成功，终端会打印类似：

```text
DeepSeek server running at http://localhost:3000
```

如果你没有填写 key，终端也会明确提示你去填写 `server/.env`，但服务依然会启动。

### 第七步：检查后端是否正常

打开浏览器访问：

[http://localhost:3000/api/health](http://localhost:3000/api/health)

你会看到类似结果：

```json
{
  "provider": "deepseek",
  "status": "ready"
}
```

如果没有填 key，通常会看到：

```json
{
  "provider": "deepseek",
  "status": "missing_key"
}
```

### 第八步：再打开前端页面

后端启动后，再打开根目录里的 `index.html`。

此时前端默认会：

- 优先调用 `http://localhost:3000/api/tutor-reply`
- 如果后端可用，就使用 DeepSeek 返回的小老师文案
- 如果后端没启动、Key 没填、请求超时或失败，就自动回退到 mock

你不需要再改前端其他文件。

## 哪些文件是这次新增或重点修改的

### 后端文件

- [server/package.json](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/server/package.json)
- [server/server.js](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/server/server.js)
- [server/deepseek.js](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/server/deepseek.js)
- [server/.env.example](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/server/.env.example)
- [server/.gitignore](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/server/.gitignore)

### 前端适配层

- [api.js](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/api.js)

## 前端现在怎么调用真实 AI

前端其他层没有直接写 DeepSeek 请求。

仍然只通过统一接口调用：

```js
App.api.getTutorReply(context)
App.api.resolveVoiceIntent(promptId)
App.api.getHealth()
```

这意味着：

- `bootstrap.js` 里原来的 `showTutorMessage(...)` 调用方式保留
- `render.js`、`runtime.js`、`speech.js` 不需要直接知道 DeepSeek
- 将来如果要接豆包 TTS，也只需要继续扩展适配层和后端，不用推翻当前前端结构

## `api.js` 里的模式说明

当前 `api.js` 支持三种模式：

- `auto`：默认模式。先请求本地后端，失败时自动回退 mock。
- `server`：强制走本地后端。请求失败时显示本地兜底文案，但不自动切到 mock 健康状态。
- `mock`：完全不请求后端，始终使用前端 mock。

### 默认模式

默认是：

```js
auto
```

也就是最适合本地开发的模式。

### 如果你想临时切回 mock

打开浏览器开发者工具控制台，执行：

```js
JimuApp.api.setMode("mock")
```

### 如果你想恢复自动模式

执行：

```js
JimuApp.api.setMode("auto")
```

### 如果你想强制只走本地后端

执行：

```js
JimuApp.api.setMode("server")
```

这个模式会保存到浏览器 `localStorage`，刷新页面后仍然生效。

## 如果没有填 Key，会发生什么

如果 `server/.env` 里的这行没有填写：

```text
DEEPSEEK_API_KEY=YOUR_DEEPSEEK_API_KEY_HERE
```

那么：

- `GET /api/health` 会返回 `missing_key`
- `POST /api/tutor-reply` 不会让页面崩掉
- 后端会返回兜底文案
- 前端在 `auto` 模式下仍然能正常继续使用

## 当前后端接口

### `GET /api/health`

作用：

- 给前端状态条和调试信息使用
- 检查当前后端与 DeepSeek 配置状态

返回示例：

```json
{
  "provider": "deepseek",
  "status": "ready"
}
```

### `POST /api/tutor-reply`

前端发送：

```json
{
  "context": {
    "type": "task",
    "taskId": "task1"
  }
}
```

后端返回：

```json
{
  "text": "先把说你好放进小猫的点击脚本里吧。",
  "mood": "guide",
  "suggestion": "先点一下小猫对应的脚本槽。",
  "speakText": "先把说你好放进小猫的点击脚本里吧。"
}
```

即使 DeepSeek 请求失败、超时、Key 缺失、返回格式异常，后端也会回退到默认提示，不会直接把错误抛给前端页面。

## 目录说明

- [index.html](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/index.html)：页面结构与经典脚本加载顺序
- [config.js](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/config.js)：任务、积木、角色、场景和提示配置
- [state.js](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/state.js)：状态、持久化、日志、统一错误处理
- [render.js](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/render.js)：渲染任务区、舞台区、AI 面板和程序区
- [runtime.js](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/runtime.js)：校验与执行逻辑
- [speech.js](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/speech.js)：浏览器原生朗读
- [bootstrap.js](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/bootstrap.js)：初始化与事件绑定
- [assets/README.md](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/assets/README.md)：图片素材命名与 emoji 回退规则
- [server/](/D:/AI_Coding/jimuxiaolaoshi-demo-v2.0/server)：本地 DeepSeek 后端

## 语音部分目前的状态

这次只接了 DeepSeek 的文字提示。

目前仍然是：

- AI 小老师文字内容可以来自 DeepSeek
- 朗读按钮继续使用浏览器原生 `speechSynthesis`
- 豆包语音 API 还没有接入

后续如果你要接 TTS，建议继续放在 `server/` 里扩展，不要把厂商请求直接写回前端页面层。


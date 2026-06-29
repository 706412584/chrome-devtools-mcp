# Chrome DevTools MCP — Game Edition

[![npm chrome-devtools-mcp-game package](https://img.shields.io/npm/v/chrome-devtools-mcp-game.svg)](https://npmjs.org/package/chrome-devtools-mcp-game)

基于 [ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) 的游戏开发增强分支。在原版全部功能基础上，新增 **19 个游戏开发专用工具**，解决跨域 iframe 点击、持久化浏览器会话、像素级截图对比、资源加载监控等游戏开发常见痛点。

## 新增功能一览

| 分类 | 工具 | 说明 |
|------|------|------|
| **跨域修复** | `click` 增强 | CDP Input.dispatchMouseEvent 自动 fallback，穿透跨域 iframe |
| **FPS 监控** | `game_stats` | requestAnimationFrame 采样，帧时间百分位，内存监控 |
| **HUD 叠加** | `inject_game_overlay` | 注入 FPS/Memory 实时显示层 |
| **控制台拦截** | `console_intercept_start/stop` | 捕获控制台输出到内存缓冲区 |
| **日志搜索** | `console_search` | 按文本、类型、时间范围搜索日志 |
| **日志统计** | `console_stats` | 按类型（log/warn/error）统计分布 |
| **截图对比** | `screenshot_diff` | 像素级对比 + 差异区域检测（BFS 连通分量） |
| **WebSocket 监控** | `websocket_monitor_start/get/stop` | CDP 级别 WebSocket 消息捕获 |
| **鼠标移动** | `mouse_move` | 鼠标悬停/移动触发 |
| **键盘序列** | `keyboard_sequence` | 批量键盘输入 + 延迟控制 |
| **自动测试** | `game_test` | 多步骤测试框架（截图基线对比、断言） |
| **游戏状态** | `game_state` | 预设查询（screen/dom/console/performance）+ 自定义 JS |
| **资源监控** | `asset_monitor_start/get` | 拦截 fetch/XHR/PerformanceObserver，按扩展名统计 |
| **Canvas 信息** | `canvas_info` | WebGL 版本、GPU 渲染器、纹理限制、DPR |
| **浏览器发现** | `browser_discover` | 扫描已运行的 Chrome 实例（端口/DevToolsActivePort） |
| **浏览器复用** | `browser_connect` | 生成复用配置，避免重复登录 |
| **截图压缩** | `take_screenshot` 增强 | `maxWidth`/`maxHeight` 参数，按需缩放 |

## 安装

### npm 安装（推荐）

```bash
npm install -g chrome-devtools-mcp-game
```

### 源码安装

```bash
git clone https://github.com/706412584/chrome-devtools-mcp.git
cd chrome-devtools-mcp
npm install
npm run bundle
```

### MCP 客户端配置

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp-game@latest"]
    }
  }
}
```

### 持久化浏览器会话（推荐）

使用 `--userDataDir` 保持登录状态，避免每次重启都重新扫码：

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp-game@latest",
        "--userDataDir=~/.cache/chrome-devtools-mcp/chrome-profile",
        "--experimentalVision"
      ]
    }
  }
}
```

## 使用示例

### FPS 监控

```
打开 https://example.com/game，启动 FPS 监控，等待 5 秒后获取统计数据
```

### 像素级截图对比

```
对当前页面截图，与 test-baselines/main-menu.png 对比，容差设为 30
```

### 资源加载分析

```
启动资源监控，刷新页面，然后获取资源加载统计
```

### 游戏自动化测试

```
运行 game_test，步骤：
1. 导航到游戏页面
2. 等待 canvas 出现
3. 截图与 baseline 对比
4. 断言无错误元素
```

### 跨域 iframe 点击

```
点击 iframe 中的按钮（uid: xxx）
— 如果 Playwright 点击失败，自动 fallback 到 CDP 鼠标事件
```

### 浏览器实例发现

```
列出所有正在运行的 Chrome 实例
```

## 工具详细说明

### game_stats

注入 requestAnimationFrame 采样脚本，返回：
- FPS 统计（当前/最小/最大/百分位）
- 帧时间分布（p50/p90/p99）
- JS 堆内存使用量

参数：`durationMs`（采样时长，默认 3000ms）

### screenshot_diff

像素级截图对比，支持：
- 欧几里得距离（RGB 空间）+ 可配置容差
- BFS 连通分量分析差异区域
- 差异严重度分级（low/medium/high）
- 可选输出差异可视化图片

参数：`baseline`（基线截图路径）、`tolerance`（像素容差，默认 30）、`outputDiffImage`（输出差异图）

### asset_monitor

三重拦截机制：
1. **fetch 拦截**：覆盖 `window.fetch`，记录 URL、状态、耗时、大小
2. **XHR 拦截**：覆盖 `XMLHttpRequest.open/send`，同上
3. **PerformanceObserver**：监听 resource 类型条目，过滤游戏相关扩展名（png/jpg/wasm/lua/glTF 等）

查询支持：按 URL 过滤、时间范围、最大条目数。返回按扩展名分组的汇总 + 最近条目。

### canvas_info

读取页面所有 `<canvas>` 元素：
- 尺寸（width/height/clientWidth/clientHeight）
- WebGL 版本（webgl2/webgl/experimental-webgl）
- GPU 渲染器（通过 WEBGL_debug_renderer_info 扩展）
- 最大纹理尺寸、抗锯齿、alpha 通道状态
- Canvas2D 平滑设置

### game_test

多步骤自动化测试框架，支持的步骤类型：

| 步骤 | 说明 |
|------|------|
| `navigate` | 导航到 URL |
| `wait` | 等待指定毫秒 |
| `wait_for` | 等待文本出现 |
| `wait_for_canvas` | 等待 canvas 元素出现 |
| `click` | 点击坐标 (x, y) |
| `screenshot` | 截图 + 可选基线对比 |
| `eval` | 执行自定义 JS |
| `assert_text` | 断言文本存在/不存在 |
| `assert_no_errors` | 断言无错误元素 |

遇到失败立即停止，报告 pass/fail/skipped 统计。

### websocket_monitor

通过 CDP `Network.webSocketFrameSent/Received` 事件监控 WebSocket 通信：
- 记录消息方向（sent/received）、时间戳、数据预览
- 支持按类型过滤查询
- 适合调试游戏网络同步、多人联机协议

### browser_discover

扫描已运行的 Chrome 实例：
- 检查常见调试端口（9222-9229）
- 读取 DevToolsActivePort 文件
- 扫描系统 Chrome 配置目录
- 返回可直接复用的 WebSocket 地址

## 完整工具列表

本分支在原版基础上新增的工具（共 19 个）：

**Input 增强**
- `mouse_move` — 鼠标移动
- `keyboard_sequence` — 批量键盘输入

**Game 监控**
- `game_stats` — FPS/帧时间/内存统计
- `inject_game_overlay` — HUD 叠加层
- `game_state` — 游戏状态检查
- `game_test` — 自动化测试框架

**Console 增强**
- `console_intercept_start` — 开始拦截控制台
- `console_intercept_stop` — 停止拦截
- `console_search` — 搜索日志
- `console_stats` — 日志统计

**Screenshot 增强**
- `screenshot_diff` — 像素级截图对比

**Network 增强**
- `asset_monitor_start` — 开始资源监控
- `asset_monitor_get` — 查询资源数据
- `websocket_monitor_start` — 开始 WebSocket 监控
- `websocket_monitor_get` — 查询 WebSocket 数据
- `websocket_monitor_stop` — 停止 WebSocket 监控

**Browser 管理**
- `browser_discover` — 发现已运行的 Chrome
- `browser_connect` — 生成复用配置

**Canvas/渲染**
- `canvas_info` — Canvas/WebGL 上下文信息

原版工具（约 50 个）全部保留，详见 [Tool Reference](./docs/tool-reference.md)。

## 配置选项

除原版所有配置外，新增：

| 选项 | 说明 |
|------|------|
| `--userDataDir` | 持久化浏览器配置目录（推荐设置，保持登录状态） |
| `--experimentalVision` | 启用坐标点击工具（click_at） |

## 构建与发布

```bash
# 本地构建
npm install && npm run bundle

# 运行测试
npm test

# 发布到 npm（需要 NPM_TOKEN）
# 在 GitHub 仓库 Settings > Secrets 中配置 NPM_TOKEN
# 推送到 main 分支自动触发发布
git push fork main
```

## Credits

本项目基于 [ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp) (Apache-2.0 License) 开发。

原版作者：Google LLC

## License

Apache-2.0（继承上游）

# B站禁用RichPip画中画
* 将 [npd.732.54d3d1ea.js](https://s1.hdslb.com/bfs/static/player/main/widgets/npd.732.54d3d1ea.js) 替换为内联脚本，并将
  ```js
  e.prototype.isRichPipSupported=function(){return this.expStore.newPipEnabled&&y.a.supported()}
  ```
  方法改为固定返回 `false`，从而禁用新版画中画
* 匹配所有 `https://www.bilibili.com/video/BV*` 视频页面
* 作者：DeepSeek

## 安装
[GreasyFork]()

## 源码
[GitHub](https://github.com/Xyc1596/bilibili-no-richpip)

## 更新日志
### 2026/06/27
初始版本

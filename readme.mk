# Python 字符串格式化网页

这是一个纯静态的网页工具，使用 Pyodide + Black 在浏览器内格式化 Python 风格的字符串。可直接部署到 EdgeOne 或任何静态托管环境。

## 使用方法
1. 打开 `index.html`（直接双击或通过静态服务器访问）。
2. 在左侧输入框黏贴 Python 风格的列表 / 字典 / 调用表达式字符串。
3. 点击 **格式化**，右侧会输出缩进后的结果；点击 **复制结果** 可快速复制。
   - 优先使用 Black；若输入不是可直接解析的 Python 代码，工具会自动回退到 `ast.literal_eval + pprint`
     或 `json.loads + json.dumps` 以尽量给出可读缩进。

> 第一次加载会通过 CDN 下载 Pyodide，并用 `micropip` 在线安装 Black（需联网）。

## 部署
将本仓库内容上传到 EdgeOne 的静态资源存储，入口文件为 `index.html`。无需后端服务。

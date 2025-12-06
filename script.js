const inputEl = document.getElementById('input');
const outputEl = document.getElementById('output');
const formatBtn = document.getElementById('format-btn');
const copyBtn = document.getElementById('copy-btn');
const statusEl = document.getElementById('status');

const sample = `[{"role": "user", "content": "What are the ages of my kids?"}, {"role": "assistant", "content": [TextBlock(citations=None, text="I'll first get the list of all your kids' names, and then retrieve their ages.", type='text'), ToolUseBlock(id='toolu_019pF9d4trGcwPQgHTYoLQ2v', input={}, name='get_all_kids', type='tool_use')]}, {"role": "user", "content": [{"type": "tool_result", "tool_use_id": "toolu_019pF9d4trGcwPQgHTYoLQ2v", "content": "[\"Alice\", \"Bob\", \"Charlie\"]", "is_error": False}]},\n{'role': 'assistant', 'content': [TextBlock(citations=None, text='Now let me get the ages for each of them:', type='text'), ToolUseBlock(id='toolu_017CnAksMgKYEpKoHuWRY3PG', input={'name': 'Alice'}, name='get_kids_age', type='tool_use'), ToolUseBlock(id='toolu_01GmT6KsxWsJods9ipXuYsF5', input={'name': 'Bob'}, name='get_kids_age', type='tool_use'), ToolUseBlock(id='toolu_01QPVCeAbVUktG55MWP4Te2a', input={'name': 'Charlie'}, name='get_kids_age', type='tool_use')]}, {"role": "user", "content": [{"type": "tool_result", "tool_use_id": "toolu_017CnAksMgKYEpKoHuWRY3PG", "content": "7", "is_error": False}, {"type": "tool_result", "tool_use_id": "toolu_01GmT6KsxWsJods9ipXuYsF5", "content": "9", "is_error": False}, {"type": "tool_result", "tool_use_id": "toolu_01QPVCeAbVUktG55MWP4Te2a", "content": "6", "is_error": False}]}]`;

inputEl.value = sample;

let pyodideReady = null;

async function initPyodide() {
  try {
    const pyodide = await loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/'
    });

    await pyodide.loadPackage('micropip');
    await pyodide.runPythonAsync("import micropip; await micropip.install('black==24.4.2')");

    statusEl.textContent = '格式化器已就绪';
    statusEl.classList.remove('error');
    formatBtn.disabled = false;
    copyBtn.disabled = false;
    return pyodide;
  } catch (error) {
    statusEl.textContent = '加载失败，请检查网络重试';
    statusEl.classList.add('error');
    console.error(error);
    throw error;
  }
}

pyodideReady = initPyodide();

async function formatInput() {
  const code = inputEl.value;
  if (!code.trim()) {
    outputEl.textContent = '';
    copyBtn.disabled = true;
    return;
  }

  formatBtn.disabled = true;
  statusEl.textContent = '格式化中...';
  statusEl.classList.remove('error');

  try {
    const pyodide = await pyodideReady;
    const formattedJson = await pyodide.runPythonAsync(`
import ast, black, json, pprint, textwrap

raw_input = textwrap.dedent(${JSON.stringify(code)})

def format_payload(value: str):
    """尝试 Black，失败则回退到 ast/json + pprint。"""

    # 首选 Black（适合合法的 Python 代码 / 表达式字符串）
    try:
        return json.dumps({
            "formatted": black.format_str(value, mode=black.Mode()),
            "method": "black",
        }, ensure_ascii=False)
    except Exception as black_error:
        last_error = repr(black_error)

    # 回退 1：ast.literal_eval -> pprint（适合 Python 风格的字面量）
    try:
        parsed = ast.literal_eval(value)
        pretty = pprint.pformat(parsed, width=88, compact=False, sort_dicts=False)
        return json.dumps({"formatted": pretty, "method": "ast"}, ensure_ascii=False)
    except Exception as ast_error:
        last_error = repr(ast_error)

    # 回退 2：json.loads -> json.dumps（适合标准 JSON）
    try:
        parsed = json.loads(value)
        pretty = json.dumps(parsed, indent=2, ensure_ascii=False)
        return json.dumps({"formatted": pretty, "method": "json"}, ensure_ascii=False)
    except Exception:
        pass

    # 全部失败则抛出 Black 的原始异常，保持一致的错误提示
    raise RuntimeError(last_error)


format_payload(raw_input)
`);

    const { formatted, method } = JSON.parse(formattedJson);
    outputEl.textContent = formatted;
    copyBtn.disabled = !formatted;

    const methodLabel =
      method === 'black'
        ? 'Black'
        : method === 'ast'
        ? 'AST + pprint'
        : 'JSON + indent';

    statusEl.textContent = `格式化完成（${methodLabel}）`;
    statusEl.classList.remove('error');
  } catch (error) {
    statusEl.textContent = '格式化失败：' + (error.message || error);
    statusEl.classList.add('error');
    outputEl.textContent = '';
    copyBtn.disabled = true;
    console.error(error);
  } finally {
    formatBtn.disabled = false;
  }
}

async function copyOutput() {
  const text = outputEl.textContent;
  if (!text) return;
  await navigator.clipboard.writeText(text);
  statusEl.textContent = '已复制到剪贴板';
  statusEl.classList.remove('error');
}

formatBtn.addEventListener('click', formatInput);
copyBtn.addEventListener('click', copyOutput);

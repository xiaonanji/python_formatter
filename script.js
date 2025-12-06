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
    return;
  }

  formatBtn.disabled = true;
  statusEl.textContent = '格式化中...';
  statusEl.classList.remove('error');

  try {
    const pyodide = await pyodideReady;
    const formatted = await pyodide.runPythonAsync(`
import black, textwrap
source = textwrap.dedent(${JSON.stringify(code)})
black.format_str(source, mode=black.Mode())
`);
    outputEl.textContent = formatted;
    statusEl.textContent = '格式化完成';
    statusEl.classList.remove('error');
  } catch (error) {
    statusEl.textContent = '格式化失败：' + (error.message || error);
    statusEl.classList.add('error');
    outputEl.textContent = '';
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

const inputEl = document.getElementById('input');
const outputEl = document.getElementById('output');
const formatBtn = document.getElementById('format-btn');
const copyBtn = document.getElementById('copy-btn');
const statusEl = document.getElementById('status');

const inputLineNumbers = document.getElementById('input-line-numbers');

const sample = `[{'role': 'user', 'content': 'What are the ages of my kids?'}, {'role': 'assistant', 'content': [TextBlock(citations=None, text="I'll first get the list of all your kids' names, and then retrieve their ages.", type='text'), ToolUseBlock(id='toolu_019pF9d4trGcwPQgHTYoLQ2v', input={}, name='get_all_kids', type='tool_use')]}, {'role': 'user', 'content': [{'type': 'tool_result', 'tool_use_id': 'toolu_019pF9d4trGcwPQgHTYoLQ2v', 'content': '["Alice", "Bob", "Charlie"]', 'is_error': False}]},\n{'role': 'assistant', 'content': [TextBlock(citations=None, text='Now let me get the ages for each of them:', type='text'), ToolUseBlock(id='toolu_017CnAksMgKYEpKoHuWRY3PG', input={'name': 'Alice'}, name='get_kids_age', type='tool_use'), ToolUseBlock(id='toolu_01GmT6KsxWsJods9ipXuYsF5', input={'name': 'Bob'}, name='get_kids_age', type='tool_use'), ToolUseBlock(id='toolu_01QPVCeAbVUktG55MWP4Te2a', input={'name': 'Charlie'}, name='get_kids_age', type='tool_use')]}, {'role': 'user', 'content': [{'type': 'tool_result', 'tool_use_id': 'toolu_017CnAksMgKYEpKoHuWRY3PG', 'content': '7', 'is_error': False}, {'type': 'tool_result', 'tool_use_id': 'toolu_01GmT6KsxWsJods9ipXuYsF5', 'content': '9', 'is_error': False}, {'type': 'tool_result', 'tool_use_id': 'toolu_01QPVCeAbVUktG55MWP4Te2a', 'content': '6', 'is_error': False}]}]`;

inputEl.value = sample;
updateInputLineNumbers();

let pyodideReady = null;
let currentLines = [];
let lineIndents = [];

function updateInputLineNumbers() {
  const lines = inputEl.value.split('\n').length;
  inputLineNumbers.innerHTML = Array(lines).fill(0).map((_, i) => `<div>${i + 1}</div>`).join('');
}

inputEl.addEventListener('input', updateInputLineNumbers);
inputEl.addEventListener('scroll', () => {
  inputLineNumbers.scrollTop = inputEl.scrollTop;
});

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderOutput(formatted) {
  clearHighlight();
  currentLines = formatted.replace(/\r\n/g, '\n').split('\n').filter(line => line.trim() !== '');
  lineIndents = currentLines.map((line) =>
    line.match(/^ */)[0].length
  );
  const html = currentLines
    .map(
      (line, idx) =>
        `<span class="code-line" data-line-index="${idx}">${escapeHtml(line)}</span>`
    )
    .join('\n');
  outputEl.innerHTML = html;
}

function clearHighlight() {
  outputEl.querySelectorAll('.code-line.highlight').forEach((el) => {
    el.classList.remove('highlight');
  });
}

function findBlock(index) {
  if (!currentLines.length || index < 0 || index >= currentLines.length) {
    return { start: index, end: index };
  }
  const line = currentLines[index];
  const indent = lineIndents[index];
  if (line.trim() === '') {
    return { start: index, end: index };
  }

  const isOpener = /[{\[\(]$/.test(line.trim());
  const isCloser = /^[}\]\)]/.test(line.trim());

  let start = index;
  for (let i = index - 1; i >= 0; i -= 1) {
    const prevLine = currentLines[i];
    const prevIndent = lineIndents[i];

    if (prevLine.trim() === '') continue;

    if (prevIndent < indent) {
      break;
    }
    if (prevIndent === indent) {
      if (isCloser) {
        // If we are at a closer, we look for the opener.
        // If the previous line is also a closer, it's a sibling.
        if (/^[}\]\)]/.test(prevLine.trim())) {
          break;
        }
        // Otherwise assume it's the opener.
        start = i;
        break;
      } else {
        // Not a closer, so this is a sibling.
        break;
      }
    }
    start = i;
  }

  let end = index;
  for (let i = index + 1; i < currentLines.length; i += 1) {
    const nextLine = currentLines[i];
    const nextIndent = lineIndents[i];

    if (nextLine.trim() === '') continue;

    if (nextIndent < indent) {
      break;
    }
    if (nextIndent === indent) {
      if (isOpener) {
        // If we are at an opener, we look for the closer.
        if (/^[}\]\)]/.test(nextLine.trim())) {
          end = i;
          break;
        } else {
          // Sibling.
          break;
        }
      } else {
        // Not an opener, so this is a sibling.
        break;
      }
    }
    end = i;
  }

  return { start, end };
}

function highlightBlock(start, end) {
  clearHighlight();
  for (let i = start; i <= end; i += 1) {
    const node = outputEl.querySelector(`.code-line[data-line-index="${i}"]`);
    if (node) node.classList.add('highlight');
  }
}

async function initPyodide() {
  try {
    const pyodide = await loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/'
    });

    await pyodide.loadPackage('micropip');
    await pyodide.runPythonAsync("import micropip; await micropip.install('black==24.4.2')");

    statusEl.textContent = 'Formatter ready';
    statusEl.classList.remove('error');
    formatBtn.disabled = false;
    copyBtn.disabled = false;
    return pyodide;
  } catch (error) {
    statusEl.textContent = 'Failed to load Pyodide, please refresh the page';
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
    currentLines = [];
    lineIndents = [];
    clearHighlight();
    return;
  }

  formatBtn.disabled = true;
  statusEl.textContent = 'Formatting...';
  statusEl.classList.remove('error');

  try {
    const pyodide = await pyodideReady;
    const formatted = await pyodide.runPythonAsync(`
import black, textwrap
source = textwrap.dedent(${JSON.stringify(code)})
black.format_str(source, mode=black.Mode())
`);
    renderOutput(formatted);
    statusEl.textContent = 'Formatting complete';
    statusEl.classList.remove('error');
  } catch (error) {
    statusEl.textContent = 'Formatting error: ' + (error.message || error);
    statusEl.classList.add('error');
    outputEl.textContent = '';
    currentLines = [];
    lineIndents = [];
    clearHighlight();
    console.error(error);
  } finally {
    formatBtn.disabled = false;
  }
}

async function copyOutput() {
  const text = outputEl.textContent;
  if (!text) return;
  await navigator.clipboard.writeText(text);
  statusEl.textContent = 'Copied to clipboard';
  statusEl.classList.remove('error');
}

formatBtn.addEventListener('click', formatInput);
copyBtn.addEventListener('click', copyOutput);

outputEl.addEventListener('click', (event) => {
  const selection = window.getSelection();
  if (selection.toString().length > 0) return;

  const lineEl = event.target.closest('.code-line');
  if (!lineEl) return;

  if (lineEl.classList.contains('highlight')) {
    clearHighlight();
    return;
  }

  const index = Number(lineEl.dataset.lineIndex);
  if (Number.isNaN(index)) return;
  const { start, end } = findBlock(index);
  highlightBlock(start, end);
});

document.addEventListener('click', (event) => {
  if (!outputEl.contains(event.target)) {
    clearHighlight();
    clearTextHighlights();
  }
});

outputEl.addEventListener('mouseup', () => {
  const selection = window.getSelection();
  const text = selection.toString();
  if (text.trim().length > 0) {
    highlightTextMatches(text);
  } else {
    clearTextHighlights();
  }
});

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightTextMatches(text) {
  const regex = new RegExp(escapeRegExp(text), 'g');
  currentLines.forEach((line, idx) => {
    const lineEl = outputEl.querySelector(`.code-line[data-line-index="${idx}"]`);
    if (!lineEl) return;

    // We rebuild the HTML to avoid messing up existing DOM structure if possible,
    // but here we just replace content.
    // Note: This will clear the user's selection on the line they selected.
    // This is a trade-off for highlighting all occurrences.
    const escapedLine = escapeHtml(line);
    const highlightedLine = escapedLine.replace(regex, '<span class="text-highlight">$&</span>');
    lineEl.innerHTML = highlightedLine;
  });
}

// ... existing code ...

// Resize Logic
const resizer = document.getElementById('drag-handle');
const leftPanel = document.getElementById('left-panel');
const rightPanel = document.getElementById('right-panel');
const workbench = document.querySelector('.workbench');

let isResizing = false;

resizer.addEventListener('mousedown', (e) => {
  isResizing = true;
  resizer.classList.add('dragging');
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none'; // Prevent text selection while dragging
});

document.addEventListener('mousemove', (e) => {
  if (!isResizing) return;

  const containerRect = workbench.getBoundingClientRect();
  const pointerX = e.clientX - containerRect.left;

  // Calculate percentage or pixel width
  // Using percentage is often better for responsiveness, but pixels give finer control
  // Let's use pixels for the left panel and flex:1 for right

  const minWidth = 200;
  const maxWidth = containerRect.width - minWidth;

  let newLeftWidth = pointerX;

  if (newLeftWidth < minWidth) newLeftWidth = minWidth;
  if (newLeftWidth > maxWidth) newLeftWidth = maxWidth;

  // Set flex-basis or width
  // We need to remove flex: 1 from left panel to respect width
  leftPanel.style.flex = `0 0 ${newLeftWidth}px`;
  // Right panel stays flex: 1 so it takes remaining space
});

document.addEventListener('mouseup', () => {
  if (isResizing) {
    isResizing = false;
    resizer.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }
});

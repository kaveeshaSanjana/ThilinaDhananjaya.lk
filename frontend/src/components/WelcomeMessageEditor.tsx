import { useState, useRef, useCallback } from 'react';

// Dynamic variable tokens that can be dragged into the editor
const VARIABLE_TOKENS = [
  { key: '{{studentName}}', label: 'Student Name', icon: '👤', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: '{{month}}', label: 'Month', icon: '📅', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { key: '{{date}}', label: 'Date', icon: '🗓️', color: 'bg-green-100 text-green-700 border-green-200' },
  { key: '{{className}}', label: 'Class Name', icon: '📚', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { key: '{{recordingTitle}}', label: 'Recording Title', icon: '🎬', color: 'bg-red-100 text-red-700 border-red-200' },
  { key: '{{teacherName}}', label: 'Teacher Name', icon: '👨‍🏫', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
];

interface WelcomeMessageEditorProps {
  value: string;
  onChange: (html: string) => void;
}

export default function WelcomeMessageEditor({ value, onChange }: WelcomeMessageEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const saveContent = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const execCmd = useCallback((cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    saveContent();
  }, [saveContent]);

  const handleDragStart = useCallback((e: React.DragEvent, token: string) => {
    e.dataTransfer.setData('text/plain', token);
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const token = e.dataTransfer.getData('text/plain');
    if (!token) return;

    // Insert the token as a styled span at the drop position
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      // Try to place caret at drop point
      const range = document.caretRangeFromPoint?.(e.clientX, e.clientY);
      if (range) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }

    const tokenInfo = VARIABLE_TOKENS.find(t => t.key === token);
    const label = tokenInfo ? `${tokenInfo.icon} ${tokenInfo.label}` : token;
    const colorClass = tokenInfo?.color || 'bg-slate-100 text-slate-700 border-slate-200';

    // Insert as a non-editable badge
    document.execCommand(
      'insertHTML',
      false,
      `<span contenteditable="false" data-variable="${token}" class="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded-md text-xs font-semibold border ${colorClass}" style="user-select:all;cursor:default">${label}</span>&nbsp;`
    );
    saveContent();
  }, [saveContent]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const insertToken = useCallback((token: typeof VARIABLE_TOKENS[0]) => {
    editorRef.current?.focus();
    document.execCommand(
      'insertHTML',
      false,
      `<span contenteditable="false" data-variable="${token.key}" class="inline-flex items-center gap-0.5 px-1.5 py-0.5 mx-0.5 rounded-md text-xs font-semibold border ${token.color}" style="user-select:all;cursor:default">${token.icon} ${token.label}</span>&nbsp;`
    );
    saveContent();
  }, [saveContent]);

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-slate-600 mb-1">
        Welcome Message
        <span className="text-slate-400 font-normal ml-1">(shown to students before watching)</span>
      </label>

      {/* Variable tokens - draggable */}
      <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider w-full mb-1">
          Drag & drop or click to insert variables
        </span>
        {VARIABLE_TOKENS.map(token => (
          <button
            key={token.key}
            type="button"
            draggable
            onDragStart={e => handleDragStart(e, token.key)}
            onClick={() => insertToken(token)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border cursor-grab active:cursor-grabbing hover:shadow-sm transition ${token.color}`}
          >
            <span>{token.icon}</span>
            <span>{token.label}</span>
          </button>
        ))}
      </div>

      {/* Formatting toolbar */}
      <div className="flex items-center gap-0.5 p-1.5 bg-white rounded-t-xl border border-b-0 border-slate-200">
        <button type="button" onClick={() => execCmd('bold')} title="Bold"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition font-bold text-sm">
          B
        </button>
        <button type="button" onClick={() => execCmd('italic')} title="Italic"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition italic text-sm">
          I
        </button>
        <button type="button" onClick={() => execCmd('underline')} title="Underline"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition underline text-sm">
          U
        </button>
        <div className="w-px h-5 bg-slate-200 mx-1" />
        <button type="button" onClick={() => execCmd('fontSize', '5')} title="Large text"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition text-base font-bold">
          A
        </button>
        <button type="button" onClick={() => execCmd('fontSize', '2')} title="Small text"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition text-[10px] font-bold">
          A
        </button>
        <div className="w-px h-5 bg-slate-200 mx-1" />
        <button type="button" onClick={() => execCmd('justifyLeft')} title="Align left"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" d="M3 6h18M3 12h12M3 18h16" /></svg>
        </button>
        <button type="button" onClick={() => execCmd('justifyCenter')} title="Align center"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" d="M3 6h18M6 12h12M4 18h16" /></svg>
        </button>
        <div className="w-px h-5 bg-slate-200 mx-1" />
        <button type="button" onClick={() => execCmd('insertUnorderedList')} title="Bullet list"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
        </button>
        <div className="w-px h-5 bg-slate-200 mx-1" />
        <button type="button" onClick={() => {
          const url = prompt('Enter emoji (e.g. 👋 🎉 📚):');
          if (url) execCmd('insertText', url);
        }} title="Insert emoji"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition text-sm">
          😀
        </button>
        <button type="button" onClick={() => {
          if (editorRef.current) { editorRef.current.innerHTML = ''; saveContent(); }
        }} title="Clear all"
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition ml-auto">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>

      {/* Editor area (contentEditable) */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={saveContent}
        onBlur={saveContent}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        dangerouslySetInnerHTML={{ __html: value }}
        className={`min-h-[120px] max-h-[200px] overflow-y-auto px-3 py-2.5 rounded-b-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition ${dragOver ? 'ring-2 ring-blue-400 bg-blue-50/30 border-blue-300' : ''}`}
        style={{ lineHeight: '1.6' }}
      />

      <p className="text-[10px] text-slate-400">
        Variables like <code className="bg-slate-100 px-1 rounded">{'{{studentName}}'}</code> will be replaced with real data when shown to students.
      </p>
    </div>
  );
}

/**
 * Resolve variable placeholders in welcome message HTML.
 * Used on the student-facing side to render personalized messages.
 */
export function resolveWelcomeMessage(html: string, vars: Record<string, string>): string {
  let resolved = html;
  // Replace {{variable}} text inside data-variable spans with actual values
  for (const [key, val] of Object.entries(vars)) {
    // Replace the token spans with just the value text (keeping styling)
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Replace data-variable badge content
    resolved = resolved.replace(
      new RegExp(`(<span[^>]*data-variable="${escaped}"[^>]*>)[^<]*(</span>)`, 'g'),
      `$1${val}$2`
    );
    // Also replace raw text placeholders
    resolved = resolved.replace(new RegExp(escaped, 'g'), val);
  }
  return resolved;
}

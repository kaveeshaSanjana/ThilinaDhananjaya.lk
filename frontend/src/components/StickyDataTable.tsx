import * as React from 'react';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';

export interface StickyColumn<T> {
  id: string;
  label: string;
  minWidth?: number;
  align?: 'left' | 'right' | 'center';
  format?: (value: unknown, row: T) => React.ReactNode;
  render?: (row: T) => React.ReactNode;
  /** If false, this column is hidden by default (user can enable it). Defaults to true. */
  defaultVisible?: boolean;
}

interface StickyDataTableProps<T> {
  columns: readonly StickyColumn<T>[];
  rows: readonly T[];
  getRowId: (row: T) => string;
  rowsPerPageOptions?: number[];
  initialRowsPerPage?: number;
  tableHeight?: number | string;
  emptyMessage?: string;
  /** If provided, column visibility is saved to localStorage under this key. */
  storageKey?: string;
}

const MIN_COL_WIDTH = 60;

export default function StickyDataTable<T>({
  columns,
  rows,
  getRowId,
  rowsPerPageOptions = [10, 25, 50, 100],
  initialRowsPerPage = 10,
  tableHeight = 'calc(100vh - 320px)',
  emptyMessage = 'No data found',
  storageKey,
}: StickyDataTableProps<T>) {
  const [isDark, setIsDark] = React.useState(() => document.documentElement.classList.contains('dark'));
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(initialRowsPerPage);

  // Column visibility — initialised from localStorage (if storageKey given) or defaultVisible flags
  const getDefaultVisibleIds = React.useCallback(() => {
    if (storageKey) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed: string[] = JSON.parse(saved);
          // Only keep ids that still exist in columns
          const valid = parsed.filter(id => columns.some(c => c.id === id));
          if (valid.length > 0) return new Set(valid);
        }
      } catch { /* ignore */ }
    }
    return new Set(columns.filter(c => c.defaultVisible !== false).map(c => c.id));
  }, [columns, storageKey]);

  const [visibleIds, setVisibleIds] = React.useState<Set<string>>(getDefaultVisibleIds);
  // Draft state — changes only applied to visibleIds when user clicks Save
  const [draftIds, setDraftIds] = React.useState<Set<string>>(getDefaultVisibleIds);
  const [colMenuOpen, setColMenuOpen] = React.useState(false);
  const colMenuRef = React.useRef<HTMLDivElement>(null);

  // Save to localStorage whenever visibility changes
  React.useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify([...visibleIds]));
    }
  }, [visibleIds, storageKey]);

  // Close menu on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) {
        setColMenuOpen(false);
        // Discard unsaved draft when closing without saving
        setDraftIds(new Set(visibleIds));
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [visibleIds]);

  const visibleColumns = React.useMemo(() => columns.filter(c => visibleIds.has(c.id)), [columns, visibleIds]);

  const toggleDraft = (id: string) => {
    setDraftIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size <= 1) return prev;
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const saveColumns = () => {
    setVisibleIds(new Set(draftIds));
    setColMenuOpen(false);
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify([...draftIds]));
    }
  };

  const resetColumns = () => {
    const defaults = new Set(columns.filter(c => c.defaultVisible !== false).map(c => c.id));
    setDraftIds(defaults);
  };

  // Keep draft in sync when opening menu
  const openMenu = () => {
    setDraftIds(new Set(visibleIds));
    setColMenuOpen(true);
  };

  // Column widths — initialised from minWidth or a sensible default
  const [colWidths, setColWidths] = React.useState<number[]>(() =>
    columns.map(c => c.minWidth ?? 140),
  );

  // Keep widths in sync if columns prop changes
  React.useEffect(() => {
    setColWidths(columns.map(c => c.minWidth ?? 140));
  }, [columns.length]);

  // Resize drag state  
  const resizingRef = React.useRef<{ colIdx: number; startX: number; startWidth: number } | null>(null);

  const onResizeMouseDown = (e: React.MouseEvent, colIdx: number) => {
    e.preventDefault();
    resizingRef.current = { colIdx, startX: e.clientX, startWidth: colWidths[colIdx] };

    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = ev.clientX - resizingRef.current.startX;
      const newWidth = Math.max(MIN_COL_WIDTH, resizingRef.current.startWidth + delta);
      setColWidths(prev => prev.map((w, i) => (i === resizingRef.current!.colIdx ? newWidth : w)));
    };

    const onMouseUp = () => {
      resizingRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  React.useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsDark(root.classList.contains('dark'));
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(rows.length / rowsPerPage) - 1);
    if (page > maxPage) setPage(maxPage);
  }, [rows.length, rowsPerPage, page]);

  const pagedRows = React.useMemo(
    () => rows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [rows, page, rowsPerPage],
  );

  const tableMinWidth = visibleColumns.reduce((sum, c) => {
    const idx = columns.findIndex(x => x.id === c.id);
    return sum + (colWidths[idx] ?? c.minWidth ?? 140);
  }, 0);

  const handleChangePage = (_event: unknown, newPage: number) => setPage(newPage);
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(Number(event.target.value));
    setPage(0);
  };

  return (
    <Paper
      sx={{
        width: '100%',
        overflow: 'hidden',
        borderRadius: 2,
        boxShadow: 'none',
        backgroundColor: isDark ? '#0f172a' : '#ffffff',
        color: isDark ? '#f8fafc' : 'inherit',
      }}
    >
      {/* Column visibility toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 12px 0', position: 'relative' }} ref={colMenuRef}>
        <button
          onClick={() => colMenuOpen ? setColMenuOpen(false) : openMenu()}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 8, border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            background: isDark ? '#1e293b' : '#f8fafc', color: isDark ? '#94a3b8' : '#64748b',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Columns ({visibleIds.size}/{columns.length})
        </button>
        {colMenuOpen && (
          <div style={{
            position: 'absolute', top: '100%', right: 12, zIndex: 50, minWidth: 210, marginTop: 4,
            background: isDark ? '#1e293b' : '#ffffff', border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
            borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px 6px', borderBottom: `1px solid ${isDark ? '#334155' : '#f1f5f9'}` }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Show / Hide Columns</span>
              <button
                onClick={resetColumns}
                style={{ fontSize: 11, fontWeight: 600, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}
              >
                Reset
              </button>
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {/* Default columns */}
              {columns.some(c => c.defaultVisible !== false) && (
                <div style={{ padding: '6px 14px 2px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Default</div>
              )}
              {columns.filter(c => c.defaultVisible !== false).map(col => (
                <label key={col.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 14px', cursor: 'pointer', background: 'transparent', transition: 'background 0.15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = isDark ? '#0f172a' : '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <input type="checkbox" checked={draftIds.has(col.id)} onChange={() => toggleDraft(col.id)}
                    style={{ width: 14, height: 14, accentColor: '#3b82f6', cursor: 'pointer' }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: isDark ? '#f1f5f9' : '#334155' }}>{col.label}</span>
                </label>
              ))}
              {/* Optional columns */}
              {columns.some(c => c.defaultVisible === false) && (
                <div style={{ padding: '8px 14px 2px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', borderTop: `1px solid ${isDark ? '#334155' : '#f1f5f9'}`, marginTop: 2 }}>Optional</div>
              )}
              {columns.filter(c => c.defaultVisible === false).map(col => (
                <label key={col.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 14px', cursor: 'pointer', background: 'transparent', transition: 'background 0.15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = isDark ? '#0f172a' : '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <input type="checkbox" checked={draftIds.has(col.id)} onChange={() => toggleDraft(col.id)}
                    style={{ width: 14, height: 14, accentColor: '#3b82f6', cursor: 'pointer' }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: isDark ? '#f1f5f9' : '#334155' }}>{col.label}</span>
                </label>
              ))}
            </div>
            {/* Save / Cancel footer */}
            <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: `1px solid ${isDark ? '#334155' : '#f1f5f9'}` }}>
              <button
                onClick={() => { setColMenuOpen(false); setDraftIds(new Set(visibleIds)); }}
                style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`, background: 'transparent', color: isDark ? '#94a3b8' : '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={saveColumns}
                style={{ flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', background: '#3b82f6', color: '#ffffff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
      <TableContainer
        sx={{
          height: tableHeight,
          backgroundColor: isDark ? '#0f172a' : '#ffffff',
          overflowX: 'auto',
        }}
      >
        <Table stickyHeader aria-label="sticky table" size="medium" sx={{ minWidth: tableMinWidth, tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              {visibleColumns.map((column) => {
                const colIdx = columns.findIndex(c => c.id === column.id);
                return (
                <TableCell
                  key={column.id}
                  align={column.align}
                  style={{ width: colWidths[colIdx], position: 'relative', overflow: 'hidden' }}
                  sx={{
                    backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                    color: isDark ? '#f8fafc' : 'inherit',
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                    fontWeight: 700,
                    fontSize: { xs: '0.82rem', sm: '0.9rem', md: '0.95rem' },
                    py: { xs: 1.5, sm: 1.8, md: 2 },
                    userSelect: 'none',
                  }}
                >
                  <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>
                    {column.label}
                  </span>
                  {/* Resize handle */}
                  <span
                    onMouseDown={e => onResizeMouseDown(e, colIdx)}
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: 6,
                      cursor: 'col-resize',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 1,
                    }}
                  >
                    <span style={{
                      display: 'block',
                      width: 2,
                      height: '60%',
                      borderRadius: 2,
                      backgroundColor: isDark ? '#475569' : '#cbd5e1',
                    }} />
                  </span>
                </TableCell>
                );
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {pagedRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length}
                  align="center"
                  sx={{
                    py: 6,
                    color: isDark ? '#f8fafc' : 'text.secondary',
                    borderColor: isDark ? '#334155' : '#e2e8f0',
                  }}
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              pagedRows.map((row) => (
                <TableRow
                  hover
                  role="checkbox"
                  tabIndex={-1}
                  key={getRowId(row)}
                  sx={{
                    backgroundColor: isDark ? '#0f172a' : 'inherit',
                    '& td': { py: { xs: 1.6, sm: 1.8, md: 2 } },
                    '&:hover': {
                      backgroundColor: isDark ? '#1e293b' : '#eff6ff',
                    },
                    '&.MuiTableRow-hover:hover': {
                      backgroundColor: isDark ? '#1e293b' : '#eff6ff',
                    },
                  }}
                >
                  {visibleColumns.map((column) => {
                    const colIdx = columns.findIndex(c => c.id === column.id);
                    const value = (row as Record<string, unknown>)[column.id];
                    return (
                      <TableCell
                        key={column.id}
                        align={column.align}
                        style={{ width: colWidths[colIdx], overflow: 'hidden' }}
                        sx={{
                          color: isDark ? '#f8fafc' : 'inherit',
                          borderColor: isDark ? '#334155' : '#e2e8f0',
                          fontSize: { xs: '0.82rem', sm: '0.9rem', md: '0.95rem' },
                        }}
                      >
                        {column.render
                          ? column.render(row)
                          : column.format
                            ? column.format(value, row)
                            : (value as React.ReactNode)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={rowsPerPageOptions}
        component="div"
        count={rows.length}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        sx={{
          backgroundColor: isDark ? '#0f172a' : '#ffffff',
          color: isDark ? '#f8fafc' : 'inherit',
          borderTop: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
          '.MuiTablePagination-toolbar': {
            minHeight: { xs: 56, sm: 64 },
            fontSize: { xs: '0.82rem', sm: '0.9rem', md: '0.95rem' },
            px: { xs: 1, sm: 2 },
            gap: { xs: 0.5, sm: 1 },
            flexWrap: { xs: 'wrap', sm: 'nowrap' },
          },
          '.MuiTablePagination-selectLabel': { fontSize: { xs: '0.8rem', sm: '0.9rem' }, fontWeight: 600 },
          '.MuiTablePagination-selectIcon': { color: isDark ? '#f8fafc' : 'inherit' },
          '.MuiSvgIcon-root': { color: isDark ? '#f8fafc' : 'inherit' },
          '.MuiSelect-select': {
            color: isDark ? '#f8fafc' : 'inherit',
            fontSize: { xs: '0.82rem', sm: '0.9rem', md: '0.95rem' },
            fontWeight: 600,
          },
          '.MuiTablePagination-displayedRows': {
            color: isDark ? '#f8fafc' : 'inherit',
            fontSize: { xs: '0.8rem', sm: '0.9rem', md: '0.92rem' },
            fontWeight: 600,
          },
        }}
      />
    </Paper>
  );
}

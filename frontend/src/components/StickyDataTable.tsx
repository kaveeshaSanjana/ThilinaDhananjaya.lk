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
}

interface StickyDataTableProps<T> {
  columns: readonly StickyColumn<T>[];
  rows: readonly T[];
  getRowId: (row: T) => string;
  rowsPerPageOptions?: number[];
  initialRowsPerPage?: number;
  tableHeight?: number | string;
  emptyMessage?: string;
}

export default function StickyDataTable<T>({
  columns,
  rows,
  getRowId,
  rowsPerPageOptions = [10, 25, 50, 100],
  initialRowsPerPage = 10,
  tableHeight = 'calc(100vh - 320px)',
  emptyMessage = 'No data found',
}: StickyDataTableProps<T>) {
  const [isDark, setIsDark] = React.useState(() => document.documentElement.classList.contains('dark'));
  const [page, setPage] = React.useState(0);
  const [rowsPerPage, setRowsPerPage] = React.useState(initialRowsPerPage);

  React.useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsDark(root.classList.contains('dark'));

    // Sync once after mount because theme class is applied in ThemeProvider effect.
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

  const tableMinWidth = React.useMemo(
    () => columns.reduce((sum, col) => sum + (col.minWidth ?? 140), 0),
    [columns],
  );

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

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
      <TableContainer
        sx={{
          height: tableHeight,
          backgroundColor: isDark ? '#0f172a' : '#ffffff',
          overflowX: 'auto',
        }}
      >
        <Table stickyHeader aria-label="sticky table" size="medium" sx={{ minWidth: tableMinWidth }}>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.align}
                  style={{ minWidth: column.minWidth }}
                  sx={{
                    backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                    color: isDark ? '#f8fafc' : 'inherit',
                    borderColor: isDark ? '#334155' : 'inherit',
                    fontWeight: 700,
                    fontSize: { xs: '0.82rem', sm: '0.9rem', md: '0.95rem' },
                    py: { xs: 1.2, sm: 1.4, md: 1.6 },
                  }}
                >
                  {column.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {pagedRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  align="center"
                  sx={{
                    py: 6,
                    color: isDark ? '#f8fafc' : 'text.secondary',
                    borderColor: isDark ? '#334155' : 'inherit',
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
                    '& td': { py: { xs: 1.2, sm: 1.4, md: 1.5 } },
                    '&:hover': {
                      backgroundColor: isDark ? '#1e293b' : 'inherit',
                    },
                  }}
                >
                  {columns.map((column) => {
                    const value = (row as Record<string, unknown>)[column.id];
                    return (
                      <TableCell
                        key={column.id}
                        align={column.align}
                        sx={{
                          color: isDark ? '#f8fafc' : 'inherit',
                          borderColor: isDark ? '#334155' : 'inherit',
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
          borderTop: isDark ? '1px solid #334155' : 'inherit',
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

import re, os

base = r'd:\User\Desktop\ThilinaDhananjaya.lk\frontend\src'
files = [
    'pages/ClassesPage.tsx',
    'pages/ClassDetailPage.tsx',
    'pages/MyPaymentsPage.tsx',
    'pages/PaymentSubmitPage.tsx',
    'pages/RecordingPlayerPage.tsx',
    'pages/admin/AdminDashboard.tsx',
    'pages/admin/AdminStudents.tsx',
    'pages/admin/AdminClasses.tsx',
    'pages/admin/AdminSlips.tsx',
    'pages/admin/AdminAttendance.tsx',
    'pages/admin/AdminRecordingHistory.tsx',
]

def process(c):
    # Skip if already processed
    if 'dark:bg-slate-800' in c and 'dark:text-slate-100' in c:
        return c

    # ==================== PHASE 1: SPECIFIC COMPOUND PATTERNS ====================

    # --- Inputs with placeholder (standard order: border-slate-200 bg-white ...) ---
    c = c.replace(
        'border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none',
        'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none'
    )
    # --- Selects without placeholder (standard order) ---
    c = c.replace(
        'border-slate-200 bg-white text-sm text-slate-800 focus:outline-none',
        'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none'
    )
    # --- AdminStudents search input (bg-white at end) ---
    c = c.replace(
        'border-slate-200 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition shadow-sm bg-white',
        'border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 transition shadow-sm bg-white dark:bg-slate-800'
    )

    # --- Error alerts ---
    c = c.replace(
        'bg-red-50 border border-red-100 text-sm text-red-600',
        'bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-sm text-red-600 dark:text-red-400'
    )
    # --- Success alerts ---
    c = c.replace(
        'bg-emerald-50 border border-emerald-100 text-sm text-emerald-700',
        'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-sm text-emerald-700 dark:text-emerald-400'
    )

    # --- STATUS_MAP badges (amber/emerald/red) ---
    c = c.replace(
        "bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700'",
        "bg: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700', text: 'text-amber-700 dark:text-amber-400'"
    )
    c = c.replace(
        "bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700'",
        "bg: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700', text: 'text-emerald-700 dark:text-emerald-400'"
    )
    c = c.replace(
        "bg: 'bg-red-50 border-red-200', text: 'text-red-700'",
        "bg: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700', text: 'text-red-700 dark:text-red-400'"
    )

    # --- Blue badges ---
    c = c.replace(
        'bg-blue-50 text-blue-600 text-xs font-bold border border-blue-100',
        'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-100 dark:border-blue-800'
    )
    # --- Slate recording count badge ---
    c = c.replace(
        'bg-slate-50 text-slate-500 text-xs font-medium border border-slate-100',
        'bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 text-xs font-medium border border-slate-100 dark:border-slate-600'
    )
    # --- Role badges ---
    c = c.replace(
        "'bg-slate-50 text-slate-500 border-slate-100'",
        "'bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-600'"
    )
    c = c.replace(
        "'bg-purple-50 text-purple-600 border-purple-100'",
        "'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-800'"
    )

    # --- Filter tab inactive button ---
    c = c.replace(
        "'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'",
        "'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600'"
    )
    # --- Month filter inactive ---
    c = c.replace(
        "'bg-slate-100 text-slate-600 hover:bg-slate-200'",
        "'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'"
    )
    # --- Cancel buttons ---
    c = c.replace(
        'border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition',
        'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/50 transition'
    )
    # --- View slip/View buttons ---
    c = c.replace(
        'border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300',
        'border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600'
    )
    # --- Close button in video player ---
    c = c.replace(
        'bg-slate-100 text-xs font-medium text-slate-600 hover:bg-slate-200',
        'bg-slate-100 dark:bg-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
    )

    # --- Upload area drag states (PaymentSubmitPage) ---
    c = c.replace(
        "'border-slate-200 hover:border-blue-300 bg-slate-50 hover:bg-blue-50'",
        "'border-slate-200 dark:border-slate-600 hover:border-blue-300 bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20'"
    )
    c = c.replace(
        "'border-blue-400 bg-blue-50'",
        "'border-blue-400 bg-blue-50 dark:bg-blue-900/30'"
    )
    c = c.replace(
        "'border-emerald-300 bg-emerald-50'",
        "'border-emerald-300 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30'"
    )
    # --- Upload icon bg ---
    c = c.replace(
        'bg-blue-100 flex items-center justify-center',
        'bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center'
    )

    # --- Error state red icon bg ---
    c = c.replace(
        'bg-red-50 flex items-center justify-center',
        'bg-red-50 dark:bg-red-900/30 flex items-center justify-center'
    )

    # --- RecordingPlayerPage: fix text-white on light bg ---
    c = c.replace(
        'text-lg font-semibold text-white mb-2',
        'text-lg font-semibold text-slate-800 dark:text-white mb-2'
    )

    # ==================== PHASE 2: CARD PATTERNS ====================

    # PaymentSubmitPage card (p-6 sm:p-8)
    c = c.replace(
        'bg-white rounded-2xl border border-slate-100 p-6 sm:p-8 shadow-sm',
        'bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 sm:p-8 shadow-sm'
    )
    # Card-hover
    c = c.replace(
        'bg-white rounded-2xl border border-slate-100 overflow-hidden card-hover',
        'bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden card-hover'
    )
    # Card overflow+shadow
    c = c.replace(
        'bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm',
        'bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm'
    )
    # Stat card-hover
    c = c.replace(
        'bg-white rounded-2xl border border-slate-100 p-5 shadow-sm card-hover',
        'bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm card-hover'
    )
    # Quick action card (AdminDashboard)
    c = c.replace(
        'bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5',
        'bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5'
    )
    # Cards with p-XX shadow (regex)
    c = re.sub(
        r'bg-white rounded-2xl border border-slate-100 p-(\d+) shadow-sm',
        r'bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-\1 shadow-sm',
        c
    )
    # Skeleton cards (h-XX)
    c = re.sub(
        r'bg-white rounded-2xl border border-slate-100 h-(\d+)',
        r'bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 h-\1',
        c
    )
    # Generic card shadow-sm
    c = c.replace(
        'bg-white rounded-2xl border border-slate-100 shadow-sm',
        'bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm'
    )

    # ==================== PHASE 3: MODALS ====================

    c = c.replace(
        'bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden',
        'bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden'
    )
    c = c.replace(
        'bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden',
        'bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden'
    )
    c = c.replace(
        'bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto',
        'bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto'
    )
    c = c.replace('sticky top-0 bg-white', 'sticky top-0 bg-white dark:bg-slate-800')
    c = c.replace('p-3 bg-slate-50', 'p-3 bg-slate-50 dark:bg-slate-900')
    c = c.replace('rounded-md bg-slate-100', 'rounded-md bg-slate-100 dark:bg-slate-700')

    # ==================== PHASE 4: DIVIDERS AND BORDERS ====================

    c = c.replace('divide-y divide-slate-100', 'divide-y divide-slate-100 dark:divide-slate-700')
    c = c.replace('border-b border-slate-100', 'border-b border-slate-100 dark:border-slate-700')
    c = c.replace('border-t border-slate-100', 'border-t border-slate-100 dark:border-slate-700')

    # ==================== PHASE 5: HOVER STATES ====================

    c = c.replace('hover:bg-slate-50/50', 'hover:bg-slate-50/50 dark:hover:bg-slate-700/30')
    c = c.replace('hover:bg-blue-50/50', 'hover:bg-blue-50/50 dark:hover:bg-blue-900/20')
    c = c.replace(
        'hover:text-blue-600 hover:bg-blue-50',
        'hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30'
    )
    c = c.replace(
        'hover:text-red-500 hover:bg-red-50',
        'hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30'
    )
    c = c.replace(
        'hover:text-slate-600 rounded-lg hover:bg-slate-100',
        'hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700'
    )
    c = c.replace('hover:text-slate-800', 'hover:text-slate-800 dark:hover:text-slate-100')
    c = c.replace('group-hover:text-slate-900', 'group-hover:text-slate-900 dark:group-hover:text-slate-100')

    # ==================== PHASE 6: ICON CONTAINERS & MISC BG ====================

    c = c.replace(
        'bg-slate-100 flex items-center justify-center',
        'bg-slate-100 dark:bg-slate-700 flex items-center justify-center'
    )
    # Table header bg (after border replacement in phase 4)
    c = c.replace(
        'bg-slate-50 border-b border-slate-100 dark:border-slate-700',
        'bg-slate-50 dark:bg-slate-700/50 border-b border-slate-100 dark:border-slate-700'
    )

    # ==================== PHASE 7: TEXT COLORS (REGEX) ====================
    # Negative lookbehind for : prevents matching hover:text-slate-*, group-hover:text-slate-*, etc.
    # Negative lookahead for ' dark:' prevents double-application

    c = re.sub(r'(?<!:)text-slate-800(?! dark:)', 'text-slate-800 dark:text-slate-100', c)
    c = re.sub(r'(?<!:)text-slate-700(?! dark:)', 'text-slate-700 dark:text-slate-200', c)
    c = re.sub(r'(?<!:)text-slate-600(?! dark:)', 'text-slate-600 dark:text-slate-300', c)
    c = re.sub(r'(?<!:)text-slate-500(?! dark:)', 'text-slate-500 dark:text-slate-400', c)
    c = re.sub(r'(?<!:)text-slate-400(?! dark:)', 'text-slate-400 dark:text-slate-500', c)
    c = re.sub(r'(?<!:)text-slate-300(?! dark:)', 'text-slate-300 dark:text-slate-500', c)

    return c

for fname in files:
    path = os.path.join(base, fname)
    print(f'Processing: {fname}')
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    result = process(content)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(result)
    print(f'  Done')

print('\nAll files updated!')

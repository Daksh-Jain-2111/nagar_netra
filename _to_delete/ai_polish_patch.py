import sys, os
root = sys.argv[1]
def edit(rel, pairs):
    p = os.path.join(root, rel); s = open(p, encoding='utf-8').read()
    for old, new in pairs:
        assert old in s, (rel, old[:60]); s = s.replace(old, new, 1)
    open(p, 'w', encoding='utf-8').write(s)

edit('src/components/platform/ai/AIOverviewScreen.tsx', [
 ('<><AlertTriangle className="w-3.5 h-3.5 text-[#B42318]" /><span className="text-[#B42318]">Load error: {rt.last_error}</span></>',
  '<><AlertTriangle className="w-3.5 h-3.5 text-[#B42318] shrink-0" /><span className="text-[#B42318] line-clamp-2" title={rt.last_error}>Load error: {rt.last_error}</span></>'),
 ('<HBars rows={Object.entries(d.charts.by_model_version)', '<HBars labelWidth="18rem" rows={Object.entries(d.charts.by_model_version)'),
])
edit('src/components/platform/ai/aiUi.tsx', [
 ("export const HBars: React.FC<{ rows: { label: string; value: number; color?: string; render?: React.ReactNode }[]; valueSuffix?: string }> =\n  ({ rows, valueSuffix = '' }) => {",
  "export const HBars: React.FC<{ rows: { label: string; value: number; color?: string; render?: React.ReactNode }[]; valueSuffix?: string; labelWidth?: string }> =\n  ({ rows, valueSuffix = '', labelWidth = '9rem' }) => {"),
 ('<div key={r.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-xs">',
  '<div key={r.label} className="grid items-center gap-2 text-xs" style={{ gridTemplateColumns: `minmax(0,${labelWidth}) 1fr auto` }}>'),
 ("<ol className={horizontal ? 'grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3' : 'space-y-0'}>",
  "<ol className={horizontal ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3' : 'space-y-0'}>"),
])
edit('src/components/platform/ai/AIModelHistoryScreen.tsx', [
 ('<table className="w-full text-left text-xs min-w-[1180px]">', '<table className="w-full text-left text-xs min-w-[1040px] [&_th]:px-2.5 [&_td]:px-2.5">'),
 ('<td className="px-3 py-2.5 font-mono text-[11px] text-[#1D4ED8] whitespace-nowrap">{r.id.slice(0, 15)}…',
  '<td className="px-3 py-2.5 font-mono text-[11px] text-[#1D4ED8] whitespace-nowrap" title={r.id}>{r.id.slice(5, 15)}…'),
 ("<div className=\"font-semibold text-[#16212E] truncate\">{r.predicted_label_name || r.predicted_category_name || r.predicted_label || '—'}</div>",
  "<div className=\"font-semibold text-[#16212E] truncate\" title={r.predicted_label_name || r.predicted_category_name || undefined}>{r.predicted_label_name || r.predicted_category_name || r.predicted_label || (r.status === 'FAILED' ? <span className=\"text-[#B42318] font-normal\">No prediction (model failed)</span> : '—')}</div>"),
 ('<td className="px-3 py-2.5 max-w-[220px]">', '<td className="px-3 py-2.5 max-w-[200px]">'),
 ('<td className="px-3 py-2.5 max-w-[160px] truncate">{r.predicted_department_name', '<td className="px-3 py-2.5 max-w-[130px] truncate" title={r.predicted_department_name || undefined}>{r.predicted_department_name'),
 ('<td className="px-3 py-2.5 font-mono text-[11px] max-w-[150px] truncate" title={r.model_version}>', '<td className="px-3 py-2.5 font-mono text-[11px] max-w-[120px] truncate" title={r.model_version}>'),
 ('<td className="px-3 py-2.5 whitespace-nowrap text-[#566475]">{fmtDateTime(r.created_at)}</td>',
  '<td className="px-3 py-2.5 text-[#566475] text-[11px] leading-tight min-w-[84px]">{fmtDateTime(r.created_at)}</td>'),
])
edit('backend/app/services/ai_model_registry_service.py', [
 ('            notes = ["Zero-shot baseline: not trained on civic complaint photos (manifest description).",\n                     "Confidence values are uncalibrated softmax probabilities, not accuracy."]',
  '            notes = ["Confidence values are uncalibrated softmax probabilities, not accuracy."]'),
 ('"notes": notes + ([manifest["description"]] if manifest.get("description") else []),',
  '"notes": ([f"Manifest: {manifest[\'description\']}"] if manifest.get("description") else []) + notes,'),
])
print("ok")

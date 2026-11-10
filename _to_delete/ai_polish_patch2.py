import sys, os
root = sys.argv[1]
p = os.path.join(root, 'src/components/platform/ai/AIModelHistoryScreen.tsx'); s = open(p, encoding='utf-8').read()
pairs = [
 ('<th className="px-3 py-2.5">Predicted issue category</th><th className="px-3 py-2.5">Predicted department</th>',
  '<th className="px-3 py-2.5">Predicted issue category<span className="block font-normal text-[10px]">Predicted department</span></th>'),
 ('<th className="px-3 py-2.5">Model</th><th className="px-3 py-2.5">Version</th>',
  '<th className="px-3 py-2.5">Model name<span className="block font-normal text-[10px]">Model version</span></th>'),
 ('<table className="w-full text-left text-xs min-w-[1040px] [&_th]:px-2.5 [&_td]:px-2.5">',
  '<table className="w-full text-left text-xs min-w-[980px] [&_th]:px-2.5 [&_td]:px-2.5">'),
 ("""                          {r.predicted_label && <div className="font-mono text-[10px] text-[#8A99AA] truncate">{r.predicted_label}</div>}
                        </td>
                        <td className="px-3 py-2.5 max-w-[130px] truncate" title={r.predicted_department_name || undefined}>{r.predicted_department_name || '—'}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap"><span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: MODEL_COLOR[r.model_key] || C.navy }} />{MODEL_LABEL[r.model_key] || r.model_name}</span></td>
                        <td className="px-3 py-2.5 font-mono text-[11px] max-w-[120px] truncate" title={r.model_version}>{r.model_version}</td>""",
  """                          <div className="text-[11px] text-[#566475] truncate" title={r.predicted_department_name || undefined}>{r.predicted_department_name || '—'}{r.predicted_label && <span className="font-mono text-[10px] text-[#8A99AA]"> · {r.predicted_label}</span>}</div>
                        </td>
                        <td className="px-3 py-2.5 max-w-[150px]">
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><span className="w-2 h-2 rounded-full" style={{ background: MODEL_COLOR[r.model_key] || C.navy }} />{MODEL_LABEL[r.model_key] || r.model_name}</span>
                          <div className="font-mono text-[10px] text-[#566475] truncate" title={r.model_version}>{r.model_version}</div>
                        </td>"""),
 ('<td className="px-3 py-2.5 max-w-[200px]">', '<td className="px-3 py-2.5 max-w-[230px]">'),
]
for old, new in pairs:
    assert old in s, old[:70]; s = s.replace(old, new, 1)
open(p, 'w', encoding='utf-8').write(s); print('ok')

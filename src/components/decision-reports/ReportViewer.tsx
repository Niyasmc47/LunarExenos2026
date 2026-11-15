import React, { useState } from 'react';
import { DecisionReportRecord } from '../../types/decisionReport';
import {
  getReportPdfExportUrl,
  getReportJsonExportUrl,
  getReportCsvExportUrl,
} from '../../services/decisionReportApi';
import {
  FileText,
  Download,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Layers,
  CheckSquare,
  AlertCircle,
} from 'lucide-react';

interface ReportViewerProps {
  report: DecisionReportRecord;
}

export const ReportViewer: React.FC<ReportViewerProps> = ({ report }) => {
  const [activeSectionId, setActiveSectionId] = useState<string>(
    report.sections[0]?.section_id || 'sec-cover-overview'
  );

  const activeSection =
    report.sections.find((s) => s.section_id === activeSectionId) || report.sections[0];

  return (
    <div className="report-reader flex-1 flex flex-col h-full bg-[#080d19] overflow-hidden text-xs font-mono">
      {/* Top Action Bar */}
      <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">{report.title}</h2>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] border border-slate-700">
                {report.id}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
              <span>Mission: {report.mission_name}</span>
              <span>•</span>
              <span>Author: {report.author_organization}</span>
              <span>•</span>
              <span>Created: {report.created_at_iso.replace('T', ' ').slice(0, 19)} UTC</span>
            </div>
          </div>
        </div>

        {/* Download Buttons */}
        <div className="flex items-center gap-2">
          <a
            href={getReportPdfExportUrl(report.id)}
            download={`${report.id}.pdf`}
            className="report-pdf px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-red-950/40 text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export PDF</span>
          </a>

          <a
            href={getReportJsonExportUrl(report.id)}
            download={`${report.id}.json`}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold flex items-center gap-1.5 transition-all text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>JSON</span>
          </a>

          <a
            href={getReportCsvExportUrl(report.id)}
            download={`${report.id}_comparison.csv`}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold flex items-center gap-1.5 transition-all text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV Matrix</span>
          </a>
        </div>
      </div>

      {/* Executive KPI Banner */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-[#0a1020] border-b border-slate-800/80">
        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-[10px] text-slate-500 uppercase block">Candidates Evaluated</span>
          <span className="text-lg font-bold text-white block mt-0.5">
            {report.total_candidates_evaluated} Alternatives
          </span>
          <span className="text-[10px] text-slate-400">Candidates included in this report</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-[10px] text-slate-500 uppercase block">Fully Compliant</span>
          <span className="text-lg font-bold text-emerald-400 block mt-0.5 flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 inline" />
            {report.compliant_candidates_count} Passed
          </span>
          <span className="text-[10px] text-slate-400">100% hard constraints satisfied</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-[10px] text-slate-500 uppercase block">Non-Compliant</span>
          <span className="text-lg font-bold text-rose-400 block mt-0.5 flex items-center gap-1">
            <ShieldAlert className="w-4 h-4 inline" />
            {report.non_compliant_candidates_count} Failed
          </span>
          <span className="text-[10px] text-slate-400">Failed ≥ 1 hard constraint</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-[10px] text-slate-500 uppercase block">Indeterminate</span>
          <span className="text-lg font-bold text-amber-400 block mt-0.5 flex items-center gap-1">
            <AlertTriangle className="w-4 h-4 inline" />
            {report.indeterminate_candidates_count} Pending
          </span>
          <span className="text-[10px] text-slate-400">Partial DEM / unverified layers</span>
        </div>

        <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
          <span className="text-[10px] text-slate-500 uppercase block">Automated Recommendation</span>
          <span className="text-xs font-bold text-cyan-300 block mt-1">
            Final decision: mission team
          </span>
          <span className="text-[9px] text-slate-400 mt-0.5 block">
            System identifies trade-offs; planners decide
          </span>
        </div>
      </div>

      {/* Main Content Area: Split Navigation + Active Section */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Section Navigation */}
        <div className="report-section-nav w-64 border-r border-slate-800 bg-slate-950/60 p-3 overflow-y-auto space-y-1 shrink-0">
          <div className="px-2 py-1 text-[10px] text-slate-500 uppercase tracking-wider font-bold">
            Report sections ({report.sections.length})
          </div>
          {report.sections.map((s) => (
            <button
              key={s.section_id}
              aria-current={activeSection?.section_id === s.section_id ? 'step' : undefined}
              onClick={() => setActiveSectionId(s.section_id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono transition-all flex items-center gap-2 ${
                activeSectionId === s.section_id
                  ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
              }`}
            >
              <span className="text-[10px] text-slate-500 w-4 font-bold">{s.section_number}</span>
              <span className="truncate">{s.title.replace(/^Section \d+ — /, '')}</span>
            </button>
          ))}
        </div>

        {/* Right Active Section Viewer */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-[#070b14]">
          {activeSection && (
            <div className="max-w-4xl space-y-6">
              {/* Section Header */}
              <div className="pb-3 border-b border-slate-800">
                <div className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">
                  Section {activeSection.section_number}
                </div>
                <h3 className="text-lg font-bold text-white mt-0.5">{activeSection.title}</h3>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
                  {activeSection.summary}
                </p>
              </div>

              {/* Callouts */}
              {activeSection.callouts && activeSection.callouts.length > 0 && (
                <div className="space-y-2">
                  {activeSection.callouts.map((c, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tables */}
              {activeSection.tables && activeSection.tables.length > 0 && (
                <div className="space-y-4">
                  {activeSection.tables.map((tbl, tIdx) => (
                    <div key={tIdx} className="space-y-2">
                      {tbl.title && (
                        <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-cyan-400" />
                          <span>{tbl.title}</span>
                        </h4>
                      )}

                      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/80">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 text-[11px]">
                              {tbl.headers.map((h, hIdx) => (
                                <th key={hIdx} className="py-2.5 px-3 whitespace-nowrap">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-mono">
                            {tbl.rows.map((row, rIdx) => (
                              <tr key={rIdx} className="hover:bg-slate-800/20">
                                {row.map((cell, cIdx) => {
                                  const valStr = String(cell);
                                  let color = 'text-slate-300';
                                  if (valStr.includes('PASS') || valStr.includes('COMPLIANT') || valStr.includes('PARETO_OPTIMAL')) {
                                    color = 'text-emerald-400 font-semibold';
                                  } else if (valStr.includes('FAIL') || valStr.includes('NON_COMPLIANT') || valStr.includes('DOMINATED')) {
                                    color = 'text-rose-400 font-semibold';
                                  } else if (valStr.includes('INDETERMINATE') || valStr.includes('INCOMPARABLE')) {
                                    color = 'text-amber-400 font-semibold';
                                  }

                                  return (
                                    <td key={cIdx} className={`py-2 px-3 whitespace-nowrap ${color}`}>
                                      {valStr}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Section Details (Key-Value) */}
              {activeSection.details && Object.keys(activeSection.details).length > 0 && (
                <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
                  <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                    Technical Parameters
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {Object.entries(activeSection.details).map(([k, v]) => (
                      <div key={k} className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400 capitalize">{k.replace(/_/g, ' ')}:</span>
                        <span className="text-white font-semibold">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Disclaimers in Section */}
              {activeSection.disclaimers && activeSection.disclaimers.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800/60 space-y-1">
                  <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                    Scientific Limitations
                  </div>
                  {activeSection.disclaimers.map((d, dIdx) => (
                    <p key={dIdx} className="text-[11px] text-slate-400">
                      • {d}
                    </p>
                  ))}
                </div>
              )}

              {/* Section 12: Human Decision Checklist */}
              {activeSection.section_id === 'sec-final-findings' && (
                <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-purple-400" />
                    <span>Human Decision Authority & Sign-Off Checklist</span>
                  </h4>
                  <p className="text-xs text-slate-400">
                    The following technical clearances must be completed and logged prior to formal landing site selection:
                  </p>
                  <div className="space-y-2">
                    {report.human_decision_checklist.map((chk, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <input type="checkbox" className="rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-0" />
                          <span className="text-slate-200">{chk.item}</span>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-bold">
                          {chk.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

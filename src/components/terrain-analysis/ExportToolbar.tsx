import React, { useState } from 'react';
import { useDynamicAnalysisStore } from '../../stores/dynamicAnalysisStore';
import {
  getExportStatisticsCsvUrl,
  getExportClippedGeotiffUrl,
} from '../../services/dynamicAnalysisApi';
import { Download, FileText, Database, Check } from 'lucide-react';

export const ExportToolbar: React.FC = () => {
  const activeDatasetId = useDynamicAnalysisStore((state) => state.activeDatasetId);
  const selectedRegionBbox = useDynamicAnalysisStore((state) => state.selectedRegionBbox);
  const transectStart = useDynamicAnalysisStore((state) => state.transectStart);
  const transectEnd = useDynamicAnalysisStore((state) => state.transectEnd);

  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const triggerDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setDownloadSuccess(filename);
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  const handleExportProfileCsv = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/exports/profile-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataset_id: activeDatasetId,
          start_latitude: transectStart.lat,
          start_longitude: transectStart.lon,
          end_latitude: transectEnd.lat,
          end_longitude: transectEnd.lon,
          num_samples: 150,
        }),
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      triggerDownload(url, `lunavista_transect_${activeDatasetId}.csv`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleExportStatisticsCsv = () => {
    const url = getExportStatisticsCsvUrl(
      activeDatasetId,
      selectedRegionBbox.minLat,
      selectedRegionBbox.maxLat,
      selectedRegionBbox.minLon,
      selectedRegionBbox.maxLon
    );
    triggerDownload(url, `lunavista_statistics_${activeDatasetId}.csv`);
  };

  const handleExportGeotiff = () => {
    const url = getExportClippedGeotiffUrl(
      activeDatasetId,
      selectedRegionBbox.minLat,
      selectedRegionBbox.maxLat,
      selectedRegionBbox.minLon,
      selectedRegionBbox.maxLon
    );
    triggerDownload(url, `lunavista_${activeDatasetId}_clipped.tif`);
  };

  return (
    <div className="bg-[#141619] backdrop-blur-md border border-[#2b2d32] rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs font-mono shadow-xl">
      <div className="flex items-center gap-1.5 text-slate-300 font-bold">
        <Download className="w-4 h-4 text-emerald-400" />
        <span>SCIENTIFIC DATA EXPORTS:</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={handleExportProfileCsv}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0e1013] hover:bg-slate-800 border border-[#303238] text-slate-300 hover:text-emerald-400 transition-colors"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>TRANSECT CSV</span>
        </button>

        <button
          onClick={handleExportStatisticsCsv}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0e1013] hover:bg-slate-800 border border-[#303238] text-slate-300 hover:text-emerald-400 transition-colors"
        >
          <FileText className="w-3.5 h-3.5" />
          <span>STATISTICS CSV</span>
        </button>

        <button
          onClick={handleExportGeotiff}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/60 text-emerald-300 font-bold transition-colors"
        >
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <span>CLIPPED GEOTIFF</span>
        </button>
      </div>

      {downloadSuccess && (
        <div className="flex items-center gap-1 text-[11px] text-emerald-400 animate-fadeIn">
          <Check className="w-3.5 h-3.5" />
          <span>Downloaded {downloadSuccess}</span>
        </div>
      )}
    </div>
  );
};

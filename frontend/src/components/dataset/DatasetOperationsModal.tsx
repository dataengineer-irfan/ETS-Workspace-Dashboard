import React, { useState, useEffect } from 'react';
import {
  Download,
  Upload,
  Cloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  X,
  Database,
  ExternalLink,
  ShieldCheck,
  Clock,
  HardDrive,
  FileCheck,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import {
  fetchDatasetStatus,
  downloadMasterDataset,
  validateDatasetFile,
  uploadMasterDataset,
  testCloudUrl,
  syncDatasetFromCloud,
  DatasetStatus,
  DatasetValidationReport,
  CloudUrlTestResult,
} from '../../api/client';

interface DatasetOperationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDatasetReloaded?: () => void;
  theme?: 'light' | 'dark';
}

export const DatasetOperationsModal: React.FC<DatasetOperationsModalProps> = ({
  isOpen,
  onClose,
  onDatasetReloaded,
  theme = 'dark',
}) => {
  const [activeTab, setActiveTab] = useState<'download' | 'upload' | 'cloud'>('download');
  const [status, setStatus] = useState<DatasetStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Download state
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationReport, setValidationReport] = useState<DatasetValidationReport | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Cloud Sync state
  const [cloudUrl, setCloudUrl] = useState('');
  const [testingUrl, setTestingUrl] = useState(false);
  const [testResult, setTestResult] = useState<CloudUrlTestResult | null>(null);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Fetch status on open
  useEffect(() => {
    if (isOpen) {
      loadStatus();
    } else {
      // Reset transient state
      setSelectedFile(null);
      setValidationReport(null);
      setUploadResult(null);
      setUploadError(null);
      setTestResult(null);
      setSyncResult(null);
      setSyncError(null);
    }
  }, [isOpen]);

  const loadStatus = async () => {
    try {
      setLoadingStatus(true);
      const res = await fetchDatasetStatus();
      setStatus(res);
      if (res.cloud_url) {
        setCloudUrl(res.cloud_url);
      }
    } catch (err) {
      console.error('Failed to load dataset status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  if (!isOpen) return null;

  // Handle Download
  const handleDownload = async () => {
    try {
      setDownloading(true);
      setDownloadSuccess(false);
      await downloadMasterDataset();
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err: any) {
      console.error('Download failed:', err);
      alert('Failed to download dataset. Please check server logs.');
    } finally {
      setDownloading(false);
    }
  };

  // Handle File Selection & Pre-flight validation
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setUploadResult(null);
    setUploadError(null);
    setValidationReport(null);

    try {
      setValidating(true);
      const report = await validateDatasetFile(file);
      setValidationReport(report);
    } catch (err: any) {
      setValidationReport({
        valid: false,
        errors: [err.response?.data?.detail || err.message || 'Validation request failed'],
      });
    } finally {
      setValidating(false);
    }
  };

  // Handle Upload Commit
  const handleUploadCommit = async () => {
    if (!selectedFile) return;
    try {
      setUploading(true);
      setUploadError(null);
      const res = await uploadMasterDataset(selectedFile);
      setUploadResult(res);
      await loadStatus();
      if (onDatasetReloaded) {
        onDatasetReloaded();
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail?.message || err.response?.data?.detail || err.message || 'Upload failed';
      setUploadError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setUploading(false);
    }
  };

  // Handle Cloud Test
  const handleTestCloudUrl = async () => {
    if (!cloudUrl.trim()) return;
    try {
      setTestingUrl(true);
      setTestResult(null);
      setSyncError(null);
      const res = await testCloudUrl(cloudUrl.trim());
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        reachable: false,
        error: err.response?.data?.detail || err.message || 'Failed to reach URL',
      });
    } finally {
      setTestingUrl(false);
    }
  };

  // Handle Cloud Sync Commit
  const handleSyncFromCloud = async () => {
    if (!cloudUrl.trim()) return;
    try {
      setSyncingCloud(true);
      setSyncError(null);
      setSyncResult(null);
      const res = await syncDatasetFromCloud(cloudUrl.trim());
      setSyncResult(res);
      await loadStatus();
      if (onDatasetReloaded) {
        onDatasetReloaded();
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail?.message || err.response?.data?.detail || err.message || 'Cloud sync failed';
      setSyncError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setSyncingCloud(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs select-none">
      <div
        className="w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all"
        style={{
          background: theme === 'dark' ? '#0f172a' : '#ffffff',
          borderColor: theme === 'dark' ? 'rgba(51, 65, 85, 0.7)' : 'rgba(226, 232, 240, 0.9)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
        }}
      >
        {/* Modal Top Header */}
        <div
          className="px-5 py-3.5 border-b flex items-center justify-between shrink-0"
          style={{
            borderColor: theme === 'dark' ? 'rgba(51, 65, 85, 0.5)' : '#f1f5f9',
            background: theme === 'dark' ? 'rgba(15, 23, 42, 0.8)' : '#f8fafc',
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Dataset Operations & Cloud Ingestion
                </h2>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    status?.source_type === 'SHAREPOINT_URL'
                      ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {status?.source_type === 'SHAREPOINT_URL' ? '● SharePoint Synced' : '● Local Excel Master'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Manage, export, update, and integrate the authoritative ETS workforce workbook
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close dialog (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          className="px-5 pt-2 border-b flex items-center gap-2 shrink-0 bg-slate-950/20"
          style={{ borderColor: theme === 'dark' ? 'rgba(51, 65, 85, 0.4)' : '#e2e8f0' }}
        >
          <button
            onClick={() => setActiveTab('download')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'download'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>1. Download Dataset</span>
          </button>

          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>2. Upload & Hot-Reload</span>
          </button>

          <button
            onClick={() => setActiveTab('cloud')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'cloud'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>3. OneDrive / SharePoint URL</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto min-h-0 flex-1 space-y-4 text-xs">
          {/* TAB 1: DOWNLOAD */}
          {activeTab === 'download' && (
            <div className="space-y-4">
              {/* Telemetry Card */}
              <div className="p-3.5 rounded-xl border border-slate-700/60 bg-slate-900/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                    <span className="font-mono font-bold text-slate-200">
                      {status?.file_name || 'ETS_Dasboard_DS.xlsx'}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {status?.file_size_formatted || '—'}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-center font-mono">
                  <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-700/40">
                    <div className="text-[10px] text-slate-400 uppercase">Employees</div>
                    <div className="text-sm font-bold text-cyan-400">{status?.total_employees ?? '—'}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-700/40">
                    <div className="text-[10px] text-slate-400 uppercase">Skills</div>
                    <div className="text-sm font-bold text-sky-400">{status?.total_skills ?? '—'}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-700/40">
                    <div className="text-[10px] text-slate-400 uppercase">Leaves</div>
                    <div className="text-sm font-bold text-teal-400">{status?.total_leaves ?? '—'}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-700/40">
                    <div className="text-[10px] text-slate-400 uppercase">Finance Rows</div>
                    <div className="text-sm font-bold text-amber-400">{status?.total_finance_records ?? '—'}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    Last Updated: {status?.last_modified ? new Date(status.last_modified).toLocaleString() : 'Recent'}
                  </span>
                  <span>{status?.backup_count ?? 0} automated snapshots on disk</span>
                </div>
              </div>

              {/* Download Action */}
              <div className="flex flex-col items-center justify-center p-6 rounded-xl border border-dashed border-cyan-500/30 bg-cyan-500/5 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-200">Export Full Enterprise Workbook</h3>
                  <p className="text-slate-400 text-[11px] max-w-md mt-0.5">
                    Download the complete master workbook containing all sheets (EMPLOYEES, SKILL, Finance_History, LEAVE) in native Excel format.
                  </p>
                </div>

                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white font-bold text-xs shadow-lg shadow-cyan-900/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {downloading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Generating Export...</span>
                    </>
                  ) : downloadSuccess ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                      <span>Download Commenced!</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Download Master Dataset (.xlsx)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: UPLOAD & HOT-RELOAD */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              {/* Safety notice banner */}
              <div className="p-3 rounded-xl bg-sky-950/30 border border-sky-800/40 flex items-start gap-2.5 text-[11px] text-sky-200">
                <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-sky-300">Atomic Rollback & Safety Guarantee: </span>
                  Before committing any file, pre-flight schema inspection validates mandatory sheets and columns. An automated backup is preserved in <code className="text-sky-300 font-mono">dump/backups</code>. If parsing fails, your existing data is restored instantly.
                </div>
              </div>

              {/* Upload Dropzone */}
              <div className="relative border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-xl p-6 text-center transition-colors bg-slate-900/30">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploading}
                />
                <div className="flex flex-col items-center space-y-2 pointer-events-none">
                  <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                    <Upload className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-200">
                      {selectedFile ? selectedFile.name : 'Click to select or drag & drop updated Excel file'}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Accepts standard master workbook (.xlsx) with EMPLOYEES, SKILL, Finance_History, LEAVE
                    </p>
                  </div>
                  {selectedFile && (
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded-full">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </span>
                  )}
                </div>
              </div>

              {/* Validation Inspection Results */}
              {validating && (
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-center gap-2 text-cyan-400">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Inspecting workbook structure & sheet schemas...</span>
                </div>
              )}

              {validationReport && (
                <div
                  className={`p-3.5 rounded-xl border space-y-2 ${
                    validationReport.valid
                      ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-200'
                      : 'bg-rose-950/30 border-rose-800/40 text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold">
                    {validationReport.valid ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>Pre-Flight Validation Succeeded — Workbook Structure Verified</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>Pre-Flight Validation Failed — Cannot Commit File</span>
                      </>
                    )}
                  </div>

                  {validationReport.valid && validationReport.counts && (
                    <div className="grid grid-cols-4 gap-2 pt-1 font-mono text-[11px] text-slate-300">
                      <div className="bg-slate-900/60 p-1.5 rounded text-center">
                        Employees: <span className="text-emerald-400 font-bold">{validationReport.counts.employees ?? 0}</span>
                      </div>
                      <div className="bg-slate-900/60 p-1.5 rounded text-center">
                        Skills: <span className="text-emerald-400 font-bold">{validationReport.counts.skills ?? 0}</span>
                      </div>
                      <div className="bg-slate-900/60 p-1.5 rounded text-center">
                        Leaves: <span className="text-emerald-400 font-bold">{validationReport.counts.leaves ?? 0}</span>
                      </div>
                      <div className="bg-slate-900/60 p-1.5 rounded text-center">
                        Finance: <span className="text-emerald-400 font-bold">{validationReport.counts.finance ?? 0}</span>
                      </div>
                    </div>
                  )}

                  {validationReport.errors && validationReport.errors.length > 0 && (
                    <ul className="list-disc list-inside text-[11px] text-rose-300 space-y-0.5">
                      {validationReport.errors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Upload Commit Action */}
              {selectedFile && validationReport?.valid && !uploadResult && (
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleUploadCommit}
                    disabled={uploading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-900/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {uploading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Committing & Hot-Reloading Dashboard...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Apply Workbook & Hot-Reload ({selectedFile.name})</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Upload Success Banner */}
              {uploadResult && (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-emerald-300">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span>Dataset Successfully Uploaded and Rebuilt!</span>
                  </div>
                  <p className="text-[11px] text-emerald-300/90">
                    All 6 dashboard tabs, SQLite memory engine, and AI Copilot indexers have been updated with fresh data in real-time.
                  </p>
                </div>
              )}

              {uploadError && (
                <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-[11px]">
                  <span className="font-bold">Error:</span> {uploadError}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CLOUD SYNC (ONEDRIVE / SHAREPOINT) */}
          {activeTab === 'cloud' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-700/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-purple-300 font-bold">
                    <Cloud className="w-4 h-4" />
                    <span>Direct SharePoint & OneDrive Cloud Ingestion</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                    Direct Link Mode
                  </span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Provide a direct organization sharing URL to your <code className="text-slate-300 font-mono">ETS_Dasboard_DS.xlsx</code> on OneDrive or SharePoint. The backend automatically resolves direct download tokens and synchronizes the platform without manual file uploads.
                </p>

                {/* URL Input */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    SharePoint / OneDrive Sharing URL
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      value={cloudUrl}
                      onChange={(e) => setCloudUrl(e.target.value)}
                      placeholder="https://yourcompany.sharepoint.com/:x:/s/.../ETS_Dasboard_DS.xlsx?download=1"
                      className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-purple-400 focus:outline-hidden text-slate-200 font-mono text-[11px]"
                    />
                    <button
                      onClick={handleTestCloudUrl}
                      disabled={testingUrl || !cloudUrl.trim()}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-purple-500/40 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-semibold transition-all cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {testingUrl ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Testing...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Test Connection</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Test Result Indicator */}
                {testResult && (
                  <div
                    className={`p-3 rounded-lg border text-[11px] ${
                      testResult.reachable
                        ? 'bg-emerald-950/30 border-emerald-800/40 text-emerald-200'
                        : 'bg-rose-950/30 border-rose-800/40 text-rose-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      {testResult.reachable ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Connection Verified (HTTP {testResult.status_code || 200})</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                          <span>Connection Test Failed</span>
                        </>
                      )}
                    </div>
                    <p className="mt-1 text-[10px] font-mono opacity-90">
                      {testResult.message || testResult.error}
                    </p>
                  </div>
                )}
              </div>

              {/* Sync Action */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-900/30">
                <div className="text-[11px] text-slate-400">
                  {status?.last_synced ? (
                    <span>Last Cloud Sync: <span className="text-slate-200 font-mono">{new Date(status.last_synced).toLocaleString()}</span></span>
                  ) : (
                    <span>Ready for first synchronization</span>
                  )}
                </div>

                <button
                  onClick={handleSyncFromCloud}
                  disabled={syncingCloud || !cloudUrl.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-900/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {syncingCloud ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Pulling & Rebuilding from Cloud...</span>
                    </>
                  ) : (
                    <>
                      <Cloud className="w-4 h-4" />
                      <span>Sync Now from Cloud</span>
                    </>
                  )}
                </button>
              </div>

              {syncResult && (
                <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Synchronized successfully from cloud!</span>
                  </div>
                  <p className="text-[11px]">
                    Dataset pulled from SharePoint/OneDrive and live hot-reloaded into active memory.
                  </p>
                </div>
              )}

              {syncError && (
                <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 text-[11px]">
                  <span className="font-bold">Sync Error:</span> {syncError}
                </div>
              )}

              {/* Enterprise Architecture Roadmap */}
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/40 text-[10px] text-slate-500 space-y-1">
                <span className="font-bold text-slate-400 uppercase tracking-wider">Enterprise Roadmap</span>
                <p>
                  For corporate environments requiring Azure Active Directory (Microsoft Entra ID) authentication without shared links, this architecture supports Microsoft Graph API integration using Tenant ID, Client ID, and Client Secret.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Footer */}
        <div
          className="px-5 py-3 border-t flex items-center justify-between shrink-0 bg-slate-950/40"
          style={{ borderColor: theme === 'dark' ? 'rgba(51, 65, 85, 0.4)' : '#e2e8f0' }}
        >
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <HardDrive className="w-3.5 h-3.5 text-slate-500" />
            <span>Server Workbook: <code className="text-slate-300 font-mono">ETS_Dasboard_DS.xlsx</code></span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};

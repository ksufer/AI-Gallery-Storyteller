import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon, PlusIcon, TrashIcon, PencilIcon, ArrowPathIcon } from './Icons';

interface SyncModalProps {
  onClose: () => void;
}

interface SyncSource {
  id: number;
  name: string;
  path: string;
  enabled: number;
  last_sync_at: string | null;
  auto_sync: number;
  sync_interval: number;
  from_date: string | null;
  to_date: string | null;
  created_at: string;
}

type TabType = 'config' | 'sync';

const SyncModal: React.FC<SyncModalProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('config');
  const [sources, setSources] = useState<SyncSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Add source form
  const [addName, setAddName] = useState('');
  const [addPath, setAddPath] = useState('');
  const [adding, setAdding] = useState(false);

  // Edit source
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPath, setEditPath] = useState('');
  const [editFromDate, setEditFromDate] = useState('');
  const [editToDate, setEditToDate] = useState('');
  const [editAutoSync, setEditAutoSync] = useState(false);
  const [editSyncInterval, setEditSyncInterval] = useState(3600);
  const [saving, setSaving] = useState(false);

  const fetchSources = async () => {
    try {
      const res = await fetch('/api/sync/sources');
      const data = await res.json();
      if (data.success) setSources(data.data || []);
    } catch (e) {
      console.error('Failed to fetch sync sources:', e);
      setMessage({ text: '加载同步源失败', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleAddSource = async () => {
    const name = addName.trim();
    const pathVal = addPath.trim();
    if (!name || !pathVal) {
      setMessage({ text: '请填写名称和路径', type: 'error' });
      return;
    }
    setAdding(true);
    setMessage(null);
    try {
      const res = await fetch('/api/sync/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, path: pathVal }),
      });
      const data = await res.json();
      if (data.success) {
        setAddName('');
        setAddPath('');
        setMessage({ text: '已添加同步源', type: 'success' });
        fetchSources();
      } else {
        setMessage({ text: data.error || '添加失败', type: 'error' });
      }
    } catch (e: any) {
      setMessage({ text: e.message || '添加失败', type: 'error' });
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteSource = async (id: number) => {
    if (!confirm('确定删除该同步源？相关同步记录也会被删除。')) return;
    try {
      const res = await fetch(`/api/sync/sources/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: '已删除', type: 'success' });
        fetchSources();
        if (editingId === id) setEditingId(null);
      } else {
        setMessage({ text: data.error || '删除失败', type: 'error' });
      }
    } catch (e: any) {
      setMessage({ text: e.message || '删除失败', type: 'error' });
    }
  };

  const startEdit = (s: SyncSource) => {
    setEditingId(s.id);
    setEditName(s.name);
    setEditPath(s.path);
    setEditFromDate(s.from_date || '');
    setEditToDate(s.to_date || '');
    setEditAutoSync(!!s.auto_sync);
    setEditSyncInterval(s.sync_interval);
  };

  const handleSaveEdit = async () => {
    if (editingId == null) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/sync/sources/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          path: editPath.trim(),
          fromDate: editFromDate || null,
          toDate: editToDate || null,
          autoSync: editAutoSync,
          syncInterval: editSyncInterval,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: '已保存', type: 'success' });
        setEditingId(null);
        fetchSources();
      } else {
        setMessage({ text: data.error || '保存失败', type: 'error' });
      }
    } catch (e: any) {
      setMessage({ text: e.message || '保存失败', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEnabled = async (s: SyncSource) => {
    try {
      const res = await fetch(`/api/sync/sources/${s.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !s.enabled }),
      });
      const data = await res.json();
      if (data.success) fetchSources();
    } catch (e) {
      console.error('Toggle enabled failed:', e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900/95 border border-white/10 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">图片同步</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab('config')}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'config'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            同步源配置
          </button>
          <button
            onClick={() => setActiveTab('sync')}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'sync'
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            同步状态
          </button>
        </div>

        {message && (
          <div
            className={`mx-4 mt-2 px-3 py-2 rounded-lg text-sm ${
              message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'config' && (
            <>
              <div className="flex gap-2 mb-4 flex-wrap">
                <input
                  type="text"
                  placeholder="源名称"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="flex-1 min-w-[120px] px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50"
                />
                <input
                  type="text"
                  placeholder="文件夹路径（绝对路径）"
                  value={addPath}
                  onChange={(e) => setAddPath(e.target.value)}
                  className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-cyan-500/50"
                />
                <button
                  onClick={handleAddSource}
                  disabled={adding}
                  className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors disabled:opacity-50 flex items-center gap-2 text-sm"
                >
                  <PlusIcon className="w-4 h-4" /> 添加
                </button>
              </div>
              {loading ? (
                <p className="text-gray-500 text-sm">加载中...</p>
              ) : sources.length === 0 ? (
                <p className="text-gray-500 text-sm">暂无同步源，请添加。</p>
              ) : (
                <ul className="space-y-2">
                  {sources.map((s) => (
                    <li
                      key={s.id}
                      className="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col gap-2"
                    >
                      {editingId === s.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="名称"
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
                          />
                          <input
                            type="text"
                            value={editPath}
                            onChange={(e) => setEditPath(e.target.value)}
                            placeholder="路径"
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
                          />
                          <div className="flex gap-2 flex-wrap">
                            <input
                              type="date"
                              value={editFromDate}
                              onChange={(e) => setEditFromDate(e.target.value)}
                              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
                            />
                            <input
                              type="date"
                              value={editToDate}
                              onChange={(e) => setEditToDate(e.target.value)}
                              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
                            />
                            <label className="flex items-center gap-2 text-sm text-gray-400">
                              <input
                                type="checkbox"
                                checked={editAutoSync}
                                onChange={(e) => setEditAutoSync(e.target.checked)}
                              />
                              自动同步
                            </label>
                            <input
                              type="number"
                              value={editSyncInterval}
                              onChange={(e) => setEditSyncInterval(Number(e.target.value))}
                              placeholder="间隔(秒)"
                              className="w-24 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={handleSaveEdit}
                              disabled={saving}
                              className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 text-sm hover:bg-cyan-500/30 disabled:opacity-50"
                            >
                              保存
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1.5 rounded-lg bg-white/10 text-gray-400 text-sm hover:bg-white/20"
                            >
                              取消
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-white truncate">{s.name}</span>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <label className="flex items-center gap-1 text-xs text-gray-400">
                                <input
                                  type="checkbox"
                                  checked={!!s.enabled}
                                  onChange={() => handleToggleEnabled(s)}
                                />
                                启用
                              </label>
                              <button
                                onClick={() => startEdit(s)}
                                className="p-1.5 rounded text-gray-400 hover:text-cyan-400 hover:bg-white/10"
                                title="编辑"
                              >
                                <PencilIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteSource(s.id)}
                                className="p-1.5 rounded text-gray-400 hover:text-red-400 hover:bg-white/10"
                                title="删除"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 truncate" title={s.path}>{s.path}</p>
                          {s.last_sync_at && (
                            <p className="text-xs text-gray-500">上次同步: {new Date(s.last_sync_at).toLocaleString()}</p>
                          )}
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {activeTab === 'sync' && (
            <SyncStatusTab sources={sources} onRefresh={fetchSources} />
          )}
        </div>
      </div>
    </div>
  );
};

interface SyncStatusTabProps {
  sources: SyncSource[];
  onRefresh: () => void;
}

function SyncStatusTab({ sources, onRefresh }: SyncStatusTabProps) {
  return (
    <div className="space-y-4">
      {sources.length === 0 ? (
        <p className="text-gray-500 text-sm">请先在「同步源配置」中添加源。</p>
      ) : (
        sources.map((s) => (
          <SyncSourceCard key={s.id} source={s} onRefresh={onRefresh} />
        ))
      )}
    </div>
  );
}

interface SyncSourceCardProps {
  source: SyncSource;
  onRefresh: () => void;
}

function SyncSourceCard({ source, onRefresh }: SyncSourceCardProps) {
  const [status, setStatus] = useState<{ task: any; progress: any } | null>(null);
  const [preview, setPreview] = useState<{ totalFiles: number; totalSize: number } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`/api/sync/status/${source.id}`);
      const data = await res.json();
      if (data.success) setStatus({ task: data.data?.task ?? null, progress: data.data?.progress ?? null });
    } catch (e) {
      console.error('Fetch status failed:', e);
    }
  };

  const fetchPreview = async () => {
    setLoadingPreview(true);
    try {
      const res = await fetch(`/api/sync/preview/${source.id}`);
      const data = await res.json();
      if (data.success) setPreview({ totalFiles: data.data.totalFiles, totalSize: data.data.totalSize });
    } catch (e) {
      console.error('Preview failed:', e);
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchPreview();
  }, [source.id]);

  const progress = status?.progress;
  const task = status?.task;
  const isRunning =
    (progress && ['running', 'paused'].includes(progress.status)) ||
    (task && ['running', 'paused'].includes(task.status));

  useEffect(() => {
    if (!isRunning) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }
    const es = new EventSource(`/api/sync/events/${source.id}`);
    eventSourceRef.current = es;
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        setStatus((prev) => ({ ...prev!, progress: { ...prev?.progress, ...data, logLines: data.logLines ?? prev?.progress?.logLines } }));
      } catch (e) {}
    };
    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
    };
    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [source.id, isRunning]);

  const handleStart = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/sync/start/${source.id}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchStatus();
      } else {
        alert(data.error || '启动失败');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    try {
      await fetch(`/api/sync/pause/${source.id}`, { method: 'POST' });
      fetchStatus();
    } catch (e) {
      console.error('Pause failed:', e);
    }
  };

  const handleResume = async () => {
    try {
      await fetch(`/api/sync/resume/${source.id}`, { method: 'POST' });
      fetchStatus();
    } catch (e) {
      console.error('Resume failed:', e);
    }
  };

  const handleResetRecords = async () => {
    if (!confirm('确定重置该源的「已删除」记录？之后再次同步时，曾被您删除过的文件也会被重新复制。')) return;
    try {
      const res = await fetch(`/api/sync/reset-records/${source.id}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        onRefresh();
        fetchPreview();
      }
    } catch (e) {
      console.error('Reset failed:', e);
    }
  };

  const totalFiles = progress?.totalFiles ?? status?.task?.total_files ?? 0;
  const processedFiles = progress?.processedFiles ?? status?.task?.processed_files ?? 0;
  const totalSize = progress?.totalSize ?? status?.task?.total_size ?? 0;
  const copiedSize = progress?.copiedSize ?? status?.task?.copied_size ?? 0;
  const logLines = progress?.logLines ?? [];

  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-white">{source.name}</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPreview}
            disabled={loadingPreview}
            className="text-xs text-gray-400 hover:text-cyan-400 disabled:opacity-50"
          >
            刷新预览
          </button>
          {preview != null && (
            <span className="text-xs text-gray-500">
              待同步: {preview.totalFiles} 文件, {(preview.totalSize / 1024 / 1024).toFixed(2)} MB
            </span>
          )}
        </div>
      </div>
      {source.last_sync_at && (
        <p className="text-xs text-gray-500">上次同步: {new Date(source.last_sync_at).toLocaleString()}</p>
      )}
      {totalFiles > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-400">
            <span>进度: {processedFiles} / {totalFiles}</span>
            <span>{(copiedSize / 1024 / 1024).toFixed(2)} / {(totalSize / 1024 / 1024).toFixed(2)} MB</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-cyan-500/60 transition-all duration-300"
              style={{ width: totalFiles ? `${(processedFiles / totalFiles) * 100}%` : '0%' }}
            />
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {!isRunning ? (
          <button
            onClick={handleStart}
            disabled={actionLoading}
            className="px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30 text-sm disabled:opacity-50 flex items-center gap-1"
          >
            <ArrowPathIcon className="w-4 h-4" /> 开始同步
          </button>
        ) : (
          <>
            {progress?.status === 'paused' ? (
              <button
                onClick={handleResume}
                className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 text-sm"
              >
                恢复
              </button>
            ) : (
              <button
                onClick={handlePause}
                className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 text-sm"
              >
                暂停
              </button>
            )}
          </>
        )}
        <button
          onClick={handleResetRecords}
          className="px-3 py-1.5 rounded-lg bg-white/10 text-gray-400 hover:bg-white/20 text-sm"
        >
          重置删除记录
        </button>
      </div>
      {logLines.length > 0 && (
        <div className="mt-2 p-2 rounded-lg bg-black/30 text-xs text-gray-400 font-mono max-h-32 overflow-y-auto">
          {logLines.map((line: string, i: number) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default SyncModal;

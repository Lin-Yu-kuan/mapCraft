import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  HelpCircle,
  Database,
  Trash2,
  HardDrive,
  RefreshCw,
  Cloud,
  ChevronDown,
  ChevronUp,
  LogOut,
} from 'lucide-react';
import {
  getAllProviders,
  getProviderMeta,
  getDefaultModel,
  createProvider,
} from '@/lib/llm';
import {
  getStorageMode,
  setStorageMode as saveStorageMode,
  getStoredApiKey,
  setStoredApiKey,
  clearStoredApiKey,
  type StorageMode,
} from '@/lib/storage/settings';
import { settingsRepo, db } from '@/lib/db';
import {
  getGoogleDriveToken,
  setGoogleDriveToken,
  clearGoogleDriveToken,
  verifyGoogleDriveToken,
  requestGoogleDriveOAuthToken,
  useCloudSync,
} from '@/lib/cloud';

export function SettingsPage() {
  const { t } = useTranslation();
  const allProviders = getAllProviders();

  // 狀態管理
  const [providerId, setProviderId] = useState('openai');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [storageMode, setStorageMode] = useState<StorageMode>('local');
  const [mapModel, setMapModel] = useState('');
  const [lessonModel, setLessonModel] = useState('');

  // UI 狀態
  const [showKey, setShowKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    latencyMs?: number;
    errorMsg?: string;
  } | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [dataStats, setDataStats] = useState({ maps: 0, progress: 0, lessons: 0 });

  // 動態模型拉取與自訂輸入狀態
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchModelsMsg, setFetchModelsMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [customMapModel, setCustomMapModel] = useState(false);
  const [customLessonModel, setCustomLessonModel] = useState(false);

  // Google Drive 雲端同步設定狀態
  const {
    status: cloudStatus,
    lastSyncedAt,
    errorMessage: cloudErrorMsg,
    triggerSync,
    refreshState: refreshCloudState,
  } = useCloudSync();
  const [gdriveClientId, setGdriveClientId] = useState('');
  const [gdriveToken, setGdriveToken] = useState('');
  const [gdriveAutoSync, setGdriveAutoSync] = useState(true);
  const [gdriveUser, setGdriveUser] = useState<string | null>(null);
  const [gdriveBusy, setGdriveBusy] = useState(false);
  const [gdriveFeedback, setGdriveFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [showAdvancedCloud, setShowAdvancedCloud] = useState(false);

  const hideKeyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeMeta = getProviderMeta(providerId);

  const refreshStats = async () => {
    try {
      const [maps, progress, lessons] = await Promise.all([
        db.maps.count(),
        db.progress.count(),
        db.lessons.count(),
      ]);
      setDataStats({ maps, progress, lessons });
    } catch {
      // ignore
    }
  };

  const handleClearLessons = async () => {
    if (!confirm(t('settings.clearLessonsConfirm'))) return;
    try {
      await db.lessons.clear();
      await refreshStats();
      alert(t('settings.clearLessonsSuccess'));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleResetAll = async () => {
    if (confirm(t('settings.clearAllConfirm'))) {
      try {
        await Promise.all([
          db.maps.clear(),
          db.progress.clear(),
          db.lessons.clear(),
          db.kv.clear(),
        ]);
        // 清除各 provider 金鑰
        allProviders.forEach((p) => clearStoredApiKey(p.id));
        await refreshStats();
        alert(t('settings.clearAllSuccess'));
        window.location.reload();
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : String(err));
      }
    }
  };

  // 初始化載入
  useEffect(() => {
    refreshStats();
    async function loadInitial() {
      const mode = getStorageMode();
      setStorageMode(mode);

      const dbSettings = await settingsRepo.getSettings();
      const initialProvider = dbSettings.lastProviderId || 'openai';
      setProviderId(initialProvider);

      const meta = getProviderMeta(initialProvider);
      const defaultUrl = meta?.defaultBaseUrl || '';
      setBaseUrl(defaultUrl);

      const key = getStoredApiKey(initialProvider, mode);
      setApiKey(key);

      setMapModel(
        dbSettings.lastMapModelId || getDefaultModel(initialProvider, 'map')
      );
      setLessonModel(
        dbSettings.lastLessonModelId ||
          getDefaultModel(initialProvider, 'lesson')
      );

      setGdriveClientId(dbSettings.gdriveClientId || '');
      setGdriveAutoSync(dbSettings.gdriveAutoSync ?? true);
      const savedDriveToken = getGoogleDriveToken();
      setGdriveToken(savedDriveToken);
    }
    loadInitial();
  }, []);

  // 切換 Provider 時更新預設值
  const handleProviderChange = (newId: string) => {
    setProviderId(newId);
    setTestResult(null);
    setSavedSuccess(false);
    setFetchedModels([]);
    setFetchModelsMsg(null);
    setCustomMapModel(false);
    setCustomLessonModel(false);

    const meta = getProviderMeta(newId);
    if (meta) {
      setBaseUrl(meta.defaultBaseUrl);
      const currentMode = storageMode;
      const key = getStoredApiKey(newId, currentMode);
      setApiKey(key);
      setMapModel(getDefaultModel(newId, 'map'));
      setLessonModel(getDefaultModel(newId, 'lesson'));
    }
  };

  // 切換金鑰顯示（SPEC §7.1：10 秒後自動隱藏）
  const toggleShowKey = () => {
    if (!showKey) {
      setShowKey(true);
      if (hideKeyTimerRef.current) clearTimeout(hideKeyTimerRef.current);
      hideKeyTimerRef.current = setTimeout(() => {
        setShowKey(false);
      }, 10000);
    } else {
      setShowKey(false);
      if (hideKeyTimerRef.current) clearTimeout(hideKeyTimerRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (hideKeyTimerRef.current) clearTimeout(hideKeyTimerRef.current);
    };
  }, []);

  // 測試連線（AC-01）
  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setSavedSuccess(false);

    const abortController = new AbortController();
    const timeoutTimer = setTimeout(() => abortController.abort(), 30000);

    try {
      const provider = createProvider(
        {
          id: providerId,
          baseUrl: baseUrl.trim() || activeMeta?.defaultBaseUrl || '',
          model: mapModel.trim() || getDefaultModel(providerId, 'map'),
        },
        apiKey.trim()
      );

      const pingRes = await provider.ping(abortController.signal);
      if (pingRes.ok) {
        setTestResult({
          ok: true,
          latencyMs: pingRes.latencyMs,
        });
      } else {
        setTestResult({
          ok: false,
          errorMsg: pingRes.error?.messageForUser || t('common.error'),
        });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : String(err);
      setTestResult({
        ok: false,
        errorMsg: message,
      });
    } finally {
      clearTimeout(timeoutTimer);
      setIsTesting(false);
    }
  };

  // 自動從供應商取得線上可用模型清單
  const handleFetchModels = async () => {
    setIsFetchingModels(true);
    setFetchModelsMsg(null);
    const abortController = new AbortController();
    const timeoutTimer = setTimeout(() => abortController.abort(), 15000);

    try {
      const provider = createProvider(
        {
          id: providerId,
          baseUrl: baseUrl.trim() || activeMeta?.defaultBaseUrl || '',
          model: mapModel.trim() || getDefaultModel(providerId, 'map'),
        },
        apiKey.trim()
      );

      if (provider.listModels) {
        const list = await provider.listModels(abortController.signal);
        if (list && list.length > 0) {
          setFetchedModels(list);
          setFetchModelsMsg({
            type: 'success',
            text: t('settings.fetchModelsSuccess', { count: list.length }),
          });
        } else {
          setFetchModelsMsg({
            type: 'error',
            text: t('settings.fetchModelsFailed'),
          });
        }
      } else {
        setFetchModelsMsg({
          type: 'error',
          text: t('settings.fetchModelsFailed'),
        });
      }
    } catch {
      setFetchModelsMsg({
        type: 'error',
        text: t('settings.fetchModelsFailed'),
      });
    } finally {
      clearTimeout(timeoutTimer);
      setIsFetchingModels(false);
    }
  };

  // 儲存設定
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. 儲存金鑰（依選定儲存模式）
    saveStorageMode(storageMode);
    setStoredApiKey(providerId, apiKey.trim(), storageMode);

    // 2. 儲存非敏感設定到 Dexie
    await settingsRepo.saveSettings({
      lastProviderId: providerId,
      lastMapModelId: mapModel.trim(),
      lastLessonModelId: lessonModel.trim(),
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 4000);
  };

  // Google OAuth 彈窗授權連結
  const handleOAuthConnect = async () => {
    setGdriveBusy(true);
    setGdriveFeedback(null);
    try {
      await settingsRepo.saveSettings({
        gdriveClientId: gdriveClientId.trim(),
        gdriveAutoSync,
      });
      const token = await requestGoogleDriveOAuthToken(gdriveClientId);
      setGdriveToken(token);
      const verify = await verifyGoogleDriveToken(token);
      if (verify.ok && verify.user) {
        setGdriveUser(
          verify.user.emailAddress
            ? `${verify.user.displayName} (${verify.user.emailAddress})`
            : verify.user.displayName
        );
      }
      await refreshCloudState();
      const synced = await triggerSync();
      await refreshStats();
      if (synced) {
        setGdriveFeedback({
          type: 'success',
          text: t('cloud.syncSuccessMsg'),
        });
      }
    } catch (err) {
      setShowAdvancedCloud(true);
      setGdriveFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setGdriveBusy(false);
    }
  };

  // 驗證並儲存 Google Drive Token 與自動同步設定
  const handleVerifyAndSaveDrive = async () => {
    setGdriveBusy(true);
    setGdriveFeedback(null);
    try {
      const trimmedToken = gdriveToken.trim();
      setGoogleDriveToken(trimmedToken);
      await settingsRepo.saveSettings({
        gdriveClientId: gdriveClientId.trim(),
        gdriveAutoSync,
      });

      if (!trimmedToken) {
        await refreshCloudState();
        setGdriveFeedback({
          type: 'error',
          text: t('cloud.statusDisconnected'),
        });
        return;
      }

      const verify = await verifyGoogleDriveToken(trimmedToken);
      if (!verify.ok) {
        setGdriveFeedback({
          type: 'error',
          text: verify.errorMsg || t('cloud.statusError'),
        });
        await refreshCloudState();
        return;
      }

      if (verify.user) {
        setGdriveUser(
          verify.user.emailAddress
            ? `${verify.user.displayName} (${verify.user.emailAddress})`
            : verify.user.displayName
        );
      }

      await refreshCloudState();
      const synced = await triggerSync();
      await refreshStats();
      if (synced) {
        setGdriveFeedback({
          type: 'success',
          text: t('cloud.syncSuccessMsg'),
        });
      }
    } catch (err) {
      setShowAdvancedCloud(true);
      setGdriveFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setGdriveBusy(false);
    }
  };

  const handleToggleAutoSync = async (checked: boolean) => {
    setGdriveAutoSync(checked);
    await settingsRepo.saveSettings({ gdriveAutoSync: checked });
    await refreshCloudState();
  };

  const handleManualSyncNow = async () => {
    setGdriveBusy(true);
    setGdriveFeedback(null);
    try {
      const ok = await triggerSync();
      await refreshStats();
      if (ok) {
        setGdriveFeedback({
          type: 'success',
          text: t('cloud.syncSuccessMsg'),
        });
      }
    } finally {
      setGdriveBusy(false);
    }
  };

  const handleDisconnectDrive = async () => {
    clearGoogleDriveToken();
    setGdriveToken('');
    setGdriveUser(null);
    await settingsRepo.saveSettings({
      gdriveAutoSync: false,
      gdriveSyncFileId: undefined,
    });
    await refreshCloudState();
    setGdriveFeedback({
      type: 'success',
      text: t('cloud.disconnectedMsg'),
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-8 sm:px-6">
      {/* 頁面標題 */}
      <div className="border-b border-slate-200 pb-5 dark:border-slate-800">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          {t('settings.title')}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('settings.subtitle')}
        </p>
      </div>

      <form onSubmit={handleSave} className="mt-8 space-y-6">
        {/* 主要卡片 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-950 space-y-6">
          {/* 供應商選擇 */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
              {t('settings.providerLabel')}
            </label>
            <select
              value={providerId}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-all focus:border-emerald-500 focus:outline-hidden focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            >
              {allProviders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
              {t('settings.baseUrlLabel')}
            </label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder={activeMeta?.defaultBaseUrl}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono text-slate-900 transition-all focus:border-emerald-500 focus:outline-hidden focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>

          {/* API Key 輸入與遮罩 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-slate-900 dark:text-white">
                {t('settings.apiKeyLabel')}
              </label>
              {activeMeta?.docUrl && (
                <a
                  href={activeMeta.docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-600 hover:underline dark:text-emerald-400 inline-flex items-center gap-1"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  {t('settings.getKey', { name: activeMeta.name })}
                </a>
              )}
            </div>
            <div className="relative flex items-center">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value.trim())}
                placeholder={t('settings.apiKeyPlaceholder')}
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-3.5 pr-12 text-sm font-mono text-slate-900 transition-all focus:border-emerald-500 focus:outline-hidden focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={toggleShowKey}
                className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label={
                  showKey ? t('settings.hideKeyAria') : t('settings.showKeyAria')
                }
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* 儲存模式切換（SPEC §2.2 FR-01） */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-2">
              {t('settings.storageModeLabel')}
            </label>
            <div className="space-y-2">
              <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/60 cursor-pointer">
                <input
                  type="radio"
                  name="storageMode"
                  value="local"
                  checked={storageMode === 'local'}
                  onChange={() => setStorageMode('local')}
                  className="mt-1 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-900 dark:text-white block">
                    {t('settings.storageModeLocal')}
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/60 cursor-pointer">
                <input
                  type="radio"
                  name="storageMode"
                  value="session"
                  checked={storageMode === 'session'}
                  onChange={() => setStorageMode('session')}
                  className="mt-1 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-900 dark:text-white block">
                    {t('settings.storageModeSession')}
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/60 cursor-pointer">
                <input
                  type="radio"
                  name="storageMode"
                  value="memory"
                  checked={storageMode === 'memory'}
                  onChange={() => setStorageMode('memory')}
                  className="mt-1 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="text-xs">
                  <span className="font-semibold text-slate-900 dark:text-white block">
                    {t('settings.storageModeMemory')}
                  </span>
                </div>
              </label>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {t('settings.storageModeNotice')}
            </p>
          </div>

          {/* 模型角色指派（地圖規劃 vs 教材撰寫） */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-900 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  模型設定
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  從官方推薦清單中選取，或直接從您的帳號拉取所有在線可用模型。
                </p>
              </div>

              <button
                type="button"
                onClick={handleFetchModels}
                disabled={isFetchingModels || (!apiKey.trim() && providerId !== 'ollama')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetchingModels ? 'animate-spin' : ''}`} />
                {isFetchingModels ? t('settings.fetchingModels') : t('settings.fetchModels')}
              </button>
            </div>

            {fetchModelsMsg && (
              <div
                className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                  fetchModelsMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/50'
                    : 'bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50'
                }`}
              >
                {fetchModelsMsg.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                )}
                <span>{fetchModelsMsg.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* 地圖規劃模型 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('settings.mapModelLabel')}
                  </label>
                  {customMapModel ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomMapModel(false);
                        setMapModel(getDefaultModel(providerId, 'map'));
                      }}
                      className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      返回選單
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCustomMapModel(true)}
                      className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      手動自訂
                    </button>
                  )}
                </div>

                {customMapModel ? (
                  <input
                    type="text"
                    value={mapModel}
                    onChange={(e) => setMapModel(e.target.value)}
                    placeholder={t('settings.customModelPlaceholder')}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 transition-all focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                ) : (
                  <select
                    value={mapModel}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setCustomMapModel(true);
                      } else {
                        setMapModel(e.target.value);
                      }
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 transition-all focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    {activeMeta?.recommendedModels && activeMeta.recommendedModels.length > 0 && (
                      <optgroup label={t('settings.recommendedGroup')}>
                        {activeMeta.recommendedModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name || m.id}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {fetchedModels.length > 0 && (
                      <optgroup label={t('settings.fetchedGroup')}>
                        {fetchedModels
                          .filter((fm) => !activeMeta?.recommendedModels.some((rm) => rm.id === fm))
                          .map((fm) => (
                            <option key={fm} value={fm}>
                              {fm}
                            </option>
                          ))}
                      </optgroup>
                    )}

                    <option value="__custom__">{t('settings.customModelOption')}</option>
                  </select>
                )}
              </div>

              {/* 教材撰寫模型 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t('settings.lessonModelLabel')}
                  </label>
                  {customLessonModel ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomLessonModel(false);
                        setLessonModel(getDefaultModel(providerId, 'lesson'));
                      }}
                      className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      返回選單
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setCustomLessonModel(true)}
                      className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      手動自訂
                    </button>
                  )}
                </div>

                {customLessonModel ? (
                  <input
                    type="text"
                    value={lessonModel}
                    onChange={(e) => setLessonModel(e.target.value)}
                    placeholder={t('settings.customModelPlaceholder')}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 transition-all focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                ) : (
                  <select
                    value={lessonModel}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setCustomLessonModel(true);
                      } else {
                        setLessonModel(e.target.value);
                      }
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 transition-all focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    {activeMeta?.recommendedModels && activeMeta.recommendedModels.length > 0 && (
                      <optgroup label={t('settings.recommendedGroup')}>
                        {activeMeta.recommendedModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name || m.id}
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {fetchedModels.length > 0 && (
                      <optgroup label={t('settings.fetchedGroup')}>
                        {fetchedModels
                          .filter((fm) => !activeMeta?.recommendedModels.some((rm) => rm.id === fm))
                          .map((fm) => (
                            <option key={fm} value={fm}>
                              {fm}
                            </option>
                          ))}
                      </optgroup>
                    )}

                    <option value="__custom__">{t('settings.customModelOption')}</option>
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Ollama 專屬提示 */}
          {activeMeta?.requiresCustomOriginsNotice && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
              {t('settings.ollamaNotice')}
            </div>
          )}

          {/* 連線測試結果提示面板 */}
          {testResult && (
            <div
              className={`flex items-start gap-2.5 rounded-xl border p-3.5 text-xs transition-all ${
                testResult.ok
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              )}
              <div className="flex-1">
                {testResult.ok
                  ? t('settings.testSuccess', { ms: testResult.latencyMs })
                  : `${t('settings.testFailed')} ${testResult.errorMsg}`}
              </div>
            </div>
          )}
        </div>

        {/* 底部操作按鈕列 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            <span>{t('common.byokBadge')}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isTesting}
              onClick={handleTestConnection}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
              ) : (
                <KeyRound className="h-4 w-4 text-emerald-600" />
              )}
              <span>
                {isTesting ? t('settings.testing') : t('settings.testConnection')}
              </span>
            </button>

            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400"
            >
              <span>{t('settings.saveSettings')}</span>
            </button>
          </div>
        </div>

        {/* 儲存成功提示 */}
        {savedSuccess && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center text-xs font-medium text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 animate-in fade-in">
            {t('settings.savedSuccess')}
          </div>
        )}
      </form>

      {/* Local-First Google Drive 雲端同步與備份 */}
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-950 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {t('cloud.title')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('cloud.subtitle')}
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              gdriveToken.trim()
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            {gdriveToken.trim()
              ? cloudStatus === 'syncing'
                ? t('cloud.statusSyncing')
                : t('cloud.statusSynced')
              : t('cloud.statusDisconnected')}
          </span>
        </div>

        {/* 未登入狀態：主登入按鈕與效益提示 */}
        {!gdriveToken.trim() ? (
          <div className="space-y-4">
            <div>
              <button
                type="button"
                disabled={gdriveBusy}
                onClick={() => void handleOAuthConnect()}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:from-sky-500 hover:to-emerald-500 disabled:opacity-50 transition-all cursor-pointer"
              >
                {gdriveBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Cloud className="h-4 w-4" />
                )}
                <span>{t('cloud.loginGoogleBtn')}</span>
              </button>
            </div>

            <div className="rounded-xl border border-sky-100 bg-sky-50/70 p-4 dark:border-sky-900/50 dark:bg-sky-950/30 space-y-2">
              <div className="flex items-start gap-2 text-xs font-semibold text-sky-900 dark:text-sky-200">
                <span>{t('cloud.shareBenefit')}</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {t('cloud.loginGoogleHint')}
              </p>
            </div>
          </div>
        ) : (
          /* 已登入狀態：帳號資訊、自動同步開關與操作 */
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30 space-y-2">
              {gdriveUser && (
                <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  {t('cloud.connectedAs', { name: gdriveUser })}
                </p>
              )}
              {lastSyncedAt && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('cloud.lastSyncedLabel', {
                    time: new Date(lastSyncedAt).toLocaleString(),
                  })}
                </p>
              )}
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                {t('cloud.shareBenefit')}
              </p>
            </div>

            {/* 自動同步開關 */}
            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 cursor-pointer dark:border-slate-800 dark:bg-slate-900/40">
              <input
                type="checkbox"
                checked={gdriveAutoSync}
                onChange={(e) => void handleToggleAutoSync(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <div className="text-xs">
                <span className="font-semibold text-slate-900 dark:text-white block">
                  {t('cloud.autoSyncLabel')}
                </span>
                <span className="text-slate-500 dark:text-slate-400 mt-0.5 block">
                  {t('cloud.autoSyncDesc')}
                </span>
              </div>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                disabled={gdriveBusy || cloudStatus === 'syncing'}
                onClick={() => void handleManualSyncNow()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-500 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    cloudStatus === 'syncing' ? 'animate-spin' : ''
                  }`}
                />
                <span>{t('cloud.syncNowBtn')}</span>
              </button>

              <button
                type="button"
                onClick={() => void handleDisconnectDrive()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>{t('cloud.disconnectBtn')}</span>
              </button>
            </div>
          </div>
        )}

        {/* 狀態回饋訊息 */}
        {(gdriveFeedback || cloudErrorMsg) && (
          <div
            className={`flex items-center gap-2 rounded-xl border p-3 text-xs ${
              gdriveFeedback?.type === 'success' && !cloudErrorMsg
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300'
            }`}
          >
            {gdriveFeedback?.type === 'success' && !cloudErrorMsg ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            )}
            <span>{cloudErrorMsg || gdriveFeedback?.text}</span>
          </div>
        )}

        {/* 進階自訂設定手風琴（選填） */}
        <div className="border-t border-slate-100 pt-3 dark:border-slate-800/80">
          <button
            type="button"
            onClick={() => setShowAdvancedCloud((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
          >
            {showAdvancedCloud ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            <span>{t('cloud.advancedSettings')}</span>
          </button>

          {showAdvancedCloud && (
            <div className="mt-3 space-y-3.5 rounded-xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800/60 dark:bg-slate-900/40 animate-in fade-in">
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {t('cloud.advancedSettingsDesc')}
              </p>

              {/* Google OAuth Client ID */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t('cloud.clientIdLabel')}
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={gdriveClientId}
                    onChange={(e) => setGdriveClientId(e.target.value)}
                    placeholder={t('cloud.clientIdPlaceholder')}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-mono text-slate-900 focus:border-emerald-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    disabled={gdriveBusy || !gdriveClientId.trim()}
                    onClick={() => void handleOAuthConnect()}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-sky-300 bg-sky-50 px-3.5 py-2 text-xs font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-50 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300 cursor-pointer"
                  >
                    <Cloud className="h-3.5 w-3.5" />
                    <span>{t('cloud.oauthConnectBtn')}</span>
                  </button>
                </div>
              </div>

              {/* Access Token 輸入框 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  {t('cloud.tokenLabel')}
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="password"
                    value={gdriveToken}
                    onChange={(e) => setGdriveToken(e.target.value.trim())}
                    placeholder={t('cloud.tokenPlaceholder')}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-mono text-slate-900 focus:border-emerald-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    disabled={gdriveBusy || !gdriveToken.trim()}
                    onClick={() => void handleVerifyAndSaveDrive()}
                    className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-sky-500 disabled:opacity-50 cursor-pointer"
                  >
                    {gdriveBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    <span>{t('cloud.verifyAndSaveBtn')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* T4.3 資料儲存與用量管理 */}
      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-950 space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {t('settings.dataTitle')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('settings.dataSubtitle')}
            </p>
          </div>
        </div>

        {/* 統計指標卡 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-center dark:border-slate-800 dark:bg-slate-900/50">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {t('settings.mapsCount')}
            </span>
            <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{dataStats.maps}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-center dark:border-slate-800 dark:bg-slate-900/50">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {t('settings.progressCount')}
            </span>
            <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
              {dataStats.progress}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-center dark:border-slate-800 dark:bg-slate-900/50">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {t('settings.lessonsCount')}
            </span>
            <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
              {dataStats.lessons}
            </p>
          </div>
        </div>

        {/* 資料管理操作按鈕 */}
        <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800/80">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleClearLessons}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <HardDrive className="h-3.5 w-3.5 text-amber-500" />
              <span>{t('settings.clearLessons')}</span>
            </button>

            <button
              type="button"
              onClick={handleResetAll}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{t('settings.clearAllData')}</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
            {t('settings.clearLessonsDesc')}
          </p>
        </div>
      </section>
    </div>
  );
}

export default SettingsPage;

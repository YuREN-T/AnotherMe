'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Server, User, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { AVATAR_OPTIONS, useUserProfileStore } from '@/lib/store/user-profile';

interface ProviderMap {
  [providerId: string]: {
    baseUrl?: string;
    models?: string[];
  };
}

interface ProvidersResponse {
  success: boolean;
  providers?: ProviderMap;
  tts?: ProviderMap;
  asr?: ProviderMap;
  pdf?: ProviderMap;
  image?: ProviderMap;
  video?: ProviderMap;
  webSearch?: ProviderMap;
  error?: string;
}

interface HealthResponse {
  success: boolean;
  status?: string;
  version?: string;
  error?: string;
}

export default function SettingsPage() {
  const avatar = useUserProfileStore((s) => s.avatar);
  const nickname = useUserProfileStore((s) => s.nickname);
  const bio = useUserProfileStore((s) => s.bio);
  const setAvatar = useUserProfileStore((s) => s.setAvatar);
  const setNickname = useUserProfileStore((s) => s.setNickname);
  const setBio = useUserProfileStore((s) => s.setBio);

  const [providers, setProviders] = useState<ProvidersResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [warningText, setWarningText] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const [providerResult, healthResult] = await Promise.allSettled([
          fetch('/api/server-providers', { method: 'GET', cache: 'no-store' }).then(async (resp) => {
            const payload = (await resp.json()) as ProvidersResponse;
            if (!resp.ok || !payload.success) {
              throw new Error(payload.error || '加载服务提供商配置失败。');
            }
            return payload;
          }),
          fetch('/api/health', { method: 'GET', cache: 'no-store' }).then(async (resp) => {
            const payload = (await resp.json()) as HealthResponse;
            if (!resp.ok || !payload.success) {
              throw new Error(payload.error || '加载系统健康状态失败。');
            }
            return payload;
          }),
        ]);

        const hasProviderData = providerResult.status === 'fulfilled';
        const hasHealthData = healthResult.status === 'fulfilled';

        if (!hasProviderData && !hasHealthData) {
          throw new Error('设置加载失败：提供商配置和健康检查均不可用。');
        }

        if (!cancelled) {
          if (hasProviderData) {
            setProviders(providerResult.value);
          }
          if (hasHealthData) {
            setHealth(healthResult.value);
          }
          if (!hasProviderData || !hasHealthData) {
            setWarningText('部分设置数据暂不可用，当前已展示可获取的数据。');
          }
        }
      } catch (error) {
        if (!cancelled) {
          setErrorText(error instanceof Error ? error.message : '设置加载失败。');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, []);

  const providerStats = useMemo(() => {
    const p = providers;
    if (!p) return [];

    const groups = [
      ['LLM', p.providers],
      ['TTS', p.tts],
      ['ASR', p.asr],
      ['PDF', p.pdf],
      ['Image', p.image],
      ['Video', p.video],
      ['Web Search', p.webSearch],
    ] as const;

    return groups.map(([label, map]) => ({
      label,
      count: map ? Object.keys(map).length : 0,
      ids: map ? Object.keys(map) : [],
    }));
  }, [providers]);

  const handleSaveProfile = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1500);
  };

  if (loading) {
    return (
      <div className="h-[50vh] flex items-center justify-center text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        正在加载设置...
      </div>
    );
  }

  if (errorText) {
    return <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3">{errorText}</div>;
  }

  return (
    <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
      {warningText ? (
        <div className="lg:col-span-3 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm">
          {warningText}
        </div>
      ) : null}
      <div className="lg:col-span-2 bg-white p-6 shadow-sm space-y-8">
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-1">个人资料</h2>
          <p className="text-sm text-gray-500">资料保存在本地，同时可与后端课程生成流程联动。</p>
        </div>

        <div className="space-y-4">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">昵称</label>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="请输入昵称"
            className="w-full bg-[#F4F3F0] px-4 py-3 outline-none text-sm"
          />

          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide">个人简介</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            placeholder="介绍一下你的教学风格或学习目标"
            className="w-full bg-[#F4F3F0] px-4 py-3 outline-none text-sm resize-none"
          />
        </div>

        <div>
          <h3 className="text-sm font-bold text-gray-900 mb-3">选择头像</h3>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
            {AVATAR_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setAvatar(option)}
                className={`p-1.5 border ${avatar === option ? 'border-black' : 'border-gray-200'} transition-colors`}
              >
                <img src={option} alt="avatar" className="h-12 w-12 object-cover" />
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSaveProfile}
          className="inline-flex items-center gap-2 bg-black text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          {saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? '已保存' : '保存资料'}
        </button>
      </div>

      <div className="bg-white p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <Server className="h-5 w-5 text-gray-700" />
          <h2 className="text-lg font-bold text-gray-900">后端连接状态</h2>
        </div>

        <div className="p-4 bg-[#F9F9F8]">
          <div className="text-xs text-gray-500 uppercase tracking-wide font-bold mb-1">服务健康</div>
          <div className="flex items-center gap-2 text-sm text-gray-800 font-medium">
            {health?.status === 'ok' ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-orange-600" />
            )}
            {health?.status || 'unknown'}
          </div>
          <div className="text-xs text-gray-500 mt-1">版本：{health?.version || 'unknown'}</div>
        </div>

        <div className="space-y-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide font-bold">服务提供商</div>
          {providerStats.map((group) => (
            <div key={group.label} className="border border-gray-100 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-800">{group.label}</span>
                <span className="text-xs font-bold text-gray-500">{group.count}</span>
              </div>
              <p className="text-xs text-gray-500 break-all">
                {group.ids.length > 0 ? group.ids.join(', ') : '暂无配置'}
              </p>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-gray-100 flex items-start gap-2 text-xs text-gray-500">
          <User className="h-4 w-4 mt-0.5 shrink-0" />
          当前页面使用真实接口 /api/server-providers 与 /api/health，便于联通状态排查。
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/context';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { LINE_MODULES } from '@/modules/lines';
import { listDevices } from '@/modules/camera-core/api';
import type { CameraDevice } from '@/modules/camera-core/types';
import { createClient } from '@/lib/supabase/client';

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [defaultLineKey, setDefaultLineKey] = useState<string>('');
  const [defaultCameraId, setDefaultCameraId] = useState<string>('');
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const supabase = createClient();

  // 加载用户当前设置
  useEffect(() => {
    if (profile) {
      setDefaultLineKey(profile.default_line_key || '');
      setDefaultCameraId(profile.default_camera_id || '');
    }
  }, [profile]);

  // 加载相机列表
  useEffect(() => {
    loadCameras();
  }, []);

  const loadCameras = async () => {
    setLoading(true);
    try {
      const devices = await listDevices();
      setCameras(devices);
    } catch (error) {
      console.error('加载相机列表失败:', error);
      setMessage({ type: 'error', text: '加载相机列表失败' });
    } finally {
      setLoading(false);
    }
  };

  // 根据选择的产线过滤相机
  const getFilteredCameras = () => {
    if (!defaultLineKey) return cameras;
    const line = LINE_MODULES.find(l => l.key === defaultLineKey);
    if (!line || line.cameraIds.length === 0) return cameras;
    return cameras.filter(c => line.cameraIds.includes(c.id));
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          default_line_key: defaultLineKey || null,
          default_camera_id: defaultCameraId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      // 刷新 profile
      await refreshProfile();

      setMessage({ type: 'success', text: '设置保存成功！' });
      
      // 3秒后清除消息
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('保存设置失败:', error);
      setMessage({ type: 'error', text: '保存设置失败，请重试' });
    } finally {
      setSaving(false);
    }
  };

  const handleLineChange = (lineKey: string) => {
    setDefaultLineKey(lineKey);
    // 切换产线时清空相机选择
    setDefaultCameraId('');
  };

  const getRoleLabel = (role: string) => {
    const roleMap: Record<string, string> = {
      worker: '工人',
      supervisor: '主管',
      engineer: '工程师',
      admin: '管理员',
    };
    return roleMap[role] || role;
  };

  const filteredCameras = getFilteredCameras();

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* 页面标题 */}
          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">用户设置</h1>
            <p className="text-sm text-gray-600 mt-1">管理您的账号信息和偏好设置</p>
          </div>

          {/* 消息提示 */}
          {message && (
            <div className={`mb-6 p-4 rounded-lg ${
              message.type === 'success' 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center">
                {message.type === 'success' ? (
                  <svg className="w-5 h-5 text-green-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-red-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <p className={`text-sm font-medium ${
                  message.type === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {message.text}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {/* 账号信息卡片 */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">账号信息</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">邮箱</span>
                  <span className="text-sm font-medium text-gray-900">{user?.email}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">角色</span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {profile ? getRoleLabel(profile.role) : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">工位</span>
                  <span className="text-sm font-medium text-gray-900">{profile?.station || '未设置'}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-600">用户 ID</span>
                  <span className="text-xs font-mono text-gray-500">{user?.id.slice(0, 8)}...</span>
                </div>
              </div>
            </div>

            {/* 偏好设置卡片 */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">偏好设置</h2>
              <p className="text-sm text-gray-600 mb-6">
                设置默认产线和相机后，质检时将自动使用这些设置，无需每次选择
              </p>

              <div className="space-y-4">
                {/* 默认产线 */}
                <div>
                  <label htmlFor="default-line" className="block text-sm font-medium text-gray-700 mb-2">
                    默认产线
                  </label>
                  <select
                    id="default-line"
                    value={defaultLineKey}
                    onChange={(e) => handleLineChange(e.target.value)}
                    disabled={saving}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">不设置（每次手动选择）</option>
                    {LINE_MODULES.map((line) => (
                      <option key={line.key} value={line.key}>
                        {line.label}
                      </option>
                    ))}
                  </select>
                  {defaultLineKey && LINE_MODULES.find(l => l.key === defaultLineKey)?.description && (
                    <p className="text-xs text-gray-500 mt-1">
                      {LINE_MODULES.find(l => l.key === defaultLineKey)?.description}
                    </p>
                  )}
                </div>

                {/* 默认相机 */}
                <div>
                  <label htmlFor="default-camera" className="block text-sm font-medium text-gray-700 mb-2">
                    默认相机
                  </label>
                  {loading ? (
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-500">
                      加载相机列表...
                    </div>
                  ) : filteredCameras.length === 0 ? (
                    <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm text-gray-500">
                      {defaultLineKey ? '当前产线没有可用相机' : '请先选择产线'}
                    </div>
                  ) : (
                    <>
                      <select
                        id="default-camera"
                        value={defaultCameraId}
                        onChange={(e) => setDefaultCameraId(e.target.value)}
                        disabled={saving || !defaultLineKey}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                      >
                        <option value="">不设置（每次手动选择）</option>
                        {filteredCameras.map((camera) => (
                          <option key={camera.id} value={camera.id}>
                            {camera.name || camera.id}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        当前产线共 {filteredCameras.length} 个可用相机
                      </p>
                    </>
                  )}
                </div>

                {/* 保存按钮 */}
                <div className="pt-4">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        保存中...
                      </div>
                    ) : (
                      '保存设置'
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* 说明卡片 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex">
                <svg className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">提示</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-700">
                    <li>设置默认产线和相机后，质检时会自动使用这些设置</li>
                    <li>如果不设置默认值，每次质检时需要手动选择</li>
                    <li>您可以随时修改这些设置</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}

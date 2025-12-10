'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession, signOut } from '@/lib/auth-client';

// Default GP thresholds
const DEFAULT_THRESHOLDS = {
  excellent: 50,
  good: 30,
  low: 0
};

export default function SettingsPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();

  // GP Thresholds
  const [gpThresholds, setGpThresholds] = useState(DEFAULT_THRESHOLDS);
  const [tempThresholds, setTempThresholds] = useState(DEFAULT_THRESHOLDS);
  const [savingGpSettings, setSavingGpSettings] = useState(false);
  const [gpSettingsSaved, setGpSettingsSaved] = useState(false);

  // SMTP Settings
  const [smtpSettings, setSmtpSettings] = useState({
    enabled: false,
    host: '',
    port: 587,
    secure: false,
    from: { name: '', address: '' },
    auth: { user: '', pass: '' },
    testRecipient: ''
  });
  const [tempSmtpSettings, setTempSmtpSettings] = useState(smtpSettings);
  const [savingSmtpSettings, setSavingSmtpSettings] = useState(false);
  const [smtpSettingsSaved, setSmtpSettingsSaved] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState(null);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);

  // Change Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Check auth and redirect if not logged in
  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push('/login');
    }
  }, [session, isPending, router]);

  // Load settings from server
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          if (data.gpThresholds) {
            setGpThresholds(data.gpThresholds);
            setTempThresholds(data.gpThresholds);
          }
          if (data.smtp) {
            setSmtpSettings(data.smtp);
            setTempSmtpSettings(data.smtp);
          }
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    }
    loadSettings();
  }, []);

  // Save GP Thresholds
  const saveGpThresholds = async () => {
    setSavingGpSettings(true);
    setGpSettingsSaved(false);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gpThresholds: tempThresholds,
          smtp: smtpSettings // Keep existing SMTP settings
        })
      });

      if (res.ok) {
        setGpThresholds(tempThresholds);
        setGpSettingsSaved(true);
        setTimeout(() => setGpSettingsSaved(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save GP thresholds:', err);
    } finally {
      setSavingGpSettings(false);
    }
  };

  // Save SMTP Settings
  const saveSmtpSettings = async () => {
    setSavingSmtpSettings(true);
    setSmtpSettingsSaved(false);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gpThresholds: gpThresholds, // Keep existing GP thresholds
          smtp: tempSmtpSettings
        })
      });

      if (res.ok) {
        setSmtpSettings(tempSmtpSettings);
        setSmtpSettingsSaved(true);
        setTimeout(() => setSmtpSettingsSaved(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save SMTP settings:', err);
    } finally {
      setSavingSmtpSettings(false);
    }
  };

  // Test email configuration
  const handleTestEmail = async () => {
    setTestingEmail(true);
    setTestEmailResult(null);

    try {
      const res = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smtpSettings: tempSmtpSettings })
      });

      const result = await res.json();
      setTestEmailResult(result);
    } catch (err) {
      setTestEmailResult({
        success: false,
        error: 'Failed to send test email'
      });
    } finally {
      setTestingEmail(false);
    }
  };

  // Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setChangingPassword(true);
    setPasswordError('');
    setPasswordChanged(false);

    // Validate passwords
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      setChangingPassword(false);
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      setChangingPassword(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      const data = await res.json();

      if (data.success) {
        setPasswordChanged(true);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordChanged(false), 5000);
      } else {
        setPasswordError(data.error || 'Failed to change password');
      }
    } catch (err) {
      setPasswordError('Failed to change password: ' + err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  if (isPending || !session?.user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* User Info */}
        <div className="mb-8 pb-8 border-b">
          <p className="text-sm text-gray-500">Signed in as</p>
          <p className="font-medium text-gray-900">{session.user.email}</p>
          {session.user.role === 'admin' && (
            <span className="inline-block mt-2 text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded">
              Admin
            </span>
          )}
        </div>

        {/* GP% Color Thresholds */}
        <div className="mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">GP% Color Thresholds</h2>

            <div className="space-y-6">
              <div>
                <label className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-600"></span>
                    Green (Excellent)
                  </span>
                  <span className="font-mono">≥ {tempThresholds.excellent}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={tempThresholds.excellent}
                  onChange={(e) => setTempThresholds(prev => ({ ...prev, excellent: parseInt(e.target.value) }))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                />
              </div>

              <div>
                <label className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                    Yellow (Good)
                  </span>
                  <span className="font-mono">≥ {tempThresholds.good}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={tempThresholds.good}
                  onChange={(e) => setTempThresholds(prev => ({ ...prev, good: parseInt(e.target.value) }))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                />
              </div>

              <div>
                <label className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-orange-500"></span>
                    Orange (Low)
                  </span>
                  <span className="font-mono">≥ {tempThresholds.low}%</span>
                </label>
                <input
                  type="range"
                  min="-50"
                  max="100"
                  value={tempThresholds.low}
                  onChange={(e) => setTempThresholds(prev => ({ ...prev, low: parseInt(e.target.value) }))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                />
              </div>

              <div className="pt-2">
                <p className="text-xs text-gray-500 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-600"></span>
                  Red shown for values below {tempThresholds.low}%
                </p>
              </div>

              <div className="pt-4 flex items-center gap-3">
                <button
                  onClick={saveGpThresholds}
                  disabled={savingGpSettings}
                  className="apple-button"
                >
                  {savingGpSettings ? 'Saving...' : 'Save GP% Thresholds'}
                </button>
                {gpSettingsSaved && (
                  <span className="text-sm text-green-600 flex items-center gap-1">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Saved!
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Email Settings - Admin Only */}
        {session.user.role === 'admin' && (
          <div className="mb-8">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Email Settings</h2>

              {/* Enable Email Toggle */}
              <div className="mb-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={tempSmtpSettings.enabled}
                    onChange={(e) => setTempSmtpSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                    className="mr-3 rounded"
                  />
                  <span className="text-sm text-gray-700 font-medium">Enable Email Sending</span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-7">
                  Send invitation and password reset emails via SMTP
                </p>
              </div>

              {tempSmtpSettings.enabled && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* SMTP Host */}
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">SMTP Host</label>
                      <input
                        type="text"
                        value={tempSmtpSettings.host}
                        onChange={(e) => setTempSmtpSettings(prev => ({ ...prev, host: e.target.value }))}
                        placeholder="smtp.gmail.com"
                        className="apple-search w-full"
                      />
                    </div>

                    {/* SMTP Port */}
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Port</label>
                      <input
                        type="number"
                        value={tempSmtpSettings.port}
                        onChange={(e) => setTempSmtpSettings(prev => ({ ...prev, port: parseInt(e.target.value) || 587 }))}
                        className="apple-search w-full"
                      />
                    </div>
                  </div>

                  {/* Use TLS/SSL */}
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={tempSmtpSettings.secure}
                        onChange={(e) => setTempSmtpSettings(prev => ({ ...prev, secure: e.target.checked }))}
                        className="mr-2 rounded"
                      />
                      <span className="text-sm text-gray-700">Use SSL (port 465)</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* From Name */}
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">From Name</label>
                      <input
                        type="text"
                        value={tempSmtpSettings.from.name}
                        onChange={(e) => setTempSmtpSettings(prev => ({ ...prev, from: { ...prev.from, name: e.target.value } }))}
                        placeholder="GP Calculator"
                        className="apple-search w-full"
                      />
                    </div>

                    {/* From Email */}
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">From Email Address</label>
                      <input
                        type="email"
                        value={tempSmtpSettings.from.address}
                        onChange={(e) => setTempSmtpSettings(prev => ({ ...prev, from: { ...prev.from, address: e.target.value } }))}
                        placeholder="noreply@example.com"
                        className="apple-search w-full"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* SMTP Username */}
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">SMTP Username</label>
                      <input
                        type="text"
                        value={tempSmtpSettings.auth.user}
                        onChange={(e) => setTempSmtpSettings(prev => ({ ...prev, auth: { ...prev.auth, user: e.target.value } }))}
                        placeholder="username or email"
                        className="apple-search w-full"
                      />
                    </div>

                    {/* SMTP Password */}
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">SMTP Password</label>
                      <div className="relative">
                        <input
                          type={showSmtpPassword ? "text" : "password"}
                          value={tempSmtpSettings.auth.pass}
                          onChange={(e) => setTempSmtpSettings(prev => ({ ...prev, auth: { ...prev.auth, pass: e.target.value } }))}
                          placeholder="password or app password"
                          className="apple-search w-full pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showSmtpPassword ? (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">For Gmail, use an App Password</p>
                    </div>
                  </div>

                  {/* Test Email Recipient */}
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Test Email Recipient</label>
                    <input
                      type="email"
                      value={tempSmtpSettings.testRecipient}
                      onChange={(e) => setTempSmtpSettings(prev => ({ ...prev, testRecipient: e.target.value }))}
                      placeholder="test@example.com"
                      className="apple-search w-full"
                    />
                  </div>

                  {/* Test Email Button */}
                  <div className="pt-2">
                    <button
                      onClick={handleTestEmail}
                      disabled={testingEmail || !tempSmtpSettings.testRecipient}
                      className="apple-button apple-button-secondary"
                    >
                      {testingEmail ? 'Sending...' : 'Test Email Configuration'}
                    </button>
                  </div>

                  {/* Test Result */}
                  {testEmailResult && (
                    <div className={`p-4 rounded-lg text-sm ${
                      testEmailResult.success
                        ? 'bg-green-50 text-green-800 border border-green-200'
                        : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                      {testEmailResult.success ? (
                        <div className="flex items-start gap-2">
                          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span>Test email sent successfully!</span>
                        </div>
                      ) : (
                        <div>
                          <div className="font-medium mb-1">Failed to send test email</div>
                          <div className="text-xs">{testEmailResult.error}</div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="pt-4 flex items-center gap-3 border-t">
                    <button
                      onClick={saveSmtpSettings}
                      disabled={savingSmtpSettings}
                      className="apple-button"
                    >
                      {savingSmtpSettings ? 'Saving...' : 'Save Email Settings'}
                    </button>
                    {smtpSettingsSaved && (
                      <span className="text-sm text-green-600 flex items-center gap-1">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Saved!
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Change Password Section */}
            <div className="border-b pb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Change Password</h2>
              <p className="text-sm text-gray-600 mb-6">
                Update your account password. Make sure to use a strong password with at least 8 characters.
              </p>

              <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="apple-search"
                    required
                    minLength={8}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="apple-search"
                    required
                    minLength={8}
                  />
                  <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="apple-search"
                    required
                    minLength={8}
                  />
                </div>

                {passwordError && (
                  <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
                    {passwordError}
                  </div>
                )}

                {passwordChanged && (
                  <div className="bg-green-50 text-green-700 text-sm p-3 rounded-lg flex items-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Password changed successfully!
                  </div>
                )}

                <button
                  type="submit"
                  disabled={changingPassword}
                  className="apple-button"
                >
                  {changingPassword ? 'Changing Password...' : 'Change Password'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession, authClient, signOut } from '@/lib/auth-client';

const COLUMN_OPTIONS = [
  { key: 'sell', label: 'Sell Price' },
  { key: 'cost', label: 'Cost Price' },
  { key: 'gp', label: 'GP%' },
  { key: 'margin', label: 'Margin' },
  { key: 'gst', label: 'GST' },
  { key: 'lastSold', label: 'Last Sold' },
  { key: 'stock', label: 'Stock' },
];

export default function UsersPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [invitePermissions, setInvitePermissions] = useState(COLUMN_OPTIONS.map(c => c.key));
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');

  // Edit user modal
  const [editingUser, setEditingUser] = useState(null);
  const [editPermissions, setEditPermissions] = useState([]);

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push('/login');
      return;
    }

    if (session?.user?.role !== 'admin') {
      router.push('/');
      return;
    }

    fetchUsers();
  }, [session, isPending, router]);

  const fetchUsers = async () => {
    try {
      const result = await authClient.admin.listUsers({
        query: { limit: 100 },
      });
      if (result.data?.users) {
        setUsers(result.data.users);
      }
    } catch (err) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviteLoading(true);
    setError('');
    setInviteSuccess('');

    try {
      // Generate a temporary password
      const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';

      const result = await authClient.admin.createUser({
        email: inviteEmail,
        name: inviteName,
        password: tempPassword,
        role: inviteRole,
        data: {
          columnPermissions: JSON.stringify(invitePermissions),
          invitedBy: session.user.id,
        },
      });

      if (result.error) {
        setError(result.error.message || 'Failed to invite user');
      } else {
        // User created successfully - now try to send email invitation
        try {
          const emailRes = await fetch('/api/email/send-invitation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: inviteEmail,
              name: inviteName,
              tempPassword: tempPassword
            })
          });

          const emailResult = await emailRes.json();

          if (emailResult.success) {
            setInviteSuccess(
              `User invited successfully! An email has been sent to ${inviteEmail} with login instructions.`
            );
          } else if (emailResult.fallback) {
            // SMTP not configured - show password to admin
            setInviteSuccess(
              `User invited! Email not configured. Temporary password: ${tempPassword}\nPlease share this with the user.`
            );
          } else {
            // Email failed - show password to admin as fallback
            setInviteSuccess(
              `User created but email failed to send.\nTemporary password: ${tempPassword}\nError: ${emailResult.error || 'Unknown error'}\n\nPlease share the password with the user manually.`
            );
          }
        } catch (emailError) {
          // Email API error - show password to admin
          console.error('Email error:', emailError);
          setInviteSuccess(
            `User invited! Email failed to send.\nTemporary password: ${tempPassword}\nPlease share this with the user.`
          );
        }

        // Reset form
        setInviteEmail('');
        setInviteName('');
        setInviteRole('user');
        setInvitePermissions(COLUMN_OPTIONS.map(c => c.key));
        fetchUsers();
      }
    } catch (err) {
      setError(err.message || 'Failed to invite user');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleUpdatePermissions = async () => {
    if (!editingUser) return;

    try {
      // Update user via API
      const res = await fetch('/api/users/update-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingUser.id,
          columnPermissions: editPermissions,
        }),
      });

      if (res.ok) {
        fetchUsers();
        setEditingUser(null);
      } else {
        setError('Failed to update permissions');
      }
    } catch (err) {
      setError('Failed to update permissions');
    }
  };

  const handleToggleRole = async (user) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    try {
      await authClient.admin.setRole({
        userId: user.id,
        role: newRole,
      });
      fetchUsers();
    } catch (err) {
      setError('Failed to update role');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      await authClient.admin.removeUser({ userId });
      fetchUsers();
    } catch (err) {
      setError('Failed to delete user');
    }
  };

  const toggleInvitePermission = (key) => {
    setInvitePermissions(prev =>
      prev.includes(key)
        ? prev.filter(p => p !== key)
        : [...prev, key]
    );
  };

  const toggleEditPermission = (key) => {
    setEditPermissions(prev =>
      prev.includes(key)
        ? prev.filter(p => p !== key)
        : [...prev, key]
    );
  };

  const openEditModal = (user) => {
    const perms = user.columnPermissions
      ? JSON.parse(user.columnPermissions)
      : COLUMN_OPTIONS.map(c => c.key);
    setEditPermissions(perms);
    setEditingUser(user);
  };

  if (isPending || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-6"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Liquid Glass Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-gray-100">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(0,0,0,0.02),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,rgba(0,0,0,0.015),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_80%,rgba(0,0,0,0.01),transparent_50%)]"></div>
      </div>

      {/* Floating Orbs */}
      <div className="absolute top-20 left-20 w-64 h-64 bg-gradient-to-br from-gray-200/30 to-gray-300/20 rounded-full blur-3xl animate-float"></div>
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-gradient-to-br from-gray-300/20 to-gray-200/20 rounded-full blur-3xl animate-float-delayed"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-gray-100/30 to-white/20 rounded-full blur-3xl animate-pulse-slow"></div>

      <div className="relative z-10">
      {/* Glass Header */}
      <header className="sticky top-0 z-30 backdrop-blur-2xl bg-white/60 border-b border-white/80 shadow-lg shadow-gray-900/5">
        <div className="max-w-[1200px] mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="app-title text-2xl text-gray-900">User Management</h1>
              <p className="text-sm text-gray-500 mt-1">Manage users and permissions</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className="glass-button px-6 py-3 bg-white/70 border border-gray-200 hover:bg-white/90 text-gray-700 font-semibold rounded-xl transition-all duration-300 hover:scale-[1.02]"
              >
                Back to Dashboard
              </button>
              <button
                onClick={() => setShowInvite(true)}
                className="glass-button px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/40 hover:scale-[1.02]"
              >
                Invite User
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 py-8 animate-fade-in">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
            {error}
            <button onClick={() => setError('')} className="ml-4 text-red-800">Dismiss</button>
          </div>
        )}

        {inviteSuccess && (
          <div className="bg-green-50 text-green-700 p-4 rounded-lg mb-6">
            <p className="font-medium">{inviteSuccess}</p>
            <p className="text-sm mt-1">Share this password with the user so they can log in.</p>
            <button onClick={() => setInviteSuccess('')} className="mt-2 text-green-800 text-sm underline">Dismiss</button>
          </div>
        )}

        {/* Default Admin Warning */}
        {users.some(u => u.invitedBy === 'system') && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg mb-6">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <p className="font-semibold">Default Admin Account Detected</p>
                <p className="text-sm mt-1">
                  A default admin account (admin@localhost) is active. For security:
                </p>
                <ol className="text-sm mt-2 ml-4 list-decimal space-y-1">
                  <li>Configure SMTP settings (in Settings)</li>
                  <li>Create a new admin account with your email</li>
                  <li>Delete the default admin account</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="glass-card rounded-3xl overflow-hidden animate-scale-in">
          <table className="apple-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Column Access</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const perms = user.columnPermissions
                  ? JSON.parse(user.columnPermissions)
                  : COLUMN_OPTIONS.map(c => c.key);

                const isDefaultAdmin = user.invitedBy === 'system';

                return (
                  <tr key={user.id} className={isDefaultAdmin ? 'bg-yellow-50' : ''}>
                    <td className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{user.name || '—'}</span>
                        {isDefaultAdmin && (
                          <span className="text-xs px-2 py-0.5 bg-yellow-200 text-yellow-800 rounded font-semibold">
                            DEFAULT
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-gray-600">{user.email}</td>
                    <td>
                      <span className={`badge ${user.role === 'admin' ? 'badge-green' : 'badge-gray'}`}>
                        {user.role || 'user'}
                      </span>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {COLUMN_OPTIONS.map(col => (
                          <span
                            key={col.key}
                            className={`text-xs px-2 py-0.5 rounded ${
                              perms.includes(col.key)
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-400 line-through'
                            }`}
                          >
                            {col.label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(user)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Edit
                        </button>
                        {user.id !== session.user.id && (
                          <>
                            <button
                              onClick={() => handleToggleRole(user)}
                              className="text-gray-600 hover:text-gray-800 text-sm"
                            >
                              {user.role === 'admin' ? 'Demote' : 'Promote'}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>

      {/* Invite Modal */}
      {showInvite && (
        <>
          <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-md z-40 animate-fade-in" onClick={() => setShowInvite(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="glass-modal rounded-3xl shadow-2xl w-full max-w-md p-6 animate-scale-in">
              <h2 className="text-lg font-semibold mb-4">Invite New User</h2>

              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="glass-input w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-gray-900 placeholder-gray-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="glass-input w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-gray-900 placeholder-gray-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="glass-input w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-gray-900"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Column Access</label>
                  <div className="grid grid-cols-2 gap-2">
                    {COLUMN_OPTIONS.map(col => (
                      <label key={col.key} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={invitePermissions.includes(col.key)}
                          onChange={() => toggleInvitePermission(col.key)}
                          className="rounded"
                        />
                        {col.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowInvite(false)}
                    className="flex-1 glass-button px-4 py-3 bg-white/70 border border-gray-200 hover:bg-white/90 text-gray-700 font-semibold rounded-xl transition-all duration-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviteLoading}
                    className="flex-1 glass-button px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {inviteLoading ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Edit Permissions Modal */}
      {editingUser && (
        <>
          <div className="fixed inset-0 bg-gray-900/20 backdrop-blur-md z-40 animate-fade-in" onClick={() => setEditingUser(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="glass-modal rounded-3xl shadow-2xl w-full max-w-md p-6 animate-scale-in">
              <h2 className="text-lg font-semibold mb-2">Edit Permissions</h2>
              <p className="text-sm text-gray-500 mb-4">{editingUser.name} ({editingUser.email})</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Column Access</label>
                  <div className="grid grid-cols-2 gap-2">
                    {COLUMN_OPTIONS.map(col => (
                      <label key={col.key} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={editPermissions.includes(col.key)}
                          onChange={() => toggleEditPermission(col.key)}
                          className="rounded"
                        />
                        {col.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="flex-1 glass-button px-4 py-3 bg-white/70 border border-gray-200 hover:bg-white/90 text-gray-700 font-semibold rounded-xl transition-all duration-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdatePermissions}
                    className="flex-1 glass-button px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/40"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
}

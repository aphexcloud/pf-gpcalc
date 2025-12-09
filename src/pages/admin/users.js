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
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="apple-header sticky top-0 z-30">
        <div className="max-w-[1200px] mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="app-title text-2xl text-gray-900">User Management</h1>
              <p className="text-sm text-gray-500 mt-1">Manage users and permissions</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className="apple-button-secondary apple-button"
              >
                Back to Dashboard
              </button>
              <button
                onClick={() => setShowInvite(true)}
                className="apple-button"
              >
                Invite User
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 py-8">
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

        {/* Users Table */}
        <div className="apple-card overflow-hidden">
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

                return (
                  <tr key={user.id}>
                    <td className="font-medium">{user.name || '—'}</td>
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
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowInvite(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <h2 className="text-lg font-semibold mb-4">Invite New User</h2>

              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="apple-search"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="apple-search"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="apple-search"
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
                    className="flex-1 apple-button apple-button-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviteLoading}
                    className="flex-1 apple-button"
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
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setEditingUser(null)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
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
                    className="flex-1 apple-button apple-button-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdatePermissions}
                    className="flex-1 apple-button"
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
  );
}

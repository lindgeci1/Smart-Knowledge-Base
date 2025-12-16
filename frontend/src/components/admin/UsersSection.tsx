import React, { useState } from 'react';
import { Search, Plus, Trash2, Edit2, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
interface UserData {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive';
  joinedAt: string;
}
interface UserUsage {
  userId: string;
  count: number;
  percentage: number;
}
interface UsersSectionProps {
  users: UserData[];
  getUserUsage: (userId: string) => UserUsage;
  getUsageColor: (percentage: number) => string;
}
export function UsersSection({
  users: initialUsers,
  getUserUsage,
  getUsageColor
}: UsersSectionProps) {
  const [users, setUsers] = useState(initialUsers);
  const [isCreating, setIsCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserData | null>(null);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    role: 'user' as const
  });
  const handleDelete = () => {
    if (!deletingUser) return;
    setUsers(users.filter(u => u.id !== deletingUser.id));
    setDeletingUser(null);
  };
  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const user: UserData = {
      id: Math.random().toString(36).substr(2, 9),
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      status: 'active',
      joinedAt: new Date().toISOString()
    };
    setUsers([user, ...users]);
    setIsCreating(false);
    setNewUser({
      name: '',
      email: '',
      role: 'user'
    });
  };
  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setUsers(users.map(u => u.id === editingUser.id ? editingUser : u));
    setEditingUser(null);
  };
  const startEdit = (user: UserData) => {
    setEditingUser({
      ...user
    });
  };
  return <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
        <Button onClick={() => setIsCreating(!isCreating)}>
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Create Modal */}
      {isCreating && <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 mb-6">
          <h3 className="text-lg font-medium mb-4">Create New User</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Name" value={newUser.name} onChange={e => setNewUser({
            ...newUser,
            name: e.target.value
          })} required />
              <Input label="Email" type="email" value={newUser.email} onChange={e => setNewUser({
            ...newUser,
            email: e.target.value
          })} required />
            </div>
            <div className="flex justify-end space-x-3">
              <Button type="button" variant="ghost" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button type="submit">Create User</Button>
            </div>
          </form>
        </div>}

      {/* Edit Modal */}
      {editingUser && <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Edit User</h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleEdit} className="space-y-4">
              <Input label="Name" value={editingUser.name} onChange={e => setEditingUser({
            ...editingUser,
            name: e.target.value
          })} required />
              <Input label="Email" type="email" value={editingUser.email} onChange={e => setEditingUser({
            ...editingUser,
            email: e.target.value
          })} required />
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Status
                </label>
                <select value={editingUser.status} onChange={e => setEditingUser({
              ...editingUser,
              status: e.target.value as 'active' | 'inactive'
            })} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <Button type="button" variant="ghost" onClick={() => setEditingUser(null)}>
                  Cancel
                </Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          </div>
        </div>}

      {/* Delete Modal */}
      {deletingUser && <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Delete User</h3>
              <button onClick={() => setDeletingUser(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-6">
              <p className="text-sm text-slate-600">
                Are you sure you want to delete{' '}
                <span className="font-semibold text-slate-900">
                  {deletingUser.name}
                </span>{' '}
                ({deletingUser.email})? This action cannot be undone.
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <Button type="button" variant="ghost" onClick={() => setDeletingUser(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
                Delete User
              </Button>
            </div>
          </div>
        </div>}

      <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div className="relative w-full max-w-md">
            <input type="text" placeholder="Search users..." className="w-full pl-9 pr-4 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Usage
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {users.map(userData => {
              const usage = getUserUsage(userData.id);
              return <tr key={userData.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                          {userData.name.charAt(0)}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-slate-900">
                            {userData.name}
                          </div>
                          <div className="text-sm text-slate-500">
                            {userData.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${userData.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                        {userData.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${userData.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {userData.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="flex-1 min-w-[80px]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-slate-700">
                              {usage.percentage}%
                            </span>
                            <span className="text-xs text-slate-500">
                              {usage.count} credits
                            </span>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${getUsageColor(usage.percentage)}`} style={{
                          width: `${usage.percentage}%`
                        }} />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => startEdit(userData)} className="text-indigo-600 hover:text-indigo-900 mr-3" title="Edit">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => setDeletingUser(userData)} className="text-red-600 hover:text-red-900" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>;
            })}
            </tbody>
          </table>
        </div>
      </div>
    </div>;
}
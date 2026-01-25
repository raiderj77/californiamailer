'use client';

import { useAuth } from '@/lib/AuthContext';
import Sidebar from '@/components/Sidebar';
import { useState, useEffect } from 'react';
import { VATask, getVATasks, addVATask, updateVATask, deleteVATask } from '@/lib/firestore';
import { downloadCSV } from '@/lib/csv';

type TaskPriority = 'low' | 'medium' | 'high';
type TaskStatus = 'pending' | 'in-progress' | 'completed';

interface FormData {
  title: string;
  description: string;
  assignee: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
}

const emptyForm: FormData = {
  title: '',
  description: '',
  assignee: '',
  priority: 'medium',
  status: 'pending',
  dueDate: '',
};

export default function TasksPage() {
  const { user, loading, logout } = useAuth();
  const [tasks, setTasks] = useState<VATask[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<VATask | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  
  // Filters
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user) {
      loadTasks();
    }
  }, [user]);

  async function loadTasks() {
    if (!user) return;
    const data = await getVATasks(user.uid);
    setTasks(data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (editing) {
      await updateVATask(editing.id!, formData);
    } else {
      await addVATask({ ...formData, userId: user.uid });
    }

    setShowForm(false);
    setEditing(null);
    setFormData(emptyForm);
    loadTasks();
  }

  async function handleDelete(id: string) {
    if (confirm('Delete this task?')) {
      await deleteVATask(id);
      loadTasks();
    }
  }

  async function toggleStatus(task: VATask) {
    const newStatus: TaskStatus = task.status === 'completed' ? 'pending' : 
                                   task.status === 'pending' ? 'in-progress' : 'completed';
    await updateVATask(task.id!, { status: newStatus });
    loadTasks();
  }

  function openEdit(task: VATask) {
    setEditing(task);
    setFormData({
      title: task.title,
      description: task.description,
      assignee: task.assignee,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate,
    });
    setShowForm(true);
  }

  function resetForm() {
    setShowForm(true);
    setEditing(null);
    setFormData(emptyForm);
  }

  const priorityColors: Record<string, string> = {
    low: 'bg-gray-100 text-gray-700',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-red-100 text-red-700',
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-700',
    'in-progress': 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
  };

  // Filter and search
  const filteredTasks = tasks.filter(t => {
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return t.title.toLowerCase().includes(query) || 
             t.assignee.toLowerCase().includes(query) ||
             t.description.toLowerCase().includes(query);
    }
    return true;
  });

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>;
  }

  if (!user) {
    return <div className="min-h-screen flex items-center justify-center"><p>Please sign in</p></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <div className="flex-1">
        <header className="bg-white shadow-sm">
          <div className="px-6 py-4 flex justify-between items-center">
            <h1 className="text-xl font-bold text-gray-900">CaliforniaMailer</h1>
            <div className="flex items-center gap-4">
              <span className="text-gray-600">{user.email}</span>
              <button onClick={logout} className="text-gray-500 hover:text-gray-700">Sign out</button>
            </div>
          </div>
        </header>
        <main className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">VA Tasks</h2>
            <button onClick={resetForm} className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700">
              + Add Task
            </button>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
            <div className="flex gap-4 items-center flex-wrap">
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm w-64"
              />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">All Priorities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <span className="text-sm text-gray-500">
                Showing {filteredTasks.length} of {tasks.length}
              </span>
              <button
                onClick={() => downloadCSV(filteredTasks.map(t => ({
                  'Title': t.title,
                  'Description': t.description,
                  'Assignee': t.assignee,
                  'Priority': t.priority,
                  'Status': t.status,
                  'Due Date': t.dueDate,
                })), 'va-tasks')}
                className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-200"
              >
                Export CSV
              </button>
            </div>
          </div>

          {showForm && (
            <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
              <h3 className="text-lg font-medium mb-4">{editing ? 'Edit Task' : 'New Task'}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">Title</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Assignee</label>
                    <input
                      type="text"
                      value={formData.assignee}
                      onChange={(e) => setFormData({ ...formData, assignee: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="VA name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Due Date</label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Priority</label>
                    <select
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskStatus })}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="pending">Pending</option>
                      <option value="in-progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    rows={3}
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700">
                    {editing ? 'Update' : 'Save'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="bg-gray-200 px-4 py-2 rounded-lg">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {filteredTasks.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <p className="text-gray-500">
                {tasks.length === 0 ? 'No tasks yet. Add your first VA task.' : 'No tasks match the current filters.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Task</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Assignee</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Due Date</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Priority</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Status</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredTasks.map((t) => (
                    <tr key={t.id} className={t.status === 'completed' ? 'bg-gray-50' : ''}>
                      <td className="px-4 py-3">
                        <div className={t.status === 'completed' ? 'line-through text-gray-400' : ''}>{t.title}</div>
                        {t.description && <div className="text-sm text-gray-500 truncate max-w-xs">{t.description}</div>}
                      </td>
                      <td className="px-4 py-3">{t.assignee || '-'}</td>
                      <td className="px-4 py-3">{t.dueDate || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${priorityColors[t.priority]}`}>
                          {t.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button 
                          onClick={() => toggleStatus(t)}
                          className={`px-2 py-1 rounded text-xs ${statusColors[t.status]}`}
                        >
                          {t.status}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => openEdit(t)} className="text-blue-600 hover:underline mr-3">Edit</button>
                        <button onClick={() => handleDelete(t.id!)} className="text-red-600 hover:underline">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

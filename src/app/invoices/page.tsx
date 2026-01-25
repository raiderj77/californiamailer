'use client';

import { useAuth } from '@/lib/AuthContext';
import Sidebar from '@/components/Sidebar';
import { useState, useEffect } from 'react';
import { Invoice, InvoiceItem, getInvoices, addInvoice, updateInvoice, deleteInvoice, Campaign, getCampaigns } from '@/lib/firestore';
import { downloadCSV } from '@/lib/csv';

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';

interface FormData {
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  campaignId: string;
  campaignName: string;
  items: InvoiceItem[];
  tax: number;
  status: InvoiceStatus;
  dueDate: string;
  notes: string;
}

const emptyItem: InvoiceItem = { description: '', quantity: 1, unitPrice: 0, total: 0 };

const emptyForm: FormData = {
  invoiceNumber: '',
  clientName: '',
  clientEmail: '',
  clientAddress: '',
  campaignId: '',
  campaignName: '',
  items: [{ ...emptyItem }],
  tax: 0,
  status: 'draft',
  dueDate: '',
  notes: '',
};

export default function InvoicesPage() {
  const { user, loading, logout } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  async function loadData() {
    if (!user) return;
    const [i, c] = await Promise.all([
      getInvoices(user.uid),
      getCampaigns(user.uid),
    ]);
    setInvoices(i);
    setCampaigns(c);
  }

  function generateInvoiceNumber() {
    const date = new Date();
    const num = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `INV-${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}-${num}`;
  }

  function handleCampaignChange(campaignId: string) {
    const campaign = campaigns.find(c => c.id === campaignId);
    setFormData({
      ...formData,
      campaignId,
      campaignName: campaign?.name || '',
    });
  }

  function updateItem(index: number, field: keyof InvoiceItem, value: string | number) {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    newItems[index].total = newItems[index].quantity * newItems[index].unitPrice;
    setFormData({ ...formData, items: newItems });
  }

  function addItem() {
    setFormData({ ...formData, items: [...formData.items, { ...emptyItem }] });
  }

  function removeItem(index: number) {
    if (formData.items.length > 1) {
      setFormData({ ...formData, items: formData.items.filter((_, i) => i !== index) });
    }
  }

  const subtotal = formData.items.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = subtotal * (formData.tax / 100);
  const total = subtotal + taxAmount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const invoiceData = {
      ...formData,
      subtotal,
      tax: formData.tax,
      total,
      userId: user.uid,
    };

    if (editing) {
      await updateInvoice(editing.id!, invoiceData);
    } else {
      await addInvoice(invoiceData);
    }

    setShowForm(false);
    setEditing(null);
    setFormData(emptyForm);
    loadData();
  }

  async function handleDelete(id: string) {
    if (confirm('Delete this invoice?')) {
      await deleteInvoice(id);
      loadData();
    }
  }

  function openEdit(invoice: Invoice) {
    setEditing(invoice);
    setFormData({
      invoiceNumber: invoice.invoiceNumber,
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail,
      clientAddress: invoice.clientAddress,
      campaignId: invoice.campaignId,
      campaignName: invoice.campaignName,
      items: invoice.items,
      tax: invoice.tax,
      status: invoice.status,
      dueDate: invoice.dueDate,
      notes: invoice.notes,
    });
    setShowForm(true);
  }

  function resetForm() {
    setShowForm(true);
    setEditing(null);
    setFormData({ ...emptyForm, invoiceNumber: generateInvoiceNumber() });
  }

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    sent: 'bg-blue-100 text-blue-700',
    paid: 'bg-green-100 text-green-700',
    overdue: 'bg-red-100 text-red-700',
  };

  const filteredInvoices = invoices.filter(i => {
    if (filterStatus !== 'all' && i.status !== filterStatus) return false;
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
            <h2 className="text-2xl font-bold text-gray-900">Invoices</h2>
            <button onClick={resetForm} className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
              + New Invoice
            </button>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
            <div className="flex gap-4 items-center">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
              <span className="text-sm text-gray-500">
                Showing {filteredInvoices.length} of {invoices.length}
              </span>
              <button
                onClick={() => downloadCSV(filteredInvoices.map(i => ({
                  'Invoice #': i.invoiceNumber,
                  'Client': i.clientName,
                  'Campaign': i.campaignName,
                  'Subtotal': i.subtotal,
                  'Tax': i.tax,
                  'Total': i.total,
                  'Status': i.status,
                  'Due Date': i.dueDate,
                })), 'invoices')}
                className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-200"
              >
                Export CSV
              </button>
            </div>
          </div>

          {viewInvoice && (
            <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold">INVOICE</h3>
                  <p className="text-gray-500">{viewInvoice.invoiceNumber}</p>
                </div>
                <button onClick={() => setViewInvoice(null)} className="text-gray-500">✕</button>
              </div>
              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <h4 className="font-medium text-gray-500 mb-1">Bill To:</h4>
                  <p className="font-medium">{viewInvoice.clientName}</p>
                  <p className="text-sm text-gray-600">{viewInvoice.clientEmail}</p>
                  <p className="text-sm text-gray-600 whitespace-pre-line">{viewInvoice.clientAddress}</p>
                </div>
                <div className="text-right">
                  <p><span className="text-gray-500">Campaign:</span> {viewInvoice.campaignName}</p>
                  <p><span className="text-gray-500">Due Date:</span> {viewInvoice.dueDate}</p>
                  <span className={`inline-block mt-2 px-3 py-1 rounded text-sm ${statusColors[viewInvoice.status]}`}>
                    {viewInvoice.status.toUpperCase()}
                  </span>
                </div>
              </div>
              <table className="w-full mb-6">
                <thead className="border-b">
                  <tr>
                    <th className="text-left py-2">Description</th>
                    <th className="text-right py-2">Qty</th>
                    <th className="text-right py-2">Price</th>
                    <th className="text-right py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {viewInvoice.items.map((item, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-2">{item.description}</td>
                      <td className="text-right py-2">{item.quantity}</td>
                      <td className="text-right py-2">${item.unitPrice.toFixed(2)}</td>
                      <td className="text-right py-2">${item.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end">
                <div className="w-64">
                  <div className="flex justify-between py-1">
                    <span>Subtotal:</span>
                    <span>${viewInvoice.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Tax ({viewInvoice.tax}%):</span>
                    <span>${(viewInvoice.subtotal * viewInvoice.tax / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-t font-bold text-lg">
                    <span>Total:</span>
                    <span>${viewInvoice.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
              {viewInvoice.notes && (
                <div className="mt-6 pt-4 border-t">
                  <h4 className="font-medium text-gray-500 mb-1">Notes:</h4>
                  <p className="text-sm text-gray-600">{viewInvoice.notes}</p>
                </div>
              )}
              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Print
                </button>
                <button
                  onClick={() => { openEdit(viewInvoice); setViewInvoice(null); }}
                  className="bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  Edit
                </button>
              </div>
            </div>
          )}

          {showForm && (
            <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
              <h3 className="text-lg font-medium mb-4">{editing ? 'Edit Invoice' : 'New Invoice'}</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Invoice #</label>
                    <input
                      type="text"
                      value={formData.invoiceNumber}
                      onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Campaign</label>
                    <select
                      value={formData.campaignId}
                      onChange={(e) => handleCampaignChange(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="">Select campaign...</option>
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as InvoiceStatus })}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="paid">Paid</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Client Name</label>
                    <input
                      type="text"
                      value={formData.clientName}
                      onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Client Email</label>
                    <input
                      type="email"
                      value={formData.clientEmail}
                      onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Client Address</label>
                    <textarea
                      value={formData.clientAddress}
                      onChange={(e) => setFormData({ ...formData, clientAddress: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      rows={2}
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
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Line Items</label>
                  <div className="space-y-2">
                    {formData.items.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          className="col-span-5 border rounded-lg px-3 py-2"
                        />
                        <input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 0)}
                          className="col-span-2 border rounded-lg px-3 py-2"
                        />
                        <input
                          type="number"
                          placeholder="Price"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="col-span-2 border rounded-lg px-3 py-2"
                          step="0.01"
                        />
                        <div className="col-span-2 text-right font-medium">${item.total.toFixed(2)}</div>
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="col-span-1 text-red-600 hover:text-red-800"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={addItem} className="mt-2 text-blue-600 hover:underline text-sm">
                    + Add Line Item
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Tax Rate (%)</label>
                    <input
                      type="number"
                      value={formData.tax}
                      onChange={(e) => setFormData({ ...formData, tax: parseFloat(e.target.value) || 0 })}
                      className="w-full border rounded-lg px-3 py-2"
                      step="0.1"
                    />
                  </div>
                  <div className="flex flex-col justify-end text-right">
                    <div className="text-sm text-gray-500">Subtotal: ${subtotal.toFixed(2)}</div>
                    <div className="text-sm text-gray-500">Tax: ${taxAmount.toFixed(2)}</div>
                    <div className="text-lg font-bold">Total: ${total.toFixed(2)}</div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full border rounded-lg px-3 py-2"
                    rows={2}
                  />
                </div>

                <div className="flex gap-2">
                  <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                    {editing ? 'Update' : 'Save'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="bg-gray-200 px-4 py-2 rounded-lg">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {!showForm && !viewInvoice && filteredInvoices.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <p className="text-gray-500">No invoices yet. Create your first invoice.</p>
            </div>
          ) : !showForm && !viewInvoice && (
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Invoice #</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Client</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Campaign</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Total</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Due</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Status</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredInvoices.map((i) => (
                    <tr key={i.id}>
                      <td className="px-4 py-3 font-medium">{i.invoiceNumber}</td>
                      <td className="px-4 py-3">{i.clientName}</td>
                      <td className="px-4 py-3">{i.campaignName || '-'}</td>
                      <td className="px-4 py-3">${i.total.toFixed(2)}</td>
                      <td className="px-4 py-3">{i.dueDate || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs ${statusColors[i.status]}`}>
                          {i.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setViewInvoice(i)} className="text-blue-600 hover:underline mr-3">View</button>
                        <button onClick={() => openEdit(i)} className="text-blue-600 hover:underline mr-3">Edit</button>
                        <button onClick={() => handleDelete(i.id!)} className="text-red-600 hover:underline">Delete</button>
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

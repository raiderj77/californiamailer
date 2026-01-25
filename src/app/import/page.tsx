'use client';

import { useAuth } from '@/lib/AuthContext';
import Sidebar from '@/components/Sidebar';
import { useState } from 'react';
import { parseCSV } from '@/lib/csv';
import { addProspect, addTerritory } from '@/lib/firestore';

type ImportType = 'prospects' | 'territories';

export default function ImportPage() {
  const { user, loading, logout } = useAuth();
  const [importType, setImportType] = useState<ImportType>('prospects');
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{ success: number; failed: number } | null>(null);
  const [error, setError] = useState('');

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError('');
    setResults(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const data = parseCSV(text);
      if (data.length === 0) {
        setError('No data found in CSV file');
        return;
      }
      setCsvData(data);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!user || csvData.length === 0) return;

    setImporting(true);
    setResults(null);
    let success = 0;
    let failed = 0;

    for (const row of csvData) {
      try {
        if (importType === 'prospects') {
          await addProspect({
            businessName: row['Business Name'] || row['businessName'] || row['business_name'] || '',
            contactName: row['Contact Name'] || row['contactName'] || row['contact_name'] || '',
            email: row['Email'] || row['email'] || '',
            phone: row['Phone'] || row['phone'] || '',
            address: row['Address'] || row['address'] || '',
            city: row['City'] || row['city'] || '',
            territoryId: row['Territory ID'] || row['territoryId'] || '',
            territoryName: row['Territory'] || row['territoryName'] || '',
            status: (row['Status'] || row['status'] || 'new') as any,
            notes: row['Notes'] || row['notes'] || '',
            userId: user.uid,
          });
          success++;
        } else {
          await addTerritory({
            name: row['Name'] || row['name'] || '',
            county: row['County'] || row['county'] || '',
            cities: row['Cities'] || row['cities'] || '',
            households: parseInt(row['Households'] || row['households'] || '0') || 0,
            avgIncome: parseInt(row['Avg Income'] || row['avgIncome'] || row['avg_income'] || '0') || 0,
            status: (row['Status'] || row['status'] || 'research') as any,
            notes: row['Notes'] || row['notes'] || '',
            userId: user.uid,
          });
          success++;
        }
      } catch (err) {
        failed++;
        console.error('Import error:', err);
      }
    }

    setResults({ success, failed });
    setImporting(false);
    setCsvData([]);
    setFileName('');
  }

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
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Import Data</h2>

          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-medium mb-4">1. Select Import Type</h3>
            <div className="flex gap-4">
              <button
                onClick={() => setImportType('prospects')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  importType === 'prospects' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                Prospects
              </button>
              <button
                onClick={() => setImportType('territories')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  importType === 'territories' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
                }`}
              >
                Territories
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-medium mb-4">2. Required CSV Columns</h3>
            {importType === 'prospects' ? (
              <div className="bg-gray-50 rounded-lg p-4">
                <code className="text-sm">
                  Business Name, Contact Name, Email, Phone, Address, City, Territory, Status, Notes
                </code>
                <p className="text-sm text-gray-500 mt-2">
                  Status values: new, contacted, interested, proposal, closed, lost
                </p>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg p-4">
                <code className="text-sm">
                  Name, County, Cities, Households, Avg Income, Status, Notes
                </code>
                <p className="text-sm text-gray-500 mt-2">
                  Status values: active, research, inactive
                </p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-medium mb-4">3. Upload CSV File</h3>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {fileName && (
              <p className="mt-2 text-sm text-gray-600">Selected: {fileName}</p>
            )}
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          {csvData.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
              <h3 className="text-lg font-medium mb-4">4. Preview ({csvData.length} rows)</h3>
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {Object.keys(csvData[0]).map((key) => (
                        <th key={key} className="text-left px-3 py-2 font-medium text-gray-700">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {csvData.slice(0, 10).map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-3 py-2 truncate max-w-xs">
                            {val}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {csvData.length > 10 && (
                <p className="text-sm text-gray-500 mt-2">Showing first 10 of {csvData.length} rows</p>
              )}
              <button
                onClick={handleImport}
                disabled={importing}
                className="mt-4 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
              >
                {importing ? 'Importing...' : `Import ${csvData.length} ${importType}`}
              </button>
            </div>
          )}

          {results && (
            <div className={`rounded-lg p-6 ${results.failed > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
              <h3 className="text-lg font-medium mb-2">Import Complete</h3>
              <p className="text-green-700">✓ {results.success} {importType} imported successfully</p>
              {results.failed > 0 && (
                <p className="text-red-700">✗ {results.failed} failed to import</p>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

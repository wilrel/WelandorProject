'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';
import { getImports, initAuth } from '@/lib/api';

export default function ImportsHistoryPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      await initAuth();
      try {
        const data = await getImports();
        setJobs(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case 'COMPLETED': return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full flex items-center"><CheckCircle className="w-3 h-3 mr-1"/> Completed</span>;
      case 'FAILED': return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full flex items-center"><XCircle className="w-3 h-3 mr-1"/> Failed</span>;
      default: return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full flex items-center"><Clock className="w-3 h-3 mr-1"/> {status}</span>;
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Import History</h1>
          <p className="text-gray-500 text-sm mt-1">View past imports of your transaction data from CSV or Excel.</p>
        </div>
        <Link href="/imports/new" className="bg-indigo-600 text-white px-4 py-2 rounded-md flex items-center hover:bg-indigo-700 transition">
          <Plus className="w-5 h-5 mr-2" />
          New Import
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rows Imported</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={4} className="px-6 py-4 text-center text-gray-500">Loading...</td></tr>
            ) : jobs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-gray-500 flex flex-col items-center">
                  <FileText className="w-10 h-10 text-gray-300 mb-2"/>
                  No imports found. Start by creating a new import.
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 flex items-center">
                    <FileText className="w-4 h-4 text-gray-400 mr-2" />
                    {job.filename}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(job.created_at).toLocaleString('id-ID')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {job.imported_rows} / {job.total_rows}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

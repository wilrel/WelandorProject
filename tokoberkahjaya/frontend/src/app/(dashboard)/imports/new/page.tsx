'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadImportFile, validateImportMapping, confirmImport } from '@/lib/api';
import { Upload, ArrowRight, CheckCircle, AlertTriangle, FileText } from 'lucide-react';

export default function NewImportPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  
  // Job Data
  const [jobId, setJobId] = useState<number | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  
  // Validation Data
  const [validationResult, setValidationResult] = useState<any>(null);

  // Mapping
  const [mapping, setMapping] = useState({
    date_col: '',
    sku_col: '',
    quantity_col: '',
    price_col: ''
  });

  const [loading, setLoading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await uploadImportFile(file);
      setJobId(res.job_id);
      setColumns(res.columns);
      setPreviewData(res.preview_data);
      setStep(2);
    } catch (e: any) {
      alert("Failed to upload: " + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!jobId) return;
    if (!mapping.date_col || !mapping.sku_col || !mapping.quantity_col || !mapping.price_col) {
      alert("Please map all required columns!");
      return;
    }
    setLoading(true);
    try {
      const res = await validateImportMapping(jobId, mapping);
      setValidationResult(res);
      setStep(3);
    } catch (e: any) {
      alert("Failed to validate: " + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      await confirmImport(jobId, mapping);
      setStep(4);
    } catch (e: any) {
      alert("Failed to confirm: " + (e.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Import Transaction Data</h1>
        <div className="flex items-center mt-4">
          <div className={`text-sm font-medium ${step >= 1 ? 'text-indigo-600' : 'text-gray-400'}`}>1. Upload</div>
          <div className={`flex-1 h-0.5 mx-4 ${step >= 2 ? 'bg-indigo-600' : 'bg-gray-200'}`}></div>
          <div className={`text-sm font-medium ${step >= 2 ? 'text-indigo-600' : 'text-gray-400'}`}>2. Map Columns</div>
          <div className={`flex-1 h-0.5 mx-4 ${step >= 3 ? 'bg-indigo-600' : 'bg-gray-200'}`}></div>
          <div className={`text-sm font-medium ${step >= 3 ? 'text-indigo-600' : 'text-gray-400'}`}>3. Validate</div>
          <div className={`flex-1 h-0.5 mx-4 ${step >= 4 ? 'bg-indigo-600' : 'bg-gray-200'}`}></div>
          <div className={`text-sm font-medium ${step >= 4 ? 'text-indigo-600' : 'text-gray-400'}`}>4. Result</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 p-8">
        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="text-center">
            <Upload className="w-16 h-16 text-indigo-200 mx-auto mb-4" />
            <h2 className="text-lg font-medium text-gray-900 mb-2">Upload your file</h2>
            <p className="text-gray-500 text-sm mb-6">Supports .csv or .xlsx files.</p>
            
            <input 
              type="file" 
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 mb-6 mx-auto max-w-sm"
            />
            
            <button 
              onClick={handleUpload}
              disabled={!file || loading}
              className="bg-indigo-600 text-white px-6 py-2 rounded-md disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-indigo-700 flex items-center mx-auto"
            >
              {loading ? "Uploading..." : "Continue to Mapping"} <ArrowRight className="w-4 h-4 ml-2" />
            </button>
          </div>
        )}

        {/* Step 2: Map Columns */}
        {step === 2 && (
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-6">Map Columns</h2>
            <div className="grid grid-cols-2 gap-6 mb-8">
              {['date', 'sku', 'quantity', 'price'].map((field) => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">{field} Column <span className="text-red-500">*</span></label>
                  <select 
                    className="block w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    value={(mapping as any)[`${field}_col`]}
                    onChange={(e) => setMapping({...mapping, [`${field}_col`]: e.target.value})}
                  >
                    <option value="">Select column...</option>
                    {columns.map(col => <option key={col} value={col}>{col}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div className="bg-gray-50 p-4 rounded-lg mb-6 overflow-x-auto">
              <h3 className="text-sm font-medium text-gray-900 mb-2">File Preview (First 5 Rows)</h3>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    {columns.map(col => <th key={col} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">{col}</th>)}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {previewData.map((row, i) => (
                    <tr key={i}>
                      {columns.map(col => <td key={col} className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{row[col]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(1)} className="text-gray-600 px-4 py-2 hover:bg-gray-100 rounded-md">Back</button>
              <button 
                onClick={handleValidate}
                disabled={loading}
                className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 disabled:bg-gray-300 flex items-center"
              >
                {loading ? "Validating..." : "Validate Data"} <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Validate Result */}
        {step === 3 && validationResult && (
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-6">Validation Result</h2>
            
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-center">
                <div className="text-2xl font-bold text-gray-900">{validationResult.total_rows}</div>
                <div className="text-sm text-gray-500">Total Rows</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200 text-center">
                <div className="text-2xl font-bold text-green-700">{validationResult.total_rows - validationResult.error_rows}</div>
                <div className="text-sm text-green-600">Valid Rows</div>
              </div>
              <div className={`p-4 rounded-lg border text-center ${validationResult.error_rows > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className={`text-2xl font-bold ${validationResult.error_rows > 0 ? 'text-red-700' : 'text-gray-900'}`}>{validationResult.error_rows}</div>
                <div className={`text-sm ${validationResult.error_rows > 0 ? 'text-red-600' : 'text-gray-500'}`}>Errors</div>
              </div>
            </div>

            {validationResult.errors.length > 0 && (
              <div className="mb-6 border border-red-200 rounded-lg overflow-hidden">
                <div className="bg-red-50 px-4 py-3 border-b border-red-200 flex items-center text-red-800 font-medium text-sm">
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Showing {Math.min(validationResult.errors.length, 10)} errors
                </div>
                <div className="bg-white max-h-64 overflow-y-auto">
                  <ul className="divide-y divide-gray-100">
                    {validationResult.errors.slice(0, 10).map((err: any) => (
                      <li key={err.id} className="p-4">
                        <div className="text-sm font-medium text-red-600 mb-1">Row {err.row_number}: {err.error_message}</div>
                        <div className="text-xs text-gray-500 font-mono bg-gray-50 p-2 rounded">{err.raw_data}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {validationResult.error_rows === validationResult.total_rows ? (
              <div className="text-center p-4 bg-red-50 rounded-lg text-red-700 font-medium mb-6">
                All rows have errors. You cannot proceed. Please fix your file and try again.
              </div>
            ) : (
              <p className="text-gray-600 text-sm mb-6">
                {validationResult.error_rows > 0 
                  ? "Rows with errors will be skipped. Only valid rows will be imported."
                  : "All rows are valid and ready to be imported."}
              </p>
            )}

            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="text-gray-600 px-4 py-2 hover:bg-gray-100 rounded-md">Back</button>
              <button 
                onClick={handleConfirm}
                disabled={loading || validationResult.error_rows === validationResult.total_rows}
                className="bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-300 flex items-center"
              >
                {loading ? "Importing..." : "Confirm & Import"} <CheckCircle className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && (
          <div className="text-center py-10">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Import Successful!</h2>
            <p className="text-gray-500 mb-8">Your transactions and inventory have been updated.</p>
            
            <div className="flex justify-center space-x-4">
              <button onClick={() => router.push('/imports')} className="text-indigo-600 bg-indigo-50 px-4 py-2 rounded-md hover:bg-indigo-100 font-medium">View History</button>
              <button onClick={() => router.push('/products')} className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 font-medium">Go to Products</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

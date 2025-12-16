import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';
import { FileText, Upload, MessageSquare, CheckCircle2, X, Loader2 } from 'lucide-react';
interface Summary {
  id: string;
  userId: string;
  userName: string;
  type: 'text' | 'file';
  content: string;
  summary: string;
  createdAt: string;
  filename?: string;
}
export function SummarizeSection() {
  const {
    user,
    updateUserUsage
  } = useAuth();
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');
  const [textInput, setTextInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentResult, setCurrentResult] = useState<Summary | null>(null);
  const saveSummary = (newSummary: Summary) => {
    try {
      const stored = localStorage.getItem('app_summaries');
      const allSummaries: Summary[] = stored ? JSON.parse(stored) : [];
      const updated = [newSummary, ...allSummaries];
      localStorage.setItem('app_summaries', JSON.stringify(updated));
      setCurrentResult(newSummary);
    } catch (error) {
      console.error('Failed to save summary', error);
    }
  };
  const handleSummarizeText = async () => {
    if (!textInput.trim() || !user) return;
    setIsProcessing(true);
    setCurrentResult(null);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const summaryText = textInput.length > 100 ? textInput.substring(0, 100) + '... [Summary: Key points extracted successfully]' : textInput + ' [Summary: Short text analyzed]';
    const newSummary: Summary = {
      id: Math.random().toString(36).substr(2, 9),
      userId: user.id,
      userName: user.name,
      type: 'text',
      content: textInput.substring(0, 50) + (textInput.length > 50 ? '...' : ''),
      summary: summaryText,
      createdAt: new Date().toISOString()
    };
    saveSummary(newSummary);
    updateUserUsage(10);
    setIsProcessing(false);
    setTextInput('');
  };
  const handleFileUpload = async () => {
    if (!selectedFile || !user) return;
    setIsProcessing(true);
    setCurrentResult(null);
    await new Promise(resolve => setTimeout(resolve, 2000));
    const summaryText = `Analysis of ${selectedFile.name}: Document contains structured data and key insights regarding the topic.`;
    const newSummary: Summary = {
      id: Math.random().toString(36).substr(2, 9),
      userId: user.id,
      userName: user.name,
      type: 'file',
      content: selectedFile.name,
      filename: selectedFile.name,
      summary: summaryText,
      createdAt: new Date().toISOString()
    };
    saveSummary(newSummary);
    updateUserUsage(10);
    setIsProcessing(false);
    setSelectedFile(null);
  };
  return <div className="space-y-6 animate-in fade-in duration-500">
      <h2 className="text-2xl font-bold text-slate-900">Admin Summarization</h2>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-200">
          <div className="flex">
            <button onClick={() => setActiveTab('text')} className={`flex-1 py-4 text-sm font-medium text-center transition-colors flex items-center justify-center ${activeTab === 'text' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Text Summary
            </button>
            <button onClick={() => setActiveTab('file')} className={`flex-1 py-4 text-sm font-medium text-center transition-colors flex items-center justify-center ${activeTab === 'file' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
              <Upload className="h-4 w-4 mr-2" />
              File Upload
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'text' ? <div className="space-y-4">
              <div>
                <label htmlFor="text-input" className="block text-sm font-medium text-slate-700 mb-2">
                  Paste your text below
                </label>
                <textarea id="text-input" rows={6} className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-3 border resize-none" placeholder="Enter text to summarize (min 50 characters)..." value={textInput} onChange={e => setTextInput(e.target.value)} />
                <div className="mt-2 flex justify-between items-center text-xs text-slate-500">
                  <span>{textInput.length} characters</span>
                  <span>Min 50 required</span>
                </div>
              </div>
              <Button onClick={handleSummarizeText} disabled={textInput.length < 50 || isProcessing} className="w-full">
                {isProcessing ? <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </> : 'Summarize Text'}
              </Button>
            </div> : <div className="space-y-6">
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:bg-slate-50 transition-colors relative">
                <input type="file" id="file-upload" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept=".txt,.pdf,.doc,.docx" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
                <div className="flex flex-col items-center">
                  <div className="h-12 w-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                    <Upload className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium text-slate-900">
                    {selectedFile ? selectedFile.name : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedFile ? `${(selectedFile.size / 1024).toFixed(1)} KB` : 'TXT, PDF, DOC up to 10MB'}
                  </p>
                </div>
              </div>
              {selectedFile && <div className="flex items-center justify-between bg-indigo-50 p-3 rounded-md border border-indigo-100">
                  <div className="flex items-center">
                    <FileText className="h-4 w-4 text-indigo-600 mr-2" />
                    <span className="text-sm text-indigo-900 truncate max-w-[200px]">
                      {selectedFile.name}
                    </span>
                  </div>
                  <button onClick={() => setSelectedFile(null)} className="text-indigo-400 hover:text-indigo-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>}
              <Button onClick={handleFileUpload} disabled={!selectedFile || isProcessing} className="w-full">
                {isProcessing ? <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing File...
                  </> : 'Upload & Summarize'}
              </Button>
            </div>}
        </div>
      </div>

      {/* Result Display */}
      {currentResult && <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-slate-900 flex items-center">
              <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
              Summary Ready
            </h3>
            <span className="text-xs text-slate-500">Just now</span>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
            <p className="text-slate-700 leading-relaxed">
              {currentResult.summary}
            </p>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={() => {
          navigator.clipboard.writeText(currentResult.summary);
        }}>
              Copy to Clipboard
            </Button>
          </div>
        </div>}
    </div>;
}
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import { 
  Upload, 
  Phone, 
  ChevronRight, 
  ChevronLeft, 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  X,
  FileSpreadsheet,
  Settings2,
  PhoneCall
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Contact {
  name: string;
  phone: string;
  status?: 'pending' | 'completed' | 'skipped' | 'busy';
  [key: string]: any;
}

type ViewMode = 'upload' | 'mapping' | 'list' | 'dialer';

export default function App() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('upload');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState({ name: '', phone: '' });
  const [isDialing, setIsDialing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'text/csv') {
      parseFile(file);
    } else {
      alert('Please upload a valid CSV file.');
    }
  };

  const parseFile = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.meta.fields) {
          setHeaders(results.meta.fields);
          setContacts(results.data as Contact[]);
          setViewMode('mapping');
        }
      },
      error: (error) => {
        console.error('CSV Parsing Error:', error);
        alert('Error parsing CSV file. Please check the format.');
      }
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode !== 'dialer') return;
      if (e.key === 'ArrowRight' || e.key === 'Enter') nextContact();
      if (e.key === 'ArrowLeft') prevContact();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, currentIndex, contacts]);

  const startDialing = () => {
    if (!mapping.name || !mapping.phone) {
      alert('Please map Name and Phone columns first.');
      return;
    }
    
    // Normalize contacts based on mapping
    const normalized = contacts.map(c => ({
      name: c[mapping.name] || 'Unknown',
      phone: String(c[mapping.phone] || '').replace(/[^0-9+]/g, '')
    })).filter(c => c.phone.length > 0);

    setContacts(normalized);
    setCurrentIndex(0);
    setViewMode('dialer');
  };

  const nextContact = () => {
    if (currentIndex < contacts.length) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsDialing(false);
    }
  };

  const prevContact = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const reset = () => {
    setContacts([]);
    setViewMode('upload');
    setCurrentIndex(0);
    setMapping({ name: '', phone: '' });
  };

  const updateStatus = (status: Contact['status']) => {
    const newContacts = [...contacts];
    newContacts[currentIndex].status = status;
    setContacts(newContacts);
    nextContact();
  };

  const currentContact = contacts[currentIndex];
  const completedCount = contacts.filter(c => c.status && c.status !== 'pending').length;

  if (viewMode === 'dialer' && currentIndex >= contacts.length && contacts.length > 0) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] text-[#1a1a1a] font-sans">
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <PhoneCall className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">Session Summary</h1>
          </div>
          <button onClick={reset} className="text-sm font-medium text-blue-600 hover:underline">Start New Session</button>
        </header>
        <main className="max-w-2xl mx-auto p-8">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-8 border-b border-gray-100 bg-blue-50/30">
              <h2 className="text-2xl font-bold mb-2">Dialing Complete</h2>
              <p className="text-gray-500">You've reached the end of your contact list.</p>
            </div>
            <div className="p-8 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl">
                  <div className="text-sm text-gray-500 mb-1">Total Contacts</div>
                  <div className="text-2xl font-bold">{contacts.length}</div>
                </div>
                <div className="bg-green-50 p-4 rounded-2xl">
                  <div className="text-sm text-green-600 mb-1">Completed</div>
                  <div className="text-2xl font-bold text-green-700">{contacts.filter(c => c.status === 'completed').length}</div>
                </div>
              </div>
              <div className="mt-8">
                <h3 className="font-semibold mb-4">Detailed Results</h3>
                <div className="space-y-2">
                  {contacts.map((c, i) => (
                    <div key={i} className="flex justify-between items-center p-3 border-b border-gray-50 last:border-0">
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-gray-400">{c.phone}</div>
                      </div>
                      <span className={`text-xs font-bold uppercase px-2 py-1 rounded-full ${
                        c.status === 'completed' ? 'bg-green-100 text-green-700' :
                        c.status === 'busy' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {c.status || 'skipped'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#1a1a1a] font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <PhoneCall className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Hands-Free Dialer</h1>
        </div>
        {viewMode !== 'upload' && (
          <button 
            onClick={reset}
            className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        )}
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <AnimatePresence mode="wait">
          {viewMode === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center min-h-[60vh]"
            >
              <div 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`w-full max-w-md bg-white border-2 border-dashed rounded-3xl p-12 flex flex-col items-center gap-6 cursor-pointer transition-all group ${
                  isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50/30'
                }`}
              >
                <div className="bg-blue-50 p-6 rounded-full group-hover:scale-110 transition-transform">
                  <Upload className="w-12 h-12 text-blue-600" />
                </div>
                <div className="text-center">
                  <h2 className="text-2xl font-semibold mb-2">Upload CSV</h2>
                  <p className="text-gray-500">Drag and drop your contact spreadsheet here, or click to browse</p>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".csv" 
                  className="hidden" 
                />
              </div>
              <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                {[
                  { icon: CheckCircle2, title: "Simple CSV", desc: "Supports any CSV format" },
                  { icon: Settings2, title: "Custom Mapping", desc: "Map your own columns" },
                  { icon: Phone, title: "One-Tap Dial", desc: "Streamlined calling flow" }
                ].map((feature, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <feature.icon className="w-6 h-6 text-blue-600 mb-4" />
                    <h3 className="font-semibold mb-1">{feature.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {viewMode === 'mapping' && (
            <motion.div
              key="mapping"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl shadow-sm border border-gray-200 p-8 max-w-lg mx-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="text-blue-600 w-6 h-6" />
                  <h2 className="text-2xl font-semibold">Map Columns</h2>
                </div>
                <button 
                  onClick={() => setViewMode('upload')}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name Column</label>
                  <select 
                    value={mapping.name}
                    onChange={(e) => setMapping(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  >
                    <option value="">Select column for names</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone Column</label>
                  <select 
                    value={mapping.phone}
                    onChange={(e) => setMapping(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  >
                    <option value="">Select column for phone numbers</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <button 
                  onClick={startDialing}
                  disabled={!mapping.name || !mapping.phone}
                  className="w-full bg-blue-600 text-white font-semibold py-4 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-200 mt-4"
                >
                  Start Dialing
                </button>
              </div>
            </motion.div>
          )}

          {viewMode === 'dialer' && currentContact && (
            <motion.div
              key="dialer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-8"
            >
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                <motion.div 
                  className="bg-blue-600 h-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentIndex + 1) / contacts.length) * 100}%` }}
                />
              </div>
              <div className="text-sm font-medium text-gray-500">
                Contact {currentIndex + 1} of {contacts.length}
              </div>

              {/* Dialer Card */}
              <motion.div 
                key={currentIndex}
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -50, opacity: 0 }}
                className="w-full max-w-md bg-white rounded-[40px] shadow-xl p-12 flex flex-col items-center text-center gap-8 border border-gray-100"
              >
                <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 text-3xl font-bold">
                  {currentContact.name.charAt(0)}
                </div>
                
                <div>
                  <h2 className="text-3xl font-bold mb-2">{currentContact.name}</h2>
                  <p className="text-xl text-gray-500 font-mono tracking-wider">{currentContact.phone}</p>
                </div>

                <a 
                  href={`tel:${currentContact.phone}`}
                  onClick={() => setIsDialing(true)}
                  className="w-full bg-green-500 text-white rounded-3xl py-6 flex items-center justify-center gap-3 text-2xl font-bold hover:bg-green-600 transition-all shadow-xl shadow-green-100 active:scale-95"
                >
                  <Phone className="w-8 h-8 fill-current" />
                  Call Now
                </a>

                {/* Status Options */}
                <div className="grid grid-cols-3 gap-3 w-full">
                  <button 
                    onClick={() => updateStatus('completed')}
                    className="flex flex-col items-center gap-2 p-3 bg-green-50 text-green-700 rounded-2xl border border-green-100 hover:bg-green-100 transition-all"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-xs font-bold uppercase">Success</span>
                  </button>
                  <button 
                    onClick={() => updateStatus('busy')}
                    className="flex flex-col items-center gap-2 p-3 bg-yellow-50 text-yellow-700 rounded-2xl border border-yellow-100 hover:bg-yellow-100 transition-all"
                  >
                    <Pause className="w-5 h-5" />
                    <span className="text-xs font-bold uppercase">Busy</span>
                  </button>
                  <button 
                    onClick={() => updateStatus('skipped')}
                    className="flex flex-col items-center gap-2 p-3 bg-gray-50 text-gray-500 rounded-2xl border border-gray-100 hover:bg-gray-100 transition-all"
                  >
                    <X className="w-5 h-5" />
                    <span className="text-xs font-bold uppercase">Skip</span>
                  </button>
                </div>
              </motion.div>

              <p className="text-xs text-gray-400 text-center max-w-xs">
                Clicking "Call Now" will open your device's phone app. 
                After the call, return here to mark the status and move to the next contact.
              </p>

              {/* Controls */}
              <div className="flex items-center gap-6">
                <button 
                  onClick={prevContact}
                  disabled={currentIndex === 0}
                  className="p-4 bg-white rounded-full shadow-md border border-gray-100 disabled:opacity-30 hover:bg-gray-50 transition-all"
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>
                
                <button 
                  onClick={nextContact}
                  className="px-12 py-4 bg-white rounded-full shadow-md border border-gray-100 font-bold text-xl flex items-center gap-2 hover:bg-gray-50 transition-all"
                >
                  Next
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>

              {/* Contact List Preview */}
              <div className="w-full mt-12">
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-4">Upcoming Queue</h3>
                <div className="space-y-2">
                  {contacts.slice(currentIndex + 1, currentIndex + 4).map((c, i) => (
                    <div key={i} className="bg-white/50 border border-gray-200 p-4 rounded-2xl flex justify-between items-center opacity-60">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-sm text-gray-500 font-mono">{c.phone}</span>
                    </div>
                  ))}
                  {contacts.length - (currentIndex + 1) > 3 && (
                    <div className="text-center text-gray-400 text-sm py-2">
                      + {contacts.length - (currentIndex + 4)} more contacts
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

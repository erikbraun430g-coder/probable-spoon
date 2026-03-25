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

type ViewMode = 'home' | 'setup' | 'dialer' | 'summary';

export default function App() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sheetUrl, setSheetUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDialing, setIsDialing] = useState(false);

  const fetchSheetData = async () => {
    if (!sheetUrl) {
      alert('Voer eerst een geldige Google Sheets CSV link in.');
      return;
    }

    setIsLoading(true);
    Papa.parse(sheetUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as any[];
        // Try to find Name and Phone columns automatically
        const fields = results.meta.fields || [];
        const nameKey = fields.find(f => f.toLowerCase().includes('naam') || f.toLowerCase().includes('name')) || fields[0];
        const phoneKey = fields.find(f => f.toLowerCase().includes('telefoon') || f.toLowerCase().includes('phone') || f.toLowerCase().includes('tel')) || fields[1];

        if (!nameKey || !phoneKey) {
          alert('Kon geen Naam of Telefoon kolommen vinden in de CSV.');
          setIsLoading(false);
          return;
        }

        const normalized = data.map(c => ({
          name: c[nameKey] || 'Onbekend',
          phone: String(c[phoneKey] || '').replace(/[^0-9+]/g, ''),
          status: 'pending' as const
        })).filter(c => c.phone.length > 0);

        if (normalized.length === 0) {
          alert('Geen geldige contacten gevonden.');
        } else {
          setContacts(normalized);
          setCurrentIndex(0);
          setViewMode('dialer');
        }
        setIsLoading(false);
      },
      error: (error) => {
        console.error('CSV Fetch Error:', error);
        alert('Fout bij het ophalen van de Google Sheet. Controleer of de link correct is en gepubliceerd als CSV.');
        setIsLoading(false);
      }
    });
  };

  const nextContact = () => {
    if (currentIndex < contacts.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setViewMode('summary');
    }
  };

  const prevContact = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const updateStatus = (status: Contact['status']) => {
    const newContacts = [...contacts];
    newContacts[currentIndex].status = status;
    setContacts(newContacts);
    nextContact();
  };

  const reset = () => {
    setContacts([]);
    setViewMode('home');
    setCurrentIndex(0);
    setSheetUrl('');
  };

  const currentContact = contacts[currentIndex];

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

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200">
            <PhoneCall className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">Hands-Free Dialer</h1>
        </div>
        {viewMode !== 'home' && (
          <button 
            onClick={reset}
            className="text-sm font-semibold text-slate-500 hover:text-blue-600 transition-all flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-50"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        )}
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <AnimatePresence mode="wait">
          {viewMode === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center min-h-[75vh] text-center px-4"
            >
              <motion.div 
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ repeat: Infinity, duration: 5 }}
                className="bg-blue-600 w-32 h-32 rounded-[2.5rem] flex items-center justify-center mb-10 shadow-[0_20px_50px_rgba(37,99,235,0.3)]"
              >
                <PhoneCall className="w-16 h-16 text-white" />
              </motion.div>
              
              <h2 className="text-6xl font-black mb-6 tracking-tight text-slate-900 leading-tight">
                Hands-Free <br />
                <span className="text-blue-600">Dialer</span>
              </h2>
              
              <p className="text-slate-500 text-xl max-w-md mb-12 font-medium leading-relaxed">
                Koppel je Google Sheets database en start direct met bellen.
              </p>
              
              <button 
                onClick={() => setViewMode('setup')}
                className="group relative bg-blue-600 text-white text-3xl font-black px-16 py-8 rounded-[2.5rem] shadow-[0_20px_40px_rgba(37,99,235,0.4)] hover:scale-105 transition-all active:scale-95 flex items-center gap-4"
              >
                START DE APP
                <ChevronRight className="w-10 h-10 group-hover:translate-x-2 transition-transform" />
              </button>
              
              <p className="mt-8 text-slate-400 font-bold text-sm uppercase tracking-widest">
                Tik om te beginnen
              </p>
            </motion.div>
          )}

          {viewMode === 'setup' && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-10 max-w-xl mx-auto relative"
            >
              <button 
                onClick={() => setViewMode('home')}
                className="absolute top-8 right-8 text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-full hover:bg-slate-50"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="flex items-center gap-4 mb-8">
                <div className="bg-green-100 p-3 rounded-2xl">
                  <FileSpreadsheet className="text-green-600 w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-slate-900">Database Link</h2>
                  <p className="text-slate-500 font-medium">Plak je Google Sheets CSV URL</p>
                </div>
              </div>
              
              <div className="space-y-8">
                <div className="relative">
                  <input 
                    type="url" 
                    placeholder="https://docs.google.com/spreadsheets/d/.../export?format=csv"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-5 text-lg focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300 font-medium"
                  />
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <Settings2 className="w-4 h-4" />
                    Hoe krijg ik deze link?
                  </h4>
                  <ol className="text-sm text-slate-500 space-y-2 list-decimal ml-4">
                    <li>Open je Google Sheet</li>
                    <li>Ga naar Bestand &gt; Delen &gt; Publiceren op internet</li>
                    <li>Kies 'Hele document' en 'Door komma's gescheiden waarden (.csv)'</li>
                    <li>Klik op 'Publiceren' en kopieer de link</li>
                  </ol>
                </div>

                <button 
                  onClick={fetchSheetData}
                  disabled={!sheetUrl || isLoading}
                  className="w-full bg-blue-600 text-white text-xl font-black py-6 rounded-2xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-blue-100 flex items-center justify-center gap-3"
                >
                  {isLoading ? (
                    <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      Laden & Starten
                      <Play className="w-6 h-6 fill-current" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {viewMode === 'dialer' && currentContact && (
            <motion.div
              key="dialer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-10"
            >
              {/* Progress Bar */}
              <div className="w-full max-w-md">
                <div className="flex justify-between text-sm font-bold text-slate-400 mb-3 uppercase tracking-widest">
                  <span>Voortgang</span>
                  <span>{currentIndex + 1} / {contacts.length}</span>
                </div>
                <div className="w-full bg-slate-200 h-4 rounded-full overflow-hidden shadow-inner">
                  <motion.div 
                    className="bg-blue-600 h-full shadow-[0_0_20px_rgba(37,99,235,0.5)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentIndex + 1) / contacts.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Dialer Card */}
              <motion.div 
                key={currentIndex}
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -50, opacity: 0 }}
                className="w-full max-w-lg bg-white rounded-[3rem] shadow-2xl p-12 flex flex-col items-center text-center gap-10 border border-slate-100"
              >
                <div className="w-32 h-32 bg-blue-50 rounded-[2.5rem] flex items-center justify-center text-blue-600 text-5xl font-black shadow-inner rotate-3">
                  {currentContact.name.charAt(0)}
                </div>
                
                <div>
                  <h2 className="text-4xl font-black mb-3 text-slate-900">{currentContact.name}</h2>
                  <p className="text-2xl text-slate-400 font-mono font-bold tracking-tighter">{currentContact.phone}</p>
                </div>

                <motion.a 
                  href={`tel:${currentContact.phone}`}
                  onClick={() => setIsDialing(true)}
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="w-full bg-green-500 text-white rounded-[3rem] py-14 flex flex-col items-center justify-center gap-6 text-5xl font-black hover:bg-green-600 transition-all shadow-[0_20px_50px_rgba(34,197,94,0.3)] active:scale-95 group"
                >
                  <Phone className="w-20 h-20 fill-current group-hover:rotate-12 transition-transform" />
                  BEL NU
                </motion.a>

                {/* Status Options */}
                <div className="grid grid-cols-3 gap-4 w-full">
                  <button 
                    onClick={() => updateStatus('completed')}
                    className="flex flex-col items-center gap-3 p-5 bg-green-50 text-green-700 rounded-3xl border-2 border-green-100 hover:bg-green-100 transition-all active:scale-95"
                  >
                    <CheckCircle2 className="w-6 h-6" />
                    <span className="text-xs font-black uppercase tracking-widest">Succes</span>
                  </button>
                  <button 
                    onClick={() => updateStatus('busy')}
                    className="flex flex-col items-center gap-3 p-5 bg-yellow-50 text-yellow-700 rounded-3xl border-2 border-yellow-100 hover:bg-yellow-100 transition-all active:scale-95"
                  >
                    <Pause className="w-6 h-6" />
                    <span className="text-xs font-black uppercase tracking-widest">Bezet</span>
                  </button>
                  <button 
                    onClick={() => updateStatus('skipped')}
                    className="flex flex-col items-center gap-3 p-5 bg-slate-50 text-slate-500 rounded-3xl border-2 border-slate-100 hover:bg-slate-200 transition-all active:scale-95"
                  >
                    <X className="w-6 h-6" />
                    <span className="text-xs font-black uppercase tracking-widest">Overslaan</span>
                  </button>
                </div>
              </motion.div>

              <div className="flex items-center gap-8">
                <button 
                  onClick={prevContact}
                  disabled={currentIndex === 0}
                  className="p-6 bg-white rounded-[2rem] shadow-lg border border-slate-100 disabled:opacity-30 hover:bg-slate-50 transition-all active:scale-90"
                >
                  <ChevronLeft className="w-10 h-10 text-slate-600" />
                </button>
                
                <button 
                  onClick={nextContact}
                  className="px-16 py-6 bg-white rounded-[2rem] shadow-lg border border-slate-100 font-black text-2xl text-slate-800 flex items-center gap-3 hover:bg-slate-50 transition-all active:scale-90"
                >
                  Volgende
                  <ChevronRight className="w-8 h-8" />
                </button>
              </div>
            </motion.div>
          )}

          {viewMode === 'summary' && (
            <motion.div
              key="summary"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl mx-auto"
            >
              <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden">
                <div className="p-12 border-b border-slate-50 bg-blue-50/50 text-center">
                  <div className="bg-blue-600 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-200">
                    <CheckCircle2 className="text-white w-10 h-10" />
                  </div>
                  <h2 className="text-4xl font-black mb-3 text-slate-900">Sessie Voltooid!</h2>
                  <p className="text-slate-500 text-lg font-medium">Je hebt de hele lijst doorgewerkt.</p>
                </div>
                <div className="p-12 space-y-8">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-slate-50 p-8 rounded-[2.5rem] text-center border border-slate-100">
                      <div className="text-sm font-black text-slate-400 uppercase tracking-widest mb-2">Totaal</div>
                      <div className="text-5xl font-black text-slate-800">{contacts.length}</div>
                    </div>
                    <div className="bg-green-50 p-8 rounded-[2.5rem] text-center border border-green-100">
                      <div className="text-sm font-black text-green-500 uppercase tracking-widest mb-2">Geslaagd</div>
                      <div className="text-5xl font-black text-green-700">{contacts.filter(c => c.status === 'completed').length}</div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={reset}
                    className="w-full bg-slate-900 text-white text-xl font-black py-6 rounded-[2rem] hover:bg-slate-800 transition-all shadow-xl active:scale-95"
                  >
                    Nieuwe Sessie Starten
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

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
  PhoneCall,
  Mic,
  MessageSquare,
  Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type, Modality } from "@google/genai";

interface Contact {
  name: string;
  phone: string;
  organization?: string;
  subject?: string;
  status?: 'pending' | 'completed' | 'skipped' | 'busy';
  [key: string]: any;
}

type ViewMode = 'home' | 'setup' | 'dialer' | 'summary';

export default function App() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('sheetUrl');
    return saved ? 'home' : 'setup';
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sheetUrl, setSheetUrl] = useState(() => localStorage.getItem('sheetUrl') || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isDialing, setIsDialing] = useState(false);
  const [aiCommand, setAiCommand] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiResponse, setAiResponse] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);

  const speak = async (text: string) => {
    // Stop any current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();
    setIsSpeaking(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Spreek dit op een natuurlijke, behulpzame manier uit in het Nederlands: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioSrc = `data:audio/wav;base64,${base64Audio}`;
        const audio = new Audio(audioSrc);
        audioRef.current = audio;
        audio.onended = () => setIsSpeaking(false);
        await audio.play();
      } else {
        throw new Error("No audio data");
      }
    } catch (error) {
      console.error("TTS Error, falling back to system voice:", error);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'nl-NL';
      utterance.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Persist sheet URL
  React.useEffect(() => {
    localStorage.setItem('sheetUrl', sheetUrl);
  }, [sheetUrl]);

  // Continuous Voice Recognition Logic
  React.useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'nl-NL';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setAiCommand(transcript);
      handleAiCommand(transcript);
    };

    recognition.onend = () => {
      if (isListening && !isDialing && !isAiProcessing && !isSpeaking) {
        try {
          recognition.start();
        } catch (e) {}
      }
    };

    recognitionRef.current = recognition;

    if (isListening && !isDialing && !isAiProcessing && !isSpeaking) {
      try {
        recognition.start();
      } catch (e) {}
    }

    return () => {
      recognition.stop();
    };
  }, [isListening, isDialing, isAiProcessing, isSpeaking]);

  // Automatically read contact info when it changes
  React.useEffect(() => {
    if (viewMode === 'dialer' && contacts[currentIndex]) {
      const contact = contacts[currentIndex];
      const text = `Volgende contact: ${contact.name}. ${contact.organization ? `Van organisatie ${contact.organization}.` : ''} ${contact.subject ? `De taak is: ${contact.subject}.` : ''}`;
      speak(text);
    }
  }, [currentIndex, viewMode, contacts]);

  const fetchSheetData = async () => {
    if (!sheetUrl) {
      alert('Voer eerst een geldige Google Sheets CSV link in.');
      return;
    }

    let finalUrl = sheetUrl;
    if (sheetUrl.includes('docs.google.com/spreadsheets/d/') && !sheetUrl.includes('export?format=csv') && !sheetUrl.includes('pub?output=csv')) {
      const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        finalUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
      }
    }

    setIsLoading(true);
    Papa.parse(finalUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        let data = results.data as any[];
        let fields = results.meta.fields || [];

        const nameKey = fields.find(f => f.toLowerCase().includes('contact')) || fields.find(f => f.toLowerCase().includes('naam') || f.toLowerCase().includes('name')) || fields[0];
        const phoneKey = fields.find(f => f.toLowerCase().includes('mobiel')) || fields.find(f => f.toLowerCase().includes('telefoon') || f.toLowerCase().includes('phone') || f.toLowerCase().includes('tel')) || fields[1];
        const orgKey = fields.find(f => f.toLowerCase().includes('organisatie')) || fields.find(f => f.toLowerCase().includes('bedrijf') || f.toLowerCase().includes('org'));
        const subjectKey = fields.find(f => f.toLowerCase().includes('onderwerp')) || fields.find(f => f.toLowerCase().includes('taak') || f.toLowerCase().includes('subject'));

        const normalized = data.map(c => ({
          name: c[nameKey] || 'Onbekend',
          phone: String(c[phoneKey] || '').replace(/[^0-9+]/g, ''),
          organization: orgKey ? c[orgKey] : undefined,
          subject: subjectKey ? c[subjectKey] : undefined,
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

  const handleAiCommand = async (command: string) => {
    if (!command.trim()) return;
    setIsAiProcessing(true);
    setAiResponse('');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3.1-pro-preview";

      const tools = [
        {
          functionDeclarations: [
            {
              name: "callContact",
              description: "Bel een contactpersoon uit de lijst op basis van naam of index.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Naam van de persoon" },
                  index: { type: Type.INTEGER, description: "Index van de persoon in de lijst (1-based)" }
                }
              }
            },
            {
              name: "readTask",
              description: "Lees het onderwerp of de taak voor van een contactpersoon.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Naam van de persoon" },
                  index: { type: Type.INTEGER, description: "Index van de persoon in de lijst (1-based)" }
                }
              }
            },
            {
              name: "updateStatus",
              description: "Update de status van het huidige contact (succes, bezet, overslaan) en ga naar de volgende.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  status: { type: Type.STRING, enum: ["completed", "busy", "skipped"], description: "De nieuwe status" }
                },
                required: ["status"]
              }
            },
            {
              name: "navigate",
              description: "Ga naar het volgende of vorige contact.",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  direction: { type: Type.STRING, enum: ["next", "prev"], description: "Richting van navigatie" }
                },
                required: ["direction"]
              }
            }
          ]
        }
      ];

      const contactsContext = contacts.map((c, i) => `${i + 1}. ${c.name} (${c.organization || 'Geen organisatie'}), Taak: ${c.subject || 'Geen taak'}`).join('\n');

      const response = await ai.models.generateContent({
        model,
        contents: `De gebruiker geeft een commando voor een belsysteem.
Huidige lijst met contacten:
${contactsContext}
Huidig contact index: ${currentIndex + 1}

Commando: "${command}"

Als het commando een actie vereist (bellen, lezen, navigeren, status updaten), gebruik dan de tools.
Als het een vraag is, geef dan een kort antwoord in het Nederlands.`,
        config: {
          tools,
          systemInstruction: "Je bent een behulpzame assistent voor een hands-free belsysteem. Je spreekt Nederlands. Je kunt contacten bellen, taken voorlezen, navigeren door de lijst en de status van calls bijwerken."
        }
      });

      const functionCalls = response.functionCalls;
      if (functionCalls) {
        for (const call of functionCalls) {
          if (call.name === 'callContact') {
            let idx = -1;
            if (call.args.index) idx = (call.args.index as number) - 1;
            else if (call.args.name) idx = contacts.findIndex(c => c.name.toLowerCase().includes((call.args.name as string).toLowerCase()));

            if (idx >= 0 && idx < contacts.length) {
              setCurrentIndex(idx);
              setAiResponse(`Ik ga ${contacts[idx].name} bellen.`);
              speak(`Ik ga ${contacts[idx].name} bellen.`);
              setTimeout(() => {
                window.location.href = `tel:${contacts[idx].phone}`;
              }, 1500);
            } else {
              setAiResponse("Ik kon die persoon niet vinden in de lijst.");
              speak("Ik kon die persoon niet vinden in de lijst.");
            }
          } else if (call.name === 'readTask') {
            let idx = -1;
            if (call.args.index) idx = (call.args.index as number) - 1;
            else if (call.args.name) idx = contacts.findIndex(c => c.name.toLowerCase().includes((call.args.name as string).toLowerCase()));

            if (idx >= 0 && idx < contacts.length) {
              const task = contacts[idx].subject || "Er is geen specifieke taak genoteerd.";
              setAiResponse(`Taak voor ${contacts[idx].name}: ${task}`);
              speak(`De taak voor ${contacts[idx].name} is: ${task}`);
            } else {
              setAiResponse("Ik kon die persoon niet vinden.");
              speak("Ik kon die persoon niet vinden.");
            }
          } else if (call.name === 'updateStatus') {
            const status = call.args.status as 'completed' | 'busy' | 'skipped';
            updateStatus(status);
            setAiResponse(`Status bijgewerkt naar ${status === 'completed' ? 'succes' : status === 'busy' ? 'bezet' : 'overgeslagen'}.`);
            speak(`Status bijgewerkt. Volgende contact.`);
          } else if (call.name === 'navigate') {
            const direction = call.args.direction as 'next' | 'prev';
            if (direction === 'next') nextContact();
            else prevContact();
            setAiResponse(`Navigeren naar ${direction === 'next' ? 'volgende' : 'vorige'}.`);
          }
        }
      } else {
        setAiResponse(response.text || "Ik begrijp het commando niet helemaal.");
        speak(response.text || "Ik begrijp het commando niet helemaal.");
      }
    } catch (error) {
      console.error('AI Error:', error);
      setAiResponse("Er ging iets mis bij het verwerken van het AI commando.");
    } finally {
      setIsAiProcessing(false);
      setAiCommand('');
    }
  };

  const startVoiceRecognition = () => {
    setIsListening(true);
  };

  const stopVoiceRecognition = () => {
    setIsListening(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const requestMicrophone = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone access granted');
    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  };

  React.useEffect(() => {
    requestMicrophone();
  }, []);

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
      <main className="max-w-4xl mx-auto p-6">
        <AnimatePresence mode="wait">
          {viewMode === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4 relative"
            >
              <button 
                onClick={() => setViewMode('setup')}
                className="absolute top-0 right-0 p-4 text-slate-400 hover:text-blue-600 transition-colors"
              >
                <Settings2 className="w-8 h-8" />
              </button>

              <div className="mb-12">
                <h1 className="text-4xl font-black text-slate-900 mb-4">Hands-Free Dialer</h1>
                <p className="text-slate-500 font-medium">Klaar om de lijst te starten?</p>
              </div>
              
              <button 
                onClick={fetchSheetData}
                className="group relative bg-green-500 text-white w-64 h-64 rounded-full shadow-[0_20px_60px_rgba(34,197,94,0.4)] hover:scale-105 transition-all active:scale-95 flex flex-col items-center justify-center gap-4 animate-pulse"
              >
                <Play className="w-24 h-24 fill-current" />
                <span className="text-2xl font-black">START</span>
              </button>
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
                      Opslaan & Starten
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
              className="flex flex-col items-center justify-center min-h-[80vh] gap-12"
            >
              {/* AI Status Overlay */}
              <AnimatePresence>
                {isAiProcessing && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-blue-600/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-white p-8"
                  >
                    <div className="w-24 h-24 border-8 border-white border-t-transparent rounded-full animate-spin mb-8" />
                    <p className="text-3xl font-black">AI verwerkt commando...</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="w-full max-w-lg flex flex-col items-center gap-12">
                <motion.a 
                  href={`tel:${currentContact.phone}`}
                  onClick={() => {
                    setIsDialing(true);
                    stopVoiceRecognition();
                  }}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="w-80 h-80 bg-green-500 text-white rounded-full flex flex-col items-center justify-center gap-4 text-4xl font-black shadow-[0_30px_70px_rgba(34,197,94,0.4)] hover:bg-green-600 transition-all active:scale-95 group"
                >
                  <Phone className="w-24 h-24 fill-current group-hover:rotate-12 transition-transform" />
                  BEL NU
                </motion.a>

                <div className="flex flex-col items-center gap-4">
                  <button 
                    onClick={isListening ? stopVoiceRecognition : startVoiceRecognition}
                    className={`w-32 h-32 rounded-full shadow-2xl transition-all active:scale-90 flex items-center justify-center group relative ${isListening ? 'bg-red-500 shadow-red-200 animate-pulse' : 'bg-blue-600 shadow-blue-200'}`}
                  >
                    {isListening ? <Mic className="w-14 h-14 text-white" /> : <Volume2 className="w-14 h-14 text-white" />}
                    <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-sm px-4 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-bold">
                      {isListening ? 'AI Luistert...' : 'AI Inschakelen'}
                    </div>
                  </button>
                  {isListening && (
                    <p className="text-blue-600 font-black animate-bounce">AI Luistert...</p>
                  )}
                </div>
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

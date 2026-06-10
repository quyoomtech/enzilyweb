import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Languages, GraduationCap, Gavel, Clock, Sparkles } from 'lucide-react';
import { ActiveTab } from './types';
import TranslatorView from './components/TranslatorView';
import PracticeView from './components/PracticeView';
import DebateView from './components/DebateView';
import { formatSessionClock } from './utils';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('translator');
  const [sessionClock, setSessionClock] = useState<string>('12:15:00');
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);

  // Synchronize router state with window.location.hash
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase().trim();
      if (hash.includes('practice')) {
        setActiveTab('practice');
      } else if (hash.includes('debate')) {
        setActiveTab('debate');
      } else {
        setActiveTab('translator');
      }
    };

    // Run first initialization
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Update URL hash when active tab changes programmatically
  const handleTabChange = (tab: ActiveTab) => {
    window.location.hash = `#/${tab}`;
    setActiveTab(tab);
  };

  // Run a real-time clock for the mock timer precisely like the photos
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionClock(formatSessionClock(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Check backend server status to warn user if Gemini key is missing in environment variables
  useEffect(() => {
    const buildKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (buildKey) {
      setHasApiKey(true);
      return;
    }
    if ((import.meta as any).env?.VITE_GEMINI_API_KEY) {
      setHasApiKey(true);
      return;
    }
    fetch('/api/status')
      .then(res => res.json())
      .then((data) => {
        if (data && data.hasKey) {
          setHasApiKey(true);
        } else {
          setHasApiKey(false);
        }
      })
      .catch(() => {
        // If server status is unavailable, we might be running in a standard static/Vercel SPA env
        setHasApiKey(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fff2f4] via-[#faf5f6] to-[#fff2f5] text-zinc-800 flex items-center justify-center font-sans antialiased p-0 sm:p-4">
      {/* Sophisticated White & Pink device frame style container */}
      <div className="w-full max-w-md bg-white text-zinc-800 sm:rounded-3xl sm:shadow-[0_12px_40px_rgba(219,39,119,0.08)] overflow-hidden min-h-screen sm:min-h-[812px] flex flex-col justify-between border border-pink-100/60">
        
        {/* TOP BRAND HEADER */}
        <header id="brand-header" className="bg-white px-6 pt-5 pb-3 border-b border-pink-100/40">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-lg bg-gradient-to-tr from-pink-500 to-rose-400 text-white shadow-lg shadow-pink-500/10 animate-spin-slow">
                <Sparkles size={16} />
              </span>
              <span className="font-serif italic font-semibold tracking-tight text-xl text-zinc-900">
                Enzily<span className="text-pink-500 font-sans font-extrabold">.ai</span>
              </span>
            </div>

            {/* Session Timer styled precisely matching layout instructions */}
            <div className="flex items-center gap-1.5 bg-pink-50/70 text-pink-600 px-3 py-1.5 rounded-full border border-pink-100/40 font-mono font-medium text-xs">
              <Clock size={13} className="text-pink-500" />
              <span>{sessionClock}</span>
            </div>
          </div>

          {/* Browser Tabs Routing System */}
          <nav className="flex items-center justify-between border-b border-pink-100/20 mt-5 pt-1">
            <button
              onClick={() => handleTabChange('translator')}
              className={`flex-1 flex flex-col items-center pb-2.5 relative transition-colors ${
                activeTab === 'translator' ? 'text-pink-600 font-bold' : 'text-zinc-400 hover:text-zinc-600 font-medium'
              } cursor-pointer`}
            >
              <div className="flex items-center gap-1.5 text-[13px]">
                <Languages size={15} />
                <span>Translator</span>
              </div>
              {activeTab === 'translator' && (
                <motion.div 
                  layoutId="active-nav-indicator" 
                  className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-pink-500 to-rose-450" 
                />
              )}
            </button>

            <button
              onClick={() => handleTabChange('practice')}
              className={`flex-1 flex flex-col items-center pb-2.5 relative transition-colors ${
                activeTab === 'practice' ? 'text-pink-600 font-bold' : 'text-zinc-400 hover:text-zinc-600 font-medium'
              } cursor-pointer`}
            >
              <div className="flex items-center gap-1.5 text-[13px]">
                <GraduationCap size={15} />
                <span>Practice</span>
              </div>
              {activeTab === 'practice' && (
                <motion.div 
                  layoutId="active-nav-indicator" 
                  className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-pink-500 to-rose-450" 
                />
              )}
            </button>

            <button
              onClick={() => handleTabChange('debate')}
              className={`flex-1 flex flex-col items-center pb-2.5 relative transition-colors ${
                activeTab === 'debate' ? 'text-pink-600 font-bold' : 'text-zinc-400 hover:text-zinc-600 font-medium'
              } cursor-pointer`}
            >
              <div className="flex items-center gap-1.5 text-[13px]">
                <Gavel size={15} />
                <span>Debate</span>
              </div>
              {activeTab === 'debate' && (
                <motion.div 
                  layoutId="active-nav-indicator" 
                  className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-pink-500 to-rose-450" 
                />
              )}
            </button>
          </nav>
        </header>

        {/* MAIN ROUTED VIEWS VIEWPORT */}
        <main className="flex-1 overflow-hidden h-[calc(100vh-140px)] sm:h-[640px] flex flex-col justify-between bg-gradient-to-b from-white to-[#fffcfd]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col h-full"
            >
              {activeTab === 'translator' && <TranslatorView />}
              {activeTab === 'practice' && <PracticeView />}
              {activeTab === 'debate' && <DebateView />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Subtle Brand Credit Footer */}
        <footer className="py-3 text-center border-t border-pink-100/30 bg-pink-50/10 text-zinc-400 text-[11px] font-sans">
          Developed by <span className="font-semibold text-rose-500">Quyoom Technologies</span>
        </footer>

        {/* Read-only Alert Warning Banner when API Key is missing */}
        {!hasApiKey && (
          <div className="bg-rose-50 border-t border-rose-100 text-rose-600 text-[10px] py-1.5 px-4 text-center tracking-normal font-medium font-sans">
            Please configure GEMINI_API_KEY / VITE_GEMINI_API_KEY to enable AI functionality in this deployment.
          </div>
        )}
      </div>
    </div>
  );
}

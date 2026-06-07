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

  // Check backend server status to warn user if Gemini key is missing in .env
  useEffect(() => {
    fetch('/api/status')
      .then(res => res.json())
      .then((data) => {
        if (data && !data.hasKey) {
          setHasApiKey(false);
        }
      })
      .catch(() => {
        // Fallback
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#060606] text-[#e0e0e0] flex items-center justify-center font-sans antialiased p-0 sm:p-4">
      {/* Sophisticated Dark device frame style container */}
      <div className="w-full max-w-md bg-[#0a0a0a] text-[#e0e0e0] sm:rounded-3xl sm:shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden min-h-screen sm:min-h-[812px] flex flex-col justify-between border border-[#ffffff12]">
        
        {/* TOP BRAND HEADER */}
        <header id="brand-header" className="bg-[#0d0d0d] px-6 pt-5 pb-3 border-b border-[#ffffff10]">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-lg bg-gradient-to-tr from-[#6366f1] to-[#a855f7] text-white shadow-lg shadow-indigo-500/10 animate-spin-slow">
                <Sparkles size={16} />
              </span>
              <span className="font-serif italic font-normal tracking-tight text-xl text-white">
                Enzily<span className="text-indigo-400 font-sans font-extrabold">.ai</span>
              </span>
            </div>

            {/* Session Timer styled precisely matching image */}
            <div className="flex items-center gap-1.5 bg-[#161616] text-[#888] px-3 py-1.5 rounded-full border border-white/5 font-mono font-medium text-xs">
              <Clock size={13} className="text-indigo-400" />
              <span>{sessionClock}</span>
            </div>
          </div>

          {/* Browser Tabs Routing System */}
          <nav className="flex items-center justify-between border-b border-[#ffffff08] mt-5 pt-1">
            <button
              onClick={() => handleTabChange('translator')}
              className={`flex-1 flex flex-col items-center pb-2.5 relative transition-colors ${
                activeTab === 'translator' ? 'text-white font-bold' : 'text-[#666] hover:text-[#999] font-medium'
              } cursor-pointer`}
            >
              <div className="flex items-center gap-1.5 text-[13px]">
                <Languages size={15} />
                <span>Translator</span>
              </div>
              {activeTab === 'translator' && (
                <motion.div 
                  layoutId="active-nav-indicator" 
                  className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-[#6366f1] to-[#a855f7]" 
                />
              )}
            </button>

            <button
              onClick={() => handleTabChange('practice')}
              className={`flex-1 flex flex-col items-center pb-2.5 relative transition-colors ${
                activeTab === 'practice' ? 'text-white font-bold' : 'text-[#666] hover:text-[#999] font-medium'
              } cursor-pointer`}
            >
              <div className="flex items-center gap-1.5 text-[13px]">
                <GraduationCap size={15} />
                <span>Practice</span>
              </div>
              {activeTab === 'practice' && (
                <motion.div 
                  layoutId="active-nav-indicator" 
                  className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-[#6366f1] to-[#a855f7]" 
                />
              )}
            </button>

            <button
              onClick={() => handleTabChange('debate')}
              className={`flex-1 flex flex-col items-center pb-2.5 relative transition-colors ${
                activeTab === 'debate' ? 'text-white font-bold' : 'text-[#666] hover:text-[#999] font-medium'
              } cursor-pointer`}
            >
              <div className="flex items-center gap-1.5 text-[13px]">
                <Gavel size={15} />
                <span>Debate</span>
              </div>
              {activeTab === 'debate' && (
                <motion.div 
                  layoutId="active-nav-indicator" 
                  className="absolute bottom-0 inset-x-0 h-0.5 bg-gradient-to-r from-[#6366f1] to-[#a855f7]" 
                />
              )}
            </button>
          </nav>
        </header>

        {/* MAIN ROUTED VIEWS VIEWPORT */}
        <main className="flex-1 overflow-hidden h-[calc(100vh-140px)] sm:h-[640px] flex flex-col justify-between bg-[#0a0a0a]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col h-full h-[100%]"
            >
              {activeTab === 'translator' && <TranslatorView />}
              {activeTab === 'practice' && <PracticeView />}
              {activeTab === 'debate' && <DebateView />}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Read-only Alert Warning Banner when API Key is missing */}
        {!hasApiKey && (
          <div className="bg-amber-950/80 border-t border-amber-500/20 text-amber-300 text-[10px] py-1.5 px-4 text-center tracking-normal font-medium font-sans">
            Please configure GEMINI_API_KEY in Settings &gt; Secrets to enable AI functionality.
          </div>
        )}
      </div>
    </div>

  );
}

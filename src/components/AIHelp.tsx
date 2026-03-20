import { useState } from 'react';
import { getAIHabitAdvice } from '../services/gemini';
import { UserProfile, Habit, HabitLog } from '../types';
import { Send, Sparkles, Loader2, BrainCircuit } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { translations, Language } from '../translations';

interface AIHelpProps {
  userProfile: UserProfile | null;
  habits: Habit[];
  logs: HabitLog[];
}

export default function AIHelp({ userProfile, habits, logs }: AIHelpProps) {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const lang = (userProfile?.settings?.language as Language) || 'English';
  const t = translations[lang] || translations.English;

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResponse(null);

    const context = `
      User's current habits: ${habits.map(h => `${h.name} (${h.type}, target: ${h.target} ${h.unit})`).join(', ')}.
      User's question: ${query}
    `;

    const result = await getAIHabitAdvice(context, lang);
    setResponse(result);
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header className="text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <BrainCircuit className="w-8 h-8 text-emerald-600" />
        </div>
        <h1 className="text-3xl font-bold">{t.aiCoach}</h1>
        <p className="text-stone-500 mt-2">{t.aiCoachDesc}</p>
      </header>

      <div className="bg-white p-8 rounded-3xl shadow-xl border border-stone-100">
        <form onSubmit={handleAsk} className="relative">
          <input 
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t.askSomething}
            className="w-full p-4 pr-14 rounded-2xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
          />
          <button 
            disabled={loading || !query.trim()}
            className="absolute right-2 top-2 p-2 bg-stone-900 text-white rounded-xl disabled:opacity-50 hover:bg-stone-800 transition-colors"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
          </button>
        </form>

        <AnimatePresence>
          {response && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 p-6 bg-emerald-50/50 rounded-2xl border border-emerald-100"
            >
              <div className="flex items-center gap-2 mb-4 text-emerald-700 font-bold">
                <Sparkles className="w-5 h-5" />
                {t.aiInsight}
              </div>
              <div className="prose prose-stone max-w-none text-stone-700 leading-relaxed">
                <Markdown>{response}</Markdown>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SuggestionCard 
          title={t.optimizeTargets} 
          text={t.suggestedTargets} 
          onClick={() => setQuery(t.suggestedTargets)}
        />
        <SuggestionCard 
          title={t.penaltyAdvice} 
          text={t.suggestedPenalty} 
          onClick={() => setQuery(t.suggestedPenalty)}
        />
      </div>
    </div>
  );
}

function SuggestionCard({ title, text, onClick }: { title: string, text: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="p-4 bg-white rounded-2xl border border-stone-100 text-left hover:border-emerald-200 hover:bg-emerald-50/30 transition-all group"
    >
      <h4 className="font-bold text-stone-900 mb-1 group-hover:text-emerald-700">{title}</h4>
      <p className="text-sm text-stone-500">{text}</p>
    </button>
  );
}

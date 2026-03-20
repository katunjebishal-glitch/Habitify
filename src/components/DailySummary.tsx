import { getScoreEmoji, getScoreColor } from '../utils';
import { motion } from 'motion/react';
import { translations, Language } from '../translations';

interface DailySummaryProps {
  score: number;
  lang: Language;
}

export default function DailySummary({ score, lang }: DailySummaryProps) {
  const t = translations[lang] || translations.English;
  return (
    <div className="p-5 rounded-[2rem] shadow-sm border border-stone-100 flex items-center gap-5 md:col-span-1 card-vibrant-emerald relative overflow-hidden">
      <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
        <svg viewBox="0 0 80 80" className="w-full h-full transform -rotate-90">
          <circle
            cx="40"
            cy="40"
            r="34"
            stroke="currentColor"
            strokeWidth="6"
            fill="transparent"
            className="text-stone-100"
          />
          <motion.circle
            cx="40"
            cy="40"
            r="34"
            stroke="currentColor"
            strokeWidth="6"
            fill="transparent"
            strokeDasharray={213.6}
            initial={{ strokeDashoffset: 213.6 }}
            animate={{ 
              strokeDashoffset: score === 0 ? 213.6 : 213.6 - (213.6 * score) / 100,
              opacity: score === 0 ? 0 : 1
            }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={getScoreColor(score)}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black leading-none">{Math.round(score)}</span>
          <span className="text-[0.5rem] font-black text-stone-400 uppercase tracking-tighter">%</span>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">{getScoreEmoji(score)}</span>
          <p className="text-sm font-black text-stone-900 truncate">{t.dailyScore}</p>
        </div>
        <p className="text-[0.625rem] text-stone-500 leading-tight font-bold">
          {score >= 90 ? t.scoreExcellent : 
           score >= 70 ? t.scoreGood :
           t.scoreKeepGoing}
        </p>
      </div>
    </div>
  );
}

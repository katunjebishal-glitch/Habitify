import { DailyScore, UserProfile } from '../types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, subMonths, addMonths } from 'date-fns';
import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Sparkles } from 'lucide-react';
import { cn, getScoreEmoji, getScoreColor } from '../utils';
import { motion } from 'motion/react';
import { translations, Language } from '../translations';

interface CalendarViewProps {
  dailyScores: DailyScore[];
  profile: UserProfile | null;
}

export default function CalendarView({ dailyScores, profile }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const lang = (profile?.settings.language as Language) || 'English';
  const t = translations[lang] || translations.English;

  const days = useMemo(() => {
    return eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: endOfMonth(currentMonth)
    });
  }, [currentMonth]);

  const stats = useMemo(() => {
    const monthScores = dailyScores.filter(s => isSameMonth(new Date(s.date), currentMonth));
    const average = monthScores.length > 0 
      ? monthScores.reduce((acc, s) => acc + s.score, 0) / monthScores.length 
      : 0;
    return { average, count: monthScores.length };
  }, [dailyScores, currentMonth]);

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-stone-900 leading-tight">{t.calendar}</h1>
          <p className="text-[0.625rem] md:text-sm text-stone-500 font-bold uppercase tracking-widest mt-1">
            {t.calendarDesc}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-stone-100 self-start md:self-auto">
          <button 
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 hover:bg-stone-50 rounded-xl transition-colors active:scale-90"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="px-4 font-black min-w-[140px] text-center text-sm uppercase tracking-widest">
            {format(currentMonth, 'MMMM yyyy')}
          </div>
          <button 
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 hover:bg-stone-50 rounded-xl transition-colors active:scale-90"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 bg-white p-4 md:p-8 rounded-[2rem] shadow-sm border border-stone-100">
          <div className="grid grid-cols-7 gap-1 md:gap-2 mb-4">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
              <div key={day} className="text-center text-[0.625rem] font-black text-stone-400 uppercase tracking-widest">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {/* Empty cells for start of month */}
            {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            
            {days.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const score = dailyScores.find(s => s.date === dateStr);
              const isToday = isSameDay(day, new Date());

              return (
                <motion.div 
                  key={dateStr}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    "aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all border",
                    score ? "bg-white border-stone-100 shadow-sm" : "bg-stone-50 border-transparent",
                    isToday && "ring-2 ring-emerald-500 ring-offset-2"
                  )}
                >
                  <span className={cn("text-[0.625rem] md:text-xs font-black", score ? "text-stone-900" : "text-stone-300")}>
                    {format(day, 'd')}
                  </span>
                  {score && (
                    <div className="mt-0.5 flex flex-col items-center">
                      <span className="text-base md:text-lg leading-none">{getScoreEmoji(score.score)}</span>
                      <span className={cn("text-[0.5rem] font-black mt-0.5", getScoreColor(score.score))}>
                        {Math.round(score.score)}%
                      </span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Monthly Stats */}
        <div className="space-y-6">
          <div className="p-6 md:p-8 rounded-[2rem] shadow-sm border border-stone-100 card-vibrant-emerald relative overflow-hidden">
            <h3 className="text-sm md:text-lg font-black mb-6 flex items-center gap-2 uppercase tracking-widest text-stone-900">
              <CalendarIcon className="w-5 h-5 text-emerald-500" />
              {t.monthlyStats}
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-6">
              <div>
                <p className="text-[0.625rem] font-black text-stone-400 uppercase tracking-widest mb-1">{t.averageScore}</p>
                <p className={cn("text-3xl md:text-4xl font-black", getScoreColor(stats.average))}>
                  {Math.round(stats.average)}%
                </p>
              </div>
              <div>
                <p className="text-[0.625rem] font-black text-stone-400 uppercase tracking-widest mb-1">{t.daysLogged}</p>
                <p className="text-3xl md:text-4xl font-black text-stone-900">
                  {stats.count}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-emerald-600 p-6 md:p-8 rounded-[2rem] text-white shadow-lg shadow-emerald-200 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Sparkles className="w-12 h-12" />
            </div>
            <h3 className="text-base md:text-lg font-black mb-2 uppercase tracking-widest">{t.keepItUp}</h3>
            <p className="text-emerald-100 text-[0.625rem] md:text-sm leading-relaxed font-bold">
              {t.consistencyKey} {lang === 'Nepali' ? `यस महिना तपाईंको औसत स्कोर ${Math.round(stats.average)}% छ।` : `Your average score this month is ${Math.round(stats.average)}%.`} {t.beatNextMonth}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

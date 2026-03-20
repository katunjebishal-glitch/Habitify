import { useState, useMemo, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Habit, HabitLog, UserProfile, DailyScore } from '../types';
import { format, addDays, subDays, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Trophy, Zap } from 'lucide-react';
import HabitCard from './HabitCard';
import DailySummary from './DailySummary';
import HabitModal from './HabitModal';
import HabitChart from './HabitChart';
import { cn } from '../utils';
import { collection, addDoc, query, where, getDocs, setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { motion } from 'motion/react';
import { translations, Language } from '../translations';

interface DashboardProps {
  user: User;
  profile: UserProfile | null;
  habits: Habit[];
  logs: HabitLog[];
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  dailyScores: DailyScore[];
}

export default function Dashboard({ 
  user, 
  profile, 
  habits, 
  logs, 
  selectedDate, 
  setSelectedDate,
  dailyScores
}: DashboardProps) {
  const [isAddingHabit, setIsAddingHabit] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  const lang = (profile?.settings.language as Language) || 'English';
  const t = translations[lang] || translations.English;

  const dailyScore = useMemo(() => {
    const activeHabits = habits.filter(h => h.isActive);
    if (activeHabits.length === 0) return 0;

    let positiveWeightedSum = 0;
    let totalWeight = 0;
    let totalPenalty = 0;
    let hasAnyProgress = false;

    activeHabits.forEach(habit => {
      const log = logs.find(l => l.habitId === habit.id);
      const value = log ? log.value : 0;
      if (value > 0) hasAnyProgress = true;

      if (habit.type === 'positive') {
        // Only count score if habit is FULLY completed
        // This fixes the "5% score when no habits are completed" issue
        const isCompleted = habit.target > 0 ? value >= habit.target : false;
        const progress = isCompleted ? 1 : 0;
        
        positiveWeightedSum += progress * habit.weight;
        totalWeight += habit.weight;
      } else {
        if (habit.unit === 'binary') {
          if (value > 0) totalPenalty += habit.penalty;
        } else {
          const excess = Math.max(value - habit.target, 0);
          const interval = habit.penaltyInterval || 1;
          totalPenalty += (excess / interval) * habit.penalty;
        }
      }
    });

    // If no progress at all and no penalties, score must be 0
    if (!hasAnyProgress && totalPenalty === 0) return 0;

    const positiveScore = totalWeight > 0 ? (positiveWeightedSum / totalWeight) * 100 : 0;
    const score = positiveScore - totalPenalty;
    return Math.max(0, Math.min(100, score));
  }, [habits, logs]);

  // Update daily score in Firestore
  useEffect(() => {
    const updateScore = async () => {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const scoreId = `${user.uid}_${dateStr}`;
      const scoreRef = doc(db, 'dailyScores', scoreId);
      
      await setDoc(scoreRef, {
        userId: user.uid,
        date: dateStr,
        score: dailyScore,
        points: Math.floor(dailyScore / 10)
      }, { merge: true });
    };

    if (user && habits.length > 0) {
      updateScore();
    }
  }, [dailyScore, user, selectedDate, habits.length]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl md:text-4xl font-bold text-stone-900 tracking-tight truncate">
            {t.hello}, {profile?.displayName.split(' ')[0]}!
          </h1>
          <p className="text-stone-500 mt-1 text-sm md:text-base">{t.dashboardDesc}</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-stone-100">
          <button 
            onClick={() => setSelectedDate(subDays(selectedDate, 1))}
            className="p-2 hover:bg-stone-50 rounded-xl transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="px-4 font-semibold min-w-[140px] text-center">
            {isSameDay(selectedDate, new Date()) ? t.today : new Intl.DateTimeFormat(lang === 'Nepali' ? 'ne-NP' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(selectedDate)}
          </div>
          <button 
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            className="p-2 hover:bg-stone-50 rounded-xl transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <DailySummary score={dailyScore} lang={lang} />
        
        <div className="md:col-span-2">
          <HabitChart habits={habits} lang={lang} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-[2rem] shadow-sm border border-stone-100 flex items-center gap-4 card-vibrant-orange relative overflow-hidden">
          <div className="w-12 h-12 bg-amber-100/50 rounded-2xl flex items-center justify-center text-amber-600 shadow-sm">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[0.625rem] text-stone-400 font-black uppercase tracking-widest mb-1">{t.totalPoints}</p>
            <p className="text-2xl font-black text-stone-900">{profile?.stats.points || 0}</p>
          </div>
        </div>

        <div className="p-6 rounded-[2rem] shadow-sm border border-stone-100 flex items-center gap-4 card-vibrant-emerald relative overflow-hidden">
          <div className="w-12 h-12 bg-blue-100/50 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[0.625rem] text-stone-400 font-black uppercase tracking-widest mb-1">{t.currentLevel}</p>
            <p className="text-2xl font-black text-stone-900">Lvl {profile?.stats.level || 1}</p>
          </div>
        </div>
      </div>

      {/* Habits List */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            {t.dailyHabits}
            <span className="text-sm font-normal text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
              {habits.length}
            </span>
          </h2>
          <button 
            onClick={() => setIsAddingHabit(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t.addHabit}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {habits.map(habit => (
            <HabitCard 
              key={habit.id} 
              habit={habit} 
              log={logs.find(l => l.habitId === habit.id)}
              userId={user.uid}
              date={format(selectedDate, 'yyyy-MM-dd')}
              onEdit={(h) => setEditingHabit(h)}
              t={t}
            />
          ))}
        </div>
      </section>

      {/* Mobile FAB */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsAddingHabit(true)}
        className="lg:hidden fixed bottom-28 right-6 w-14 h-14 bg-emerald-600 text-white rounded-2xl shadow-xl shadow-emerald-200 z-40 flex items-center justify-center active:bg-emerald-700 transition-colors"
      >
        <Plus className="w-8 h-8" />
      </motion.button>

      {(isAddingHabit || editingHabit) && (
        <HabitModal 
          userId={user.uid} 
          userProfile={profile}
          habit={editingHabit}
          onClose={() => {
            setIsAddingHabit(false);
            setEditingHabit(null);
          }} 
        />
      )}
    </div>
  );
}

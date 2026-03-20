import { useState, useEffect } from 'react';
import { Habit, HabitLog } from '../types';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, setDoc, orderBy } from 'firebase/firestore';
import { Check, Minus, Plus, Edit2, Trash2, Info, Flame } from 'lucide-react';
import { cn } from '../utils';
import { motion } from 'motion/react';

interface HabitCardProps {
  habit: Habit;
  log?: HabitLog;
  userId: string;
  date: string;
  onEdit: (habit: Habit) => void;
  t: any;
}

export default function HabitCard({ habit, log, userId, date, onEdit, t }: HabitCardProps) {
  const [value, setValue] = useState(log?.value || 0);
  const [streak, setStreak] = useState(0);
  const [showDescription, setShowDescription] = useState(false);

  useEffect(() => {
    const fetchStreak = async () => {
      const logsRef = collection(db, 'logs');
      const q = query(
        logsRef,
        where('userId', '==', userId),
        where('habitId', '==', habit.id),
        orderBy('date', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const logs = snapshot.docs.map(d => d.data() as HabitLog);
      
      if (logs.length === 0) {
        setStreak(0);
        return;
      }

      let currentStreak = 0;
      const today = new Date().toISOString().split('T')[0];
      
      // Check if the most recent log is successful
      const isSuccessful = (l: HabitLog) => {
        if (habit.type === 'positive') return l.value >= habit.target;
        return l.value <= habit.target;
      };

      // Sort logs by date descending just in case
      const sortedLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date));
      
      const parseDate = (dStr: string) => {
        const [y, m, d] = dStr.split('-').map(Number);
        return new Date(y, m - 1, d);
      };
      
      const formatDate = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      let streakCount = 0;
      
      // Find the log for the current date in the card
      const currentLog = sortedLogs.find(l => l.date === date);
      
      if (currentLog && isSuccessful(currentLog)) {
        streakCount = 1;
        // Check previous days
        let prevDate = parseDate(date);
        while (true) {
          prevDate.setDate(prevDate.getDate() - 1);
          const prevDateStr = formatDate(prevDate);
          const prevLog = sortedLogs.find(l => l.date === prevDateStr);
          if (prevLog && isSuccessful(prevLog)) {
            streakCount++;
          } else {
            break;
          }
        }
      } else if (!currentLog || !isSuccessful(currentLog)) {
        // If today is not successful, streak is 0
        // BUT if today is the current date and we haven't logged yet, 
        // we might want to show the streak ending yesterday
        if (date === today && !currentLog) {
          let prevDate = parseDate(date);
          prevDate.setDate(prevDate.getDate() - 1);
          let prevDateStr = formatDate(prevDate);
          let prevLog = sortedLogs.find(l => l.date === prevDateStr);
          
          while (prevLog && isSuccessful(prevLog)) {
            streakCount++;
            prevDate.setDate(prevDate.getDate() - 1);
            prevDateStr = formatDate(prevDate);
            prevLog = sortedLogs.find(l => l.date === prevDateStr);
          }
        } else {
          streakCount = 0;
        }
      }

      setStreak(streakCount);
    };

    fetchStreak();
  }, [userId, habit.id, habit.target, habit.type, value, date]);

  const updateLog = async (newValue: number) => {
    const logId = log?.id || `${userId}_${habit.id}_${date}`;
    const logRef = doc(db, 'logs', logId);
    
    await setDoc(logRef, {
      userId,
      habitId: habit.id,
      date,
      value: newValue,
      timestamp: new Date().toISOString()
    }, { merge: true });
    
    setValue(newValue);
  };

  const handleIncrement = () => updateLog(value + 1);
  const handleDecrement = () => updateLog(Math.max(0, value - 1));
  const handleToggle = () => updateLog(value === 0 ? 1 : 0);

  const progress = habit.type === 'positive' 
    ? Math.min((value / habit.target) * 100, 100)
    : 0;

  return (
    <motion.div 
      layout
      className={cn(
        "p-3 sm:p-4 rounded-[1.5rem] sm:rounded-[2rem] shadow-sm border flex flex-col gap-2 sm:gap-3 transition-all hover:shadow-md group relative overflow-hidden",
        habit.type === 'positive' 
          ? "border-stone-100 card-vibrant-emerald" 
          : "border-stone-100 card-vibrant-red",
        habit.type === 'negative' && value > 0 && "border-red-200 bg-red-50/50"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <div className="relative shrink-0">
            <div className={cn(
              "w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center text-xl sm:text-2xl shadow-sm",
              habit.type === 'positive' ? "bg-emerald-100/50" : "bg-red-100/50"
            )}>
              {habit.emoji}
            </div>
            <button 
              onClick={() => onEdit(habit)}
              className="absolute -top-1 -left-1 p-1 bg-white rounded-lg shadow-sm border border-stone-100 text-stone-400 opacity-0 group-hover:opacity-100 hover:text-emerald-600 transition-all"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="font-black text-stone-900 leading-tight truncate text-sm sm:text-base">{habit.name}</h3>
              {streak > 0 && (
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded-full text-[0.5rem] sm:text-[0.625rem] font-black border border-orange-200 shrink-0">
                  <Flame className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-current" />
                  {streak}
                </div>
              )}
            </div>
            <p className="text-[0.5rem] sm:text-[0.625rem] text-stone-400 font-bold uppercase tracking-widest mt-0.5 truncate">
              {habit.type === 'positive' 
                ? `${habit.weight}% ${t.weight}` 
                : `${habit.penalty}% ${t.penalty}`}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-1 shrink-0">
          {habit.unit === 'binary' ? (
            <div className="flex bg-stone-900/5 p-0.5 sm:p-1 rounded-xl sm:rounded-2xl gap-0.5 sm:gap-1">
              {habit.type === 'positive' ? (
                <>
                  <button 
                    onClick={() => updateLog(1)}
                    className={cn(
                      "px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[0.5rem] sm:text-[0.625rem] font-black uppercase tracking-widest transition-all",
                      value === 1 ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200" : "text-stone-400 hover:text-stone-600"
                    )}
                  >
                    {habit.binaryLabel === 'yes' ? 'Yes' : 'Done'}
                  </button>
                  <button 
                    onClick={() => updateLog(0)}
                    className={cn(
                      "px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[0.5rem] sm:text-[0.625rem] font-black uppercase tracking-widest transition-all",
                      value === 0 ? "bg-white text-stone-600 shadow-sm" : "text-stone-400 hover:text-stone-600"
                    )}
                  >
                    {habit.binaryLabel === 'yes' ? 'No' : 'Skip'}
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => updateLog(1)}
                    className={cn(
                      "px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[0.5rem] sm:text-[0.625rem] font-black uppercase tracking-widest transition-all",
                      value === 1 ? "bg-red-600 text-white shadow-lg shadow-red-200" : "text-stone-400 hover:text-stone-600"
                    )}
                  >
                    {habit.binaryLabel === 'yes' ? 'Yes' : 'Done'}
                  </button>
                  <button 
                    onClick={() => updateLog(0)}
                    className={cn(
                      "px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl text-[0.5rem] sm:text-[0.625rem] font-black uppercase tracking-widest transition-all",
                      value === 0 ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200" : "text-stone-400 hover:text-stone-600"
                    )}
                  >
                    {habit.binaryLabel === 'yes' ? 'No' : 'Clean'}
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center bg-stone-900/5 rounded-xl sm:rounded-2xl p-0.5 sm:p-1">
              <button onClick={handleDecrement} className="p-1.5 sm:p-2 hover:bg-white rounded-lg sm:rounded-xl transition-all active:scale-90">
                <Minus className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
              <div className="w-8 sm:w-10 text-center font-black text-xs sm:text-sm">
                {value}
              </div>
              <button onClick={handleIncrement} className="p-1.5 sm:p-2 hover:bg-white rounded-lg sm:rounded-xl transition-all active:scale-90">
                <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {habit.unit !== 'binary' && habit.type === 'positive' && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[0.625rem] font-black uppercase tracking-widest">
            <span className="text-stone-400">{value} / {habit.target} {habit.unit}</span>
            <span className={cn(progress === 100 ? "text-emerald-600" : "text-stone-500")}>
              {Math.round(progress)}%
            </span>
          </div>
          <div className="h-1.5 bg-stone-900/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className={cn(
                "h-full transition-all duration-500",
                progress === 100 ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-stone-400"
              )}
            />
          </div>
        </div>
      )}

      {habit.type === 'negative' && value > 0 && (
        <div className="flex items-center gap-2 text-xs text-red-600 font-medium bg-red-50 p-2 rounded-lg">
          <Info className="w-4 h-4" />
          {t.penaltyApplied}: -{habit.unit === 'binary' ? habit.penalty : ((Math.max(0, value - habit.target) / (habit.penaltyInterval || 1)) * habit.penalty).toFixed(1)}%
        </div>
      )}

      {showDescription && habit.description && (
        <motion.div 
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="text-xs text-stone-500 bg-stone-50 p-3 rounded-xl border border-stone-100 leading-relaxed"
        >
          {habit.description}
        </motion.div>
      )}
    </motion.div>
  );
}

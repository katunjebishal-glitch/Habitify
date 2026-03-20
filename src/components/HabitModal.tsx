import { useState, useEffect } from 'react';
import { UserProfile, Habit } from '../types';
import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, deleteDoc, query, where, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils';
import { X, Trash2, Info, Sparkles, Loader2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { translations } from '../translations';

interface HabitModalProps {
  userId: string;
  userProfile?: UserProfile | null;
  habit?: Habit | null;
  onClose: () => void;
}

export default function HabitModal({ userId, userProfile, habit, onClose }: HabitModalProps) {
  const lang = userProfile?.settings?.language || 'English';
  const t = translations[lang as keyof typeof translations];

  const [name, setName] = useState(habit?.name || '');
  const [type, setType] = useState<'positive' | 'negative'>(habit?.type || 'positive');
  const [trackingType, setTrackingType] = useState<'binary' | 'numeric'>(habit?.unit === 'binary' ? 'binary' : 'numeric');
  const [target, setTarget] = useState(habit?.target || 1);
  const [unit, setUnit] = useState(habit?.unit === 'binary' ? '' : (habit?.unit || ''));
  const [weight, setWeight] = useState(habit?.weight || 25);
  const [penalty, setPenalty] = useState(habit?.penalty || 0);
  const [penaltyInterval, setPenaltyInterval] = useState(habit?.penaltyInterval || 1);
  const [emoji, setEmoji] = useState(habit?.emoji || '✨');
  const [description, setDescription] = useState(habit?.description || '');
  const [binaryLabel, setBinaryLabel] = useState<'done' | 'yes'>(habit?.binaryLabel || 'done');
  const [existingPositiveHabits, setExistingPositiveHabits] = useState<Habit[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const suggestHabitDetails = async () => {
    if (!name.trim()) return;
    setIsAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const userLang = userProfile?.settings?.language || 'English';
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `I want to create a habit called "${name}". 
        The user's preferred language is ${userLang}. Please provide the "description" and "unit" in this language if appropriate.
        
        Suggest the following details in JSON format:
        - type: "positive" or "negative"
        - trackingType: "binary" or "numeric"
        - target: number (if numeric)
        - unit: string (if numeric, e.g. "min", "pages", "L")
        - emoji: a single emoji
        - description: a short, motivating description explaining why this habit is good and how it works.
        - weight: a suggested weight percentage (1-100) if positive
        - penalty: a suggested penalty percentage (0.1-5) if negative
        - penaltyInterval: number (if negative and numeric, e.g. 5 for "per 5 min")`,
        config: {
          responseMimeType: "application/json"
        }
      });

      const data = JSON.parse(response.text || '{}');
      // Only allow type change if creating new habit
      if (data.type && !habit) setType(data.type as 'positive' | 'negative');
      
      if (data.trackingType) {
        const mappedType = data.trackingType === 'binary' ? 'binary' : 'numeric';
        setTrackingType(mappedType);
      }
      
      if (data.target) setTarget(Number(data.target));
      if (data.unit) setUnit(data.unit);
      if (data.emoji) setEmoji(data.emoji);
      if (data.description) setDescription(data.description);
      
      if (data.weight && (data.type === 'positive' || type === 'positive')) {
        setWeight(Number(data.weight));
      }
      
      if (data.penalty && (data.type === 'negative' || type === 'negative')) {
        setPenalty(Number(data.penalty));
      }
      
      if (data.penaltyInterval && (data.type === 'negative' || type === 'negative')) {
        setPenaltyInterval(Number(data.penaltyInterval));
      }
    } catch (error) {
      console.error("AI Suggestion Error:", error);
    } finally {
      setIsAiLoading(false);
    }
  };

  useEffect(() => {
    const fetchExisting = async () => {
      const q = query(
        collection(db, 'habits'),
        where('userId', '==', userId),
        where('type', '==', 'positive'),
        where('isActive', '==', true)
      );
      const snapshot = await getDocs(q);
      setExistingPositiveHabits(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Habit)));
    };
    fetchExisting();
  }, [userId]);

  const currentTotalWeight = existingPositiveHabits
    .filter(h => h.id !== habit?.id)
    .reduce((sum, h) => sum + h.weight, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let finalWeight = type === 'positive' ? weight : 0;
    const finalUnit = trackingType === 'binary' ? 'binary' : unit;
    const finalTarget = trackingType === 'binary' ? 1 : target;

    // Rebalancing logic for NEW positive habits
    if (!habit && type === 'positive') {
      if (existingPositiveHabits.length > 0) {
        const currentSum = existingPositiveHabits.reduce((sum, h) => sum + h.weight, 0);
        
        // Proportional deduction:
        // We want to reduce 'weight' from the 'currentSum'
        // Deduction from habit H_i = (H_i.weight / currentSum) * weight
        // New weight for H_i = H_i.weight - Deduction
        // New weight for H_i = H_i.weight * (1 - weight / currentSum)
        // New weight for H_i = H_i.weight * (currentSum - weight) / currentSum
        
        const factor = Math.max(0, (currentSum - weight) / currentSum);
        
        const updates = existingPositiveHabits.map(h => 
          updateDoc(doc(db, 'habits', h.id), {
            weight: Number((h.weight * factor).toFixed(2))
          })
        );
        await Promise.all(updates);
      } else {
        // First habit, default to 100% if user didn't change default
        if (weight === 25) finalWeight = 100;
      }
    }

    const habitData = {
      userId,
      name,
      type,
      target: finalTarget,
      unit: finalUnit,
      weight: finalWeight,
      penalty: type === 'negative' ? penalty : 0,
      penaltyInterval: type === 'negative' && trackingType === 'numeric' ? penaltyInterval : 1,
      emoji,
      description,
      binaryLabel: trackingType === 'binary' ? binaryLabel : undefined,
      isActive: true,
      updatedAt: new Date().toISOString()
    };

    if (habit) {
      await updateDoc(doc(db, 'habits', habit.id), habitData);
    } else {
      await addDoc(collection(db, 'habits'), {
        ...habitData,
        createdAt: new Date().toISOString()
      });
    }
    onClose();
  };

  const handleDelete = async () => {
    if (!habit) return;
    await deleteDoc(doc(db, 'habits', habit.id));
    onClose();
  };

  if (showDeleteConfirm) {
    return (
      <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl text-center"
        >
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-red-600">
            <Trash2 className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold mb-2">{t.deleteHabit}</h3>
          <p className="text-stone-500 mb-8 text-sm">
            {t.deleteConfirm} <span className="font-bold text-stone-900">"{habit?.name}"</span>? 
            {t.deleteWarning}
          </p>
          <div className="flex gap-3">
            <button 
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 py-3 bg-stone-100 text-stone-600 font-bold rounded-xl hover:bg-stone-200 transition-colors"
            >
              {t.cancel}
            </button>
            <button 
              onClick={handleDelete}
              className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors"
            >
              {t.delete}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 overscroll-none">
      <motion.div 
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="bg-white w-full max-w-md rounded-t-[2.5rem] sm:rounded-[2.5rem] p-6 sm:p-8 shadow-2xl relative max-h-[92vh] overflow-y-auto pb-12 sm:pb-8"
      >
        <button 
          onClick={onClose} 
          className="absolute right-6 top-6 p-2 text-stone-400 hover:text-stone-600 bg-stone-50 rounded-full sm:bg-transparent"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-stone-900">{habit ? t.editHabit : t.createHabit}</h2>
          <p className="text-sm text-stone-500">{t.dashboardDesc}</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t.habitName}</label>
            <div className="flex gap-2">
              <input 
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="flex-1 p-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="e.g. Read 20 pages"
              />
              <button
                type="button"
                onClick={suggestHabitDetails}
                disabled={!name.trim() || isAiLoading}
                className={cn(
                  "px-4 rounded-xl border flex items-center gap-2 transition-all",
                  isAiLoading 
                    ? "bg-stone-50 border-stone-100 text-stone-400 cursor-not-allowed" 
                    : "bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100"
                )}
                title={t.suggestDetails}
              >
                {isAiLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">{t.aiHelpBtn}</span>
                  </>
                )}
              </button>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex gap-4">
              <button 
                type="button"
                disabled={!!habit}
                onClick={() => setType('positive')}
                className={cn(
                  "flex-1 py-3 rounded-xl font-medium border transition-all",
                  type === 'positive' ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "border-stone-200 text-stone-500",
                  habit && "opacity-50 cursor-not-allowed"
                )}
              >
                {t.positive}
              </button>
              <button 
                type="button"
                disabled={!!habit}
                onClick={() => setType('negative')}
                className={cn(
                  "flex-1 py-3 rounded-xl font-medium border transition-all",
                  type === 'negative' ? "bg-red-50 border-red-200 text-red-700" : "border-stone-200 text-stone-500",
                  habit && "opacity-50 cursor-not-allowed"
                )}
              >
                {t.negative}
              </button>
            </div>

            <div className="flex gap-4">
              <button 
                type="button"
                onClick={() => setTrackingType('binary')}
                className={cn(
                  "flex-1 py-2 rounded-xl text-sm font-medium border transition-all",
                  trackingType === 'binary' ? "bg-stone-900 text-white border-stone-900" : "border-stone-200 text-stone-500"
                )}
              >
                {t.binary}
              </button>
              <button 
                type="button"
                onClick={() => setTrackingType('numeric')}
                className={cn(
                  "flex-1 py-2 rounded-xl text-sm font-medium border transition-all",
                  trackingType === 'numeric' ? "bg-stone-900 text-white border-stone-900" : "border-stone-200 text-stone-500"
                )}
              >
                {t.numeric}
              </button>
            </div>

            {trackingType === 'binary' && (
              <div className="flex gap-4 bg-stone-50 p-1 rounded-xl border border-stone-100">
                <button 
                  type="button"
                  onClick={() => setBinaryLabel('done')}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
                    binaryLabel === 'done' ? "bg-white text-stone-900 shadow-sm" : "text-stone-400 hover:text-stone-600"
                  )}
                >
                  Done / Not Done
                </button>
                <button 
                  type="button"
                  onClick={() => setBinaryLabel('yes')}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-xs font-bold transition-all",
                    binaryLabel === 'yes' ? "bg-white text-stone-900 shadow-sm" : "text-stone-400 hover:text-stone-600"
                  )}
                >
                  Yes / No
                </button>
              </div>
            )}
          </div>

          {trackingType === 'numeric' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">{t.target}</label>
                <input 
                  type="number"
                  required
                  value={target}
                  onChange={e => setTarget(Number(e.target.value))}
                  className="w-full p-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">{t.unit}</label>
                <input 
                  required
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  className="w-full p-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="e.g. min, L, pages"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">{t.emoji}</label>
              <input 
                required
                value={emoji}
                onChange={e => setEmoji(e.target.value)}
                className="w-full p-3 rounded-xl border border-stone-200 text-center text-xl"
              />
            </div>
            {type === 'positive' ? (
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-stone-700">{t.weight} (%)</label>
                  <span className="text-[0.625rem] font-bold text-emerald-600 uppercase tracking-wider">
                    Total: {Math.round(currentTotalWeight + weight)}%
                  </span>
                </div>
                <input 
                  type="number"
                  required
                  min="1"
                  max="100"
                  value={weight}
                  onChange={e => setWeight(Number(e.target.value))}
                  className="w-full p-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    {t.penalty} (%)
                  </label>
                  <input 
                    type="number"
                    required
                    step="0.1"
                    value={penalty}
                    onChange={e => setPenalty(Number(e.target.value))}
                    className="w-full p-3 rounded-xl border border-stone-200"
                  />
                </div>
                {trackingType === 'numeric' && (
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">
                      {t.per} ({t.target})
                    </label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number"
                        required
                        min="1"
                        value={penaltyInterval}
                        onChange={e => setPenaltyInterval(Number(e.target.value))}
                        className="flex-1 p-3 rounded-xl border border-stone-200"
                      />
                      <span className="text-sm text-stone-500">{unit || 'units'}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {type === 'positive' && !habit && (
            <div className="mt-2 flex items-start gap-2 bg-emerald-50 p-3 rounded-xl border border-emerald-100">
              <Info className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <p className="text-[0.6875rem] text-emerald-700 leading-relaxed">
                {t.rebalanceNote}
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t.description}</label>
            <textarea 
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full p-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-emerald-500 outline-none min-h-[80px] resize-none"
              placeholder="Why is this habit important? Any specific rules?"
            />
          </div>

          <div className="flex justify-between items-center pt-6">
            {habit && (
              <button 
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="p-3 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <div className="flex gap-3 ml-auto">
              <button 
                type="button"
                onClick={onClose}
                className="px-6 py-3 text-stone-500 font-medium hover:bg-stone-50 rounded-xl transition-colors"
              >
                {t.cancel}
              </button>
              <button 
                type="submit"
                disabled={isAiLoading}
                className={cn(
                  "px-6 py-3 bg-stone-900 text-white font-bold rounded-2xl transition-all active:scale-95",
                  isAiLoading ? "opacity-50 cursor-not-allowed" : "hover:bg-stone-800"
                )}
              >
                {isAiLoading ? t.aiThinking : (habit ? t.saveChanges : t.createHabitBtn)}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

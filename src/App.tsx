/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  updateDoc,
  addDoc,
  deleteDoc,
  Timestamp,
  orderBy
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { Habit, HabitLog, UserProfile, DailyScore } from './types';
import { format, startOfDay, endOfDay, isWeekend, isSameDay } from 'date-fns';
import { 
  LayoutDashboard, 
  Calendar as CalendarIcon, 
  Settings as SettingsIcon, 
  Plus, 
  LogOut, 
  BrainCircuit, 
  Trophy,
  History,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { cn, getScoreEmoji, getScoreColor } from './utils';
import { motion, AnimatePresence } from 'motion/react';

// Components
import HabitCard from './components/HabitCard';
import DailySummary from './components/DailySummary';
import AIHelp from './components/AIHelp';
import Settings from './components/Settings';
import CalendarView from './components/CalendarView';
import Dashboard from './components/Dashboard';

import { translations, Language } from './translations';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [dailyScores, setDailyScores] = useState<DailyScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'calendar' | 'settings' | 'ai'>('dashboard');
  const [selectedDate, setSelectedDate] = useState(new Date());

  const lang = (profile?.settings.language as Language) || 'English';
  const t = translations[lang] || translations.English;

  // Auth Listener
  useEffect(() => {
    let profileUnsubscribe: (() => void) | undefined;

    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        const profileRef = doc(db, 'users', firebaseUser.uid);
        
        // Listen to profile changes in real-time
        profileUnsubscribe = onSnapshot(profileRef, async (snapshot) => {
          if (snapshot.exists()) {
            setProfile(snapshot.data() as UserProfile);
            setLoading(false);
          } else {
            // Create profile if it doesn't exist
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName || 'User',
              email: firebaseUser.email || '',
              photoURL: firebaseUser.photoURL || undefined,
              settings: {
                theme: 'light',
                notifications: true,
                emailAlerts: true,
                dailyGoalThreshold: 60,
                language: 'English',
                fontSize: 'medium',
                layoutDensity: 'spacious',
                mobileUsageLimit: 120,
                mobileUsagePenalty: 0.5,
                mobileUsagePenaltyInterval: 5,
              },
              stats: {
                points: 0,
                level: 1,
                bestStreak: 0,
              }
            };
            await setDoc(profileRef, newProfile);
            // The snapshot listener will pick this up
          }
        });

        // Seed default habits if they don't exist
        const habitsRef = collection(db, 'habits');
        const q = query(habitsRef, where('userId', '==', firebaseUser.uid));
        const habitsSnap = await getDocs(q);
        
        if (habitsSnap.empty) {
          const defaultHabits = [
            { name: 'Water Intake', type: 'positive', target: 4, unit: 'L', weight: 25, emoji: '💧', isActive: true },
            { name: 'Wake-Up Time', type: 'positive', target: 1, unit: 'binary', weight: 25, emoji: '⏰', isActive: true },
            { name: 'Secret Task (NO TO DO)', type: 'negative', target: 0, unit: 'binary', weight: 0, penalty: 20, emoji: '🤫', isActive: true },
            { name: 'Phone Use Limit', type: 'negative', target: 120, unit: 'min', weight: 0, penalty: 0.5, penaltyInterval: 5, emoji: '📱', isActive: true }
          ];
          
          for (const h of defaultHabits) {
            await addDoc(collection(db, 'habits'), {
              ...h,
              userId: firebaseUser.uid,
              createdAt: new Date().toISOString(),
              penalty: h.penalty || 0
            });
          }
        }
      } else {
        setProfile(null);
        setHabits([]);
        setLogs([]);
        setLoading(false);
      }
    });

    return () => {
      authUnsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
    };
  }, []);

  // Apply theme and settings to document
  useEffect(() => {
    if (profile?.settings) {
      const root = document.documentElement;
      
      // Theme
      if (profile.settings.theme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      
      // Font Size
      root.setAttribute('data-font-size', profile.settings.fontSize || 'medium');
      
      // Layout Density
      root.setAttribute('data-layout', profile.settings.layoutDensity || 'spacious');
      
      // Apply spacing multiplier to a CSS variable for global use
      const multiplier = profile.settings.layoutDensity === 'compact' ? '0.75' : '1.25';
      root.style.setProperty('--spacing-multiplier', multiplier);
    }
  }, [profile]);

  // Data Listeners
  useEffect(() => {
    if (!user) return;

    const habitsQuery = query(collection(db, 'habits'), where('userId', '==', user.uid));
    const habitsUnsubscribe = onSnapshot(habitsQuery, (snapshot) => {
      setHabits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Habit)));
    });

    const logsQuery = query(
      collection(db, 'logs'), 
      where('userId', '==', user.uid),
      where('date', '==', format(selectedDate, 'yyyy-MM-dd'))
    );
    const logsUnsubscribe = onSnapshot(logsQuery, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HabitLog)));
    });

    const scoresQuery = query(
      collection(db, 'dailyScores'), 
      where('userId', '==', user.uid),
      orderBy('date', 'desc')
    );
    const scoresUnsubscribe = onSnapshot(scoresQuery, (snapshot) => {
      setDailyScores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyScore)));
    });

    return () => {
      habitsUnsubscribe();
      logsUnsubscribe();
      scoresUnsubscribe();
    };
  }, [user, selectedDate]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-stone-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-stone-50 p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl text-center border border-stone-100"
        >
          <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold text-stone-900 mb-2">Habitify v6.0</h1>
          <p className="text-stone-500 mb-8">The ultimate AI-powered habit management platform for personal growth.</p>
          <button 
            onClick={handleLogin}
            className="w-full py-4 bg-stone-900 text-white rounded-2xl font-semibold hover:bg-stone-800 transition-colors flex items-center justify-center gap-3"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="Google" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans pb-24 lg:pb-0 lg:pl-20 overflow-x-hidden w-full">
      {/* Sidebar / Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 lg:top-0 lg:bottom-0 lg:w-20 bg-white/80 backdrop-blur-lg border-t lg:border-t-0 lg:border-r border-stone-200 z-50 flex lg:flex-col items-center justify-around lg:justify-center gap-8 p-4 pb-6 lg:pb-4">
        <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard className="w-6 h-6" />} label={t.home} />
        <NavButton active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} icon={<CalendarIcon className="w-6 h-6" />} label={t.calendar} />
        <NavButton active={activeTab === 'ai'} onClick={() => setActiveTab('ai')} icon={<BrainCircuit className="w-6 h-6" />} label={t.aiHelp} />
        <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<SettingsIcon className="w-6 h-6" />} label={t.settings} />
        <button onClick={handleLogout} className="p-3 text-stone-400 hover:text-red-500 transition-colors hidden lg:block mt-auto" title={t.logout}>
          <LogOut className="w-6 h-6" />
        </button>
      </nav>

      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 bg-stone-50/80 backdrop-blur-md z-40 px-6 py-4 flex items-center justify-between border-b border-stone-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight leading-none">Habitify</h1>
            <p className="text-[0.625rem] text-stone-400 font-bold uppercase tracking-widest mt-0.5">Level {profile?.stats.level || 1}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[0.625rem] text-stone-400 font-bold uppercase tracking-widest">{t.pointsEarned}</p>
            <p className="text-sm font-black text-emerald-600">{profile?.stats.points || 0}</p>
          </div>
          <img 
            src={profile?.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName}`} 
            className="w-10 h-10 rounded-xl border-2 border-white shadow-sm"
            alt={profile?.displayName}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto p-3 sm:p-6 lg:p-12">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <Dashboard 
                user={user} 
                profile={profile} 
                habits={habits} 
                logs={logs} 
                selectedDate={selectedDate} 
                setSelectedDate={setSelectedDate}
                dailyScores={dailyScores}
              />
            </motion.div>
          )}
          {activeTab === 'calendar' && (
            <motion.div key="calendar" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <CalendarView dailyScores={dailyScores} profile={profile} />
            </motion.div>
          )}
          {activeTab === 'ai' && (
            <motion.div key="ai" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <AIHelp userProfile={profile} habits={habits} logs={logs} />
            </motion.div>
          )}
          {activeTab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <Settings profile={profile} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-0.5 sm:gap-1 p-1 sm:p-2 transition-all relative",
        active ? "text-emerald-600" : "text-stone-400 hover:text-stone-600"
      )}
    >
      <div className={cn(
        "p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-all duration-300", 
        active ? "bg-emerald-50 scale-110 shadow-sm shadow-emerald-100" : "hover:bg-stone-50"
      )}>
        {icon}
      </div>
      <span className={cn(
        "text-[0.5rem] sm:text-[0.625rem] font-black uppercase tracking-widest lg:hidden transition-all",
        active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
      )}>{label}</span>
      {active && (
        <motion.div 
          layoutId="nav-dot"
          className="absolute -bottom-1 w-1 h-1 bg-emerald-500 rounded-full lg:hidden"
        />
      )}
    </button>
  );
}

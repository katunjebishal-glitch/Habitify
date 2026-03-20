import { useState } from 'react';
import { UserProfile } from '../types';
import { db } from '../firebase';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { User, Bell, Mail, Shield, Palette, Trash2, Globe, Smartphone, AlertCircle, Type, Layout, Sparkles, Loader2 } from 'lucide-react';
import { cn } from '../utils';
import { GoogleGenAI } from "@google/genai";
import { translations, Language } from '../translations';

interface SettingsProps {
  profile: UserProfile | null;
}

export default function Settings({ profile }: SettingsProps) {
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [showAiInput, setShowAiInput] = useState(false);

  if (!profile) return null;

  const lang = (profile.settings.language as Language) || 'English';
  const t = translations[lang] || translations.English;
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const updateSettingLogic = async (key: string, value: any) => {
    try {
      const profileRef = doc(db, 'users', profile.uid);
      await updateDoc(profileRef, {
        [`settings.${key}`]: value
      });

      setSaveStatus(key);
      setTimeout(() => setSaveStatus(null), 2000);

      // If updating mobileUsageLimit, also try to update the "Phone Use Limit" habit target
      if (key === 'mobileUsageLimit') {
        const habitsRef = collection(db, 'habits');
        const q = query(
          habitsRef, 
          where('userId', '==', profile.uid), 
          where('name', '==', 'Phone Use Limit')
        );
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const habitDoc = querySnapshot.docs[0];
          await updateDoc(doc(db, 'habits', habitDoc.id), {
            target: Number(value)
          });
        }
      }

      // If updating mobileUsagePenalty or mobileUsagePenaltyInterval, also try to update the "Phone Use Limit" habit
      if (key === 'mobileUsagePenalty' || key === 'mobileUsagePenaltyInterval') {
        const habitsRef = collection(db, 'habits');
        const q = query(
          habitsRef, 
          where('userId', '==', profile.uid), 
          where('name', '==', 'Phone Use Limit')
        );
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const habitDoc = querySnapshot.docs[0];
          await updateDoc(doc(db, 'habits', habitDoc.id), {
            penalty: key === 'mobileUsagePenalty' ? Number(value) : profile.settings.mobileUsagePenalty,
            penaltyInterval: key === 'mobileUsagePenaltyInterval' ? Number(value) : profile.settings.mobileUsagePenaltyInterval
          });
        }
      }
    } catch (error) {
      console.error('Error updating setting:', error);
    }
  };

  const suggestScreenTimeLimit = async () => {
    if (!aiInput.trim()) return;
    setIsAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `The user says: "${aiInput}". 
        Based on this, suggest a daily mobile usage limit in minutes. 
        Return ONLY a JSON object with a "limit" field (number).`,
        config: { responseMimeType: "application/json" }
      });
      const data = JSON.parse(response.text || '{}');
      if (data.limit) {
        await updateSettingLogic('mobileUsageLimit', data.limit);
        setShowAiInput(false);
        setAiInput('');
      }
    } catch (error) {
      console.error("AI Screen Time Error:", error);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-12">
      <header>
        <h1 className="text-3xl font-bold">{t.settings}</h1>
        <p className="text-stone-500 mt-1">{t.settingsDesc}</p>
      </header>

      <section className="space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <User className="w-5 h-5 text-stone-400" />
          {t.profile}
        </h2>
        <div className="bg-white p-6 rounded-3xl border border-stone-100 flex items-center gap-4">
          <img 
            src={profile.photoURL || `https://ui-avatars.com/api/?name=${profile.displayName}`} 
            className="w-16 h-16 rounded-2xl"
            alt={profile.displayName}
          />
          <div>
            <h3 className="font-bold text-lg">{profile.displayName}</h3>
            <p className="text-stone-500">{profile.email}</p>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Globe className="w-5 h-5 text-stone-400" />
          {t.general}
        </h2>
        <div className="bg-white p-6 rounded-3xl border border-stone-100 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold">{t.language}</p>
              <p className="text-sm text-stone-500">{t.languageDesc}</p>
            </div>
            <select 
              value={profile.settings.language}
              onChange={(e) => updateSettingLogic('language', e.target.value)}
              className={cn(
                "p-2 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 transition-all",
                saveStatus === 'language' && "ring-2 ring-emerald-500"
              )}
            >
              <option value="English">English</option>
              <option value="Nepali">नेपाली (Nepali)</option>
            </select>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-stone-400" />
                  {t.mobileLimit}
                </p>
                <p className="text-sm text-stone-500">{t.mobileLimitDesc}</p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowAiInput(!showAiInput)}
                  className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                  title="AI Help"
                >
                  <Sparkles className="w-4 h-4" />
                </button>
                <input 
                  type="number"
                  value={profile.settings.mobileUsageLimit}
                  onChange={(e) => updateSettingLogic('mobileUsageLimit', Number(e.target.value))}
                  className={cn(
                    "w-20 p-2 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-center transition-all",
                    saveStatus === 'mobileUsageLimit' && "ring-2 ring-emerald-500"
                  )}
                />
                <span className="text-sm text-stone-500 font-medium">{t.min}</span>
              </div>
            </div>

            {showAiInput && (
              <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 space-y-3">
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">{t.aiAssistant}</p>
                <textarea 
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  placeholder={t.aiAssistantPlaceholder}
                  className="w-full p-3 rounded-xl border border-emerald-100 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 min-h-[60px]"
                />
                <button 
                  onClick={suggestScreenTimeLimit}
                  disabled={isAiLoading || !aiInput.trim()}
                  className="w-full py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                >
                  {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {t.suggestLimit}
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                {t.excessPenalty}
              </p>
              <p className="text-sm text-stone-500">{t.excessPenaltyDesc}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input 
                  type="number"
                  step="0.1"
                  value={profile.settings.mobileUsagePenalty}
                  onChange={(e) => updateSettingLogic('mobileUsagePenalty', Number(e.target.value))}
                  className="w-16 p-2 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-center"
                />
                <span className="text-sm text-stone-500 font-medium">%</span>
              </div>
              <span className="text-stone-300">{t.per}</span>
              <div className="flex items-center gap-2">
                <input 
                  type="number"
                  value={profile.settings.mobileUsagePenaltyInterval}
                  onChange={(e) => updateSettingLogic('mobileUsagePenaltyInterval', Number(e.target.value))}
                  className="w-16 p-2 bg-stone-50 border border-stone-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-center"
                />
                <span className="text-sm text-stone-500 font-medium">{t.min}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Palette className="w-5 h-5 text-stone-400" />
          {t.appearance}
        </h2>
        <div className="bg-white p-6 rounded-3xl border border-stone-100 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold">{t.darkMode}</p>
              <p className="text-sm text-stone-500">{t.darkModeDesc}</p>
            </div>
            <button 
              onClick={() => updateSettingLogic('theme', profile.settings.theme === 'light' ? 'dark' : 'light')}
              className={cn(
                "w-12 h-6 rounded-full transition-all relative",
                profile.settings.theme === 'dark' ? "bg-emerald-500" : "bg-stone-200"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                profile.settings.theme === 'dark' ? "left-7" : "left-1"
              )} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold flex items-center gap-2">
                <Type className="w-4 h-4 text-stone-400" />
                {t.fontSize}
              </p>
              <p className="text-sm text-stone-500">{t.fontSizeDesc}</p>
            </div>
            <div className="flex bg-stone-50 p-1 rounded-xl border border-stone-100">
              {(['small', 'medium', 'large'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => updateSettingLogic('fontSize', size)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all",
                    profile.settings.fontSize === size ? "bg-white text-stone-900 shadow-sm" : "text-stone-400"
                  )}
                >
                  {t[size]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold flex items-center gap-2">
                <Layout className="w-4 h-4 text-stone-400" />
                {t.layoutDensity}
              </p>
              <p className="text-sm text-stone-500">{t.layoutDensityDesc}</p>
            </div>
            <div className="flex bg-stone-50 p-1 rounded-xl border border-stone-100">
              {(['compact', 'spacious'] as const).map((density) => (
                <button
                  key={density}
                  onClick={() => updateSettingLogic('layoutDensity', density)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all",
                    profile.settings.layoutDensity === density ? "bg-white text-stone-900 shadow-sm" : "text-stone-400"
                  )}
                >
                  {t[density]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Bell className="w-5 h-5 text-stone-400" />
          {t.notifications}
        </h2>
        <div className="bg-white p-6 rounded-3xl border border-stone-100 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold">{t.pushNotifications}</p>
              <p className="text-sm text-stone-500">{t.pushNotificationsDesc}</p>
            </div>
            <button 
              onClick={() => updateSettingLogic('notifications', !profile.settings.notifications)}
              className={cn(
                "w-12 h-6 rounded-full transition-all relative",
                profile.settings.notifications ? "bg-emerald-500" : "bg-stone-200"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                profile.settings.notifications ? "left-7" : "left-1"
              )} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold">{t.emailAlerts}</p>
              <p className="text-sm text-stone-500">{t.emailAlertsDesc} {profile.settings.dailyGoalThreshold}%.</p>
            </div>
            <button 
              onClick={() => updateSettingLogic('emailAlerts', !profile.settings.emailAlerts)}
              className={cn(
                "w-12 h-6 rounded-full transition-all relative",
                profile.settings.emailAlerts ? "bg-emerald-500" : "bg-stone-200"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                profile.settings.emailAlerts ? "left-7" : "left-1"
              )} />
            </button>
          </div>
        </div>
      </section>

      <section className="pt-8 border-t border-stone-200">
        <button 
          onClick={() => {
            if (confirm('Are you sure you want to delete your account? This action is irreversible.')) {
              alert('Account deletion requested. Please contact support for final verification.');
            }
          }}
          className="flex items-center gap-2 text-red-500 font-bold hover:text-red-600 transition-colors"
        >
          <Trash2 className="w-5 h-5" />
          {t.deleteAccount}
        </button>
      </section>
    </div>
  );
}

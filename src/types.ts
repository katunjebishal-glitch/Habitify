export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  settings: {
    theme: 'light' | 'dark';
    notifications: boolean;
    emailAlerts: boolean;
    dailyGoalThreshold: number;
    language: string;
    fontSize: 'small' | 'medium' | 'large';
    layoutDensity: 'compact' | 'spacious';
    mobileUsageLimit: number; // in minutes
    mobileUsagePenalty: number; // penalty percentage
    mobileUsagePenaltyInterval: number; // in minutes (e.g. 5 for "per 5 min")
  };
  stats: {
    points: number;
    level: number;
    bestStreak: number;
  };
}

export interface Habit {
  id: string;
  userId: string;
  name: string;
  type: 'positive' | 'negative';
  target: number;
  unit: string;
  weight: number;
  penalty: number;
  penaltyInterval?: number; // e.g. 5 for "per 5 minutes"
  emoji: string;
  description?: string;
  binaryLabel?: 'done' | 'yes';
  createdAt: string;
  isActive: boolean;
}

export interface HabitLog {
  id: string;
  userId: string;
  habitId: string;
  date: string; // YYYY-MM-DD
  value: number;
  note?: string;
  timestamp: string;
}

export interface DailyScore {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  score: number;
  points: number;
}

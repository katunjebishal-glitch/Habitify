import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatScore(score: number): string {
  return `${Math.round(score)}%`;
}

export function getScoreEmoji(score: number): string {
  if (score >= 95) return '😍';
  if (score >= 90) return '😄';
  if (score >= 80) return '🙂';
  if (score >= 70) return '😐';
  if (score >= 60) return '😕';
  return '😢';
}

export function getScoreColor(score: number): string {
  if (score >= 95) return 'text-green-600';
  if (score >= 90) return 'text-green-500';
  if (score >= 80) return 'text-yellow-500';
  if (score >= 70) return 'text-orange-500';
  if (score >= 60) return 'text-red-500';
  return 'text-red-700';
}

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Habit } from '../types';

interface HabitChartProps {
  habits: Habit[];
  lang: string;
}

const COLORS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1'
];

export default function HabitChart({ habits, lang }: HabitChartProps) {
  const positiveHabits = habits.filter(h => h.type === 'positive' && h.isActive);
  
  const data = positiveHabits.map(h => ({
    name: h.name,
    value: h.weight
  }));

  if (data.length === 0) return null;

  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-stone-100">
      <h3 className="text-lg font-bold mb-4 text-stone-900">
        {lang === 'Nepali' ? 'बानी वजन वितरण' : 'Habit Weight Distribution'}
      </h3>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                borderRadius: '1rem', 
                border: 'none', 
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' 
              }}
            />
            <Legend verticalAlign="bottom" height={36}/>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

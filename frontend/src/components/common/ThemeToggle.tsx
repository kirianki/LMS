'use client';

import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeProvider';

export default function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    return (
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/5">
            {[
                { id: 'light', icon: Sun, label: 'Light' },
                { id: 'dark', icon: Moon, label: 'Dark' },
                { id: 'system', icon: Monitor, label: 'System' },
            ].map((t) => (
                <button
                    key={t.id}
                    onClick={() => setTheme(t.id as any)}
                    title={t.label}
                    className={`p-2 rounded-lg transition-all ${theme === t.id
                            ? 'bg-primary text-white shadow-lg'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    <t.icon className="h-4 w-4" />
                </button>
            ))}
        </div>
    );
}

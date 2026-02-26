import Link from 'next/link';
import { ShieldCheck, ArrowRight, Gauge, BarChart3, Users2 } from 'lucide-react';

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-primary/20 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-secondary/20 blur-[120px]" />

      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-24 text-center">
        <header className="mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
            <ShieldCheck className="h-4 w-4" />
            <span>Trusted by 100+ MFIs worldwide</span>
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-foreground sm:text-7xl font-heading mb-6">
            Lending for the <br />
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Next Generation.
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed mb-10">
            Aurum Finance provides a robust, multi-tenant Loan Management System designed to
            empower microfinance institutions and SACCOs with AI-powered analytics and seamless automation.
          </p>
        </header>

        <div className="flex flex-col sm:flex-row gap-4 mb-20">
          <Link
            href="/login"
            className="group flex h-14 items-center justify-center gap-2 rounded-full bg-primary px-8 font-bold text-white transition-all hover:bg-primary/90 hover:scale-105 active:scale-95"
          >
            Go to Console
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="/signup"
            className="flex h-14 items-center justify-center rounded-full border border-border bg-input px-8 font-bold text-foreground backdrop-blur-sm transition-all hover:bg-muted hover:scale-105 active:scale-95"
          >
            Create Free Account
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl">
          {[
            { icon: Gauge, title: 'Real-time Metrics', desc: 'Monitor your portfolio health with live data visualizations.' },
            { icon: BarChart3, title: 'AI Scoring', desc: 'Leverage hybrid credit scoring to reduce non-performing loans.' },
            { icon: Users2, title: 'Multi-Tenancy', desc: 'Secure, isolated environments for every workspace.' },
          ].map((feature, i) => (
            <div key={i} className="glass p-8 rounded-2xl text-left hover:border-primary/50 transition-colors group">
              <feature.icon className="h-10 w-10 text-primary mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-bold text-foreground mb-2">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="absolute bottom-8 left-0 w-full text-center text-muted-foreground text-sm">
        © 2026 Aurum Finance. All rights reserved.
      </footer>
    </div>
  );
}

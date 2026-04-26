'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ParticleGlobe } from '@/components/ParticleGlobe';
import { BentoGrid, BentoCard, useBentoReveal } from '@/components/BentoCard';
import { useAuth } from '@/lib/auth-context';

const FEATURES = [
  { icon: '✦', title: 'AI Campaign Engine',    desc: 'One brief → full campaign strategy, angles, and creatives automatically.',  tag: 'Core',     featured: true },
  { icon: '🎯', title: 'Angle Intelligence',    desc: 'Multiple creative angles tested and ranked for your specific audience.',    tag: 'AI' },
  { icon: '🔄', title: 'Outcome Learning Loop', desc: 'Report real performance and watch the AI improve every generation.',        tag: 'Learning' },
  { icon: '📊', title: 'Evolution Engine',      desc: 'Top-performing angles evolve; underperformers are pruned automatically.',   tag: 'Auto',     featured: true },
  { icon: '🎬', title: 'Video Creatives',       desc: 'Scroll-stopping video scripts optimised for stories and reels.',           tag: 'Format' },
  { icon: '🖼',  title: 'Carousel Ads',         desc: 'Swipeable slide sequences built for maximum engagement.',                  tag: 'Format' },
  { icon: '⬛', title: 'Display Banners',       desc: 'High-converting static banners for display and programmatic campaigns.',   tag: 'Format' },
  { icon: '◎',  title: 'Observatory',          desc: 'Live AI decision observability — see exactly what the engine is thinking.', tag: 'Admin' },
  { icon: '⚡', title: 'Instant Generation',   desc: 'Full campaigns ready in under 10 seconds from a single sentence.',         tag: 'Speed' },
];

const STEPS = [
  { num: '1', title: 'Describe your product', desc: "Write a sentence about what you're promoting and who it's for." },
  { num: '2', title: 'AI builds the campaign', desc: 'The engine generates concepts, angles, and creatives in seconds.' },
  { num: '3', title: 'Export and iterate', desc: 'Launch, report results, and watch the AI get smarter each run.' },
];

const TOOLS = [
  '✦ Campaign Engine', '🎯 Angle Tester', '🔄 Outcome Loop', '📊 Evolution Engine',
  '🎬 Video Scripts', '🖼 Carousel Builder', '⬛ Banner Creator', '◎ Observatory',
  '⚡ Instant Gen', '🧠 Creative DNA', '📈 Performance Tracker', '🔍 Audience Analyzer',
  '💡 Idea Generator', '📋 Brief Builder', '🗂 Campaign Library', '🤖 AI Copywriter',
  '🎨 Visual Concepts', '📡 Signal Engine',
];

const STATS: { label: string; target: number; suffix: string }[] = [
  { label: 'AI Tools',       target: 9,   suffix: '' },
  { label: 'Ad Formats',     target: 100, suffix: '+' },
  { label: 'States Covered', target: 50,  suffix: '' },
  { label: 'Command Center', target: 1,   suffix: '' },
];

function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.reveal');
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) { (e.target as HTMLElement).classList.add('visible'); obs.unobserve(e.target); }
      }),
      { threshold: 0.12 }
    );
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);
}

function AnimatedStat({ target, suffix }: { target: number; suffix: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const duration = 1200;
        const start = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - start) / duration, 1);
          setCount(Math.round((1 - Math.pow(1 - p, 3)) * target));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        obs.disconnect();
      }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target]);
  return <div ref={ref} className="stats-strip-value">{count}{suffix}</div>;
}

function FeaturesSection() {
  const gridRef = useBentoReveal();
  return (
    <section className="features-section" id="features">
      <h2 className="features-section-title reveal">Everything you need to win</h2>
      <BentoGrid ref={gridRef}>
        {FEATURES.map(f => (
          <BentoCard
            key={f.title}
            icon={<span style={{ fontSize: 22 }}>{f.icon}</span>}
            title={f.title}
            description={f.desc}
            tag={f.tag}
            featured={f.featured}
            span2={f.featured}
          />
        ))}
      </BentoGrid>
    </section>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [loading, user, router]);

  useScrollReveal();

  return (
    <div className="landing-shell">
      <ParticleGlobe />

      {/* Nav */}
      <nav className="landing-nav">
        <Link href="/" className="landing-nav-logo">
          <Image src="/logo-icon.png" alt="Creative OS" width={32} height={32} style={{ objectFit: 'contain' }} />
          Creative OS
        </Link>
        <ul className="landing-nav-links">
          <li><a href="#features">Features</a></li>
          <li><a href="#how">How it works</a></li>
          <li><a href="#tools">Tools</a></li>
        </ul>
        <div className="landing-nav-ctas">
          <Link href="/login" className="btn-ghost">Sign In</Link>
          <Link href="/signup" className="btn-cta">Get Started Free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <div style={{ position: 'relative', zIndex: 2 }}>
          <h1 className="hero-headline">
            <span className="hero-headline-line1">Creative</span>
            <span className="hero-headline-line2">OS</span>
          </h1>
          <p className="hero-sub">
            The AI-powered ad creation platform for performance marketers.<br />One idea → endless creatives, tested and optimised.
          </p>
          <div className="hero-ctas">
            <Link href="/signup" className="hero-cta-primary">Get Started Free</Link>
            <Link href="/login" className="hero-cta-ghost">Sign In →</Link>
          </div>
          <p className="hero-hint">No credit card required · Setup in 2 minutes</p>
        </div>
        <div className="scroll-indicator">
          <div className="scroll-indicator-dot" />
          <div className="scroll-indicator-line" />
        </div>
      </section>

      {/* Stats */}
      <div style={{ padding: '0 40px 96px', maxWidth: 1000, margin: '0 auto', width: '100%' }}>
        <div className="stats-strip reveal">
          {STATS.map(s => (
            <div key={s.label} className="stats-strip-item">
              <AnimatedStat target={s.target} suffix={s.suffix} />
              <div className="stats-strip-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Features Bento */}
      <FeaturesSection />

      {/* How it works */}
      <section className="how-section" id="how">
        <h2 className="how-section-title reveal">How it works</h2>
        <div className="how-steps">
          {STEPS.map((s, i) => (
            <div key={s.num} className="how-step reveal" style={{ transitionDelay: `${i * 100}ms` }}>
              <div className="how-step-num">{s.num}</div>
              <div className="how-step-title">{s.title}</div>
              <p className="how-step-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tools Strip */}
      <section className="tools-section" id="tools">
        <h2 className="tools-section-title reveal">18 tools. One platform.</h2>
        <p className="tools-section-sub reveal" style={{ transitionDelay: '80ms' }}>Everything you need to create, test, and optimise — built in.</p>
        <div className="tools-pills">
          {TOOLS.map((t, i) => (
            <span key={t} className="tools-pill reveal" style={{ transitionDelay: `${i * 40}ms` }}>{t}</span>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="landing-cta-section reveal">
        <h2 className="landing-cta-title">Your ads. Smarter.</h2>
        <p className="landing-cta-sub">Join thousands of marketers using AI to create high-performing campaigns.</p>
        <Link href="/signup" className="hero-cta-primary">Get Started Free →</Link>
      </section>

      <footer className="landing-footer">
        © 2026 Creative OS · AI-powered creative intelligence
      </footer>
    </div>
  );
}

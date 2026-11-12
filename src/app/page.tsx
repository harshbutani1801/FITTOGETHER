"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Activity, ArrowRight, Eye, EyeOff, Heart } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push("/dashboard");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel" aria-labelledby="welcome-title">
        <div className="brand-lockup"><span className="brand-mark"><Activity size={21} strokeWidth={2.6} /></span><span>fit<span className="brand-accent">together</span></span></div>
        <div className="welcome-copy">
          <p className="eyebrow">YOUR FITNESS JOURNEY, TOGETHER</p>
          <h1 id="welcome-title">Show up for yourself.<br /><span>And each other.</span></h1>
          <p className="intro">A little progress, every day. Pick up right where you left off.</p>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" autoComplete="username" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <div className="password-heading"><label htmlFor="password">Password</label></div>
          <div className="password-field"><input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required /><button type="button" className="icon-button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
          {message && <p className="form-message" role="alert">{message}</p>}
          <button className="submit-button" type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}<ArrowRight size={18} /></button>
          <p className="access-note">FITTOGETHER is currently invite-only. Contact your partner for access.</p>
        </form>
        <div className="login-footer"><span>Made for the long run</span><span className="footer-heart"><Heart size={14} fill="currentColor" /> together</span></div>
      </section>
      <aside className="login-aside" aria-label="Fitness motivation">
        <div className="aside-top"><span className="live-dot" /> YOUR SPACE TO GROW</div>
        <div className="aside-content"><div className="quote-mark">“</div><blockquote>Small steps every day add up to big changes.</blockquote><p>Keep going. You’re doing better than you think.</p><div className="aside-rule" /><span className="aside-caption">ONE DAY AT A TIME</span></div>
        <div className="aside-bottom"><span>EST. IN GOOD COMPANY</span><span>01 / 01</span></div>
        <div className="decor decor-one" /><div className="decor decor-two" />
      </aside>
    </main>
  );
}

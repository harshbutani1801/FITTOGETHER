"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, BarChart3, CalendarDays, History, Home, Layers3, LogOut, LibraryBig, Settings, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/dashboard", label: "Overview", icon: Home },
  { href: "/dashboard/workout", label: "My Workout", icon: CalendarDays },
  { href: "/dashboard/history", label: "Workout History", icon: History },
  { href: "/dashboard/plans", label: "Plan Management", icon: Layers3 },
  { href: "/dashboard/exercises", label: "Exercise Library", icon: LibraryBig },
  { href: "/dashboard/progress", label: "Progress", icon: BarChart3 },
  { href: "/dashboard/together", label: "Together", icon: Users },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function AppNavigation({ displayName }: { displayName: string }) {
  const pathname = usePathname();
  const router = useRouter();
  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/");
    router.refresh();
  }
  return <>
    <aside className="app-sidebar">
      <Link href="/dashboard" className="brand-lockup"><span className="brand-mark"><Activity size={21} strokeWidth={2.6} /></span><span>fit<span className="brand-accent">together</span></span></Link>
      <p className="nav-section-title">WORKSPACE</p>
      <nav className="side-nav" aria-label="Main navigation">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-link ${pathname === href ? "active" : ""}`}><Icon size={17} strokeWidth={1.9} /><span>{label}</span></Link>)}</nav>
      <div className="sidebar-profile"><span className="avatar-placeholder">{displayName.slice(0, 1).toUpperCase()}</span><span className="profile-name">{displayName}</span><button className="nav-signout" onClick={signOut} aria-label="Sign out"><LogOut size={16} /></button></div>
    </aside>
    <nav className="mobile-nav" aria-label="Mobile navigation">{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`mobile-nav-link ${pathname === href ? "active" : ""}`}><Icon size={19} /><span>{label === "Workout History" ? "History" : label === "Plan Management" ? "Plans" : label === "Exercise Library" ? "Library" : label}</span></Link>)}</nav>
  </>;
}

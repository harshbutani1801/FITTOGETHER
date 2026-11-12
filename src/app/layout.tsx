import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FITTOGETHER — Your fitness journey, together",
  description: "A shared space for two fitness journeys. Plan workouts, track progress, and keep each other moving.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

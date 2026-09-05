import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Voidwake — The Outer Reach', description: 'Captain your own ship. Explore solar systems, trade goods, hunt pirates, and build your fortune.' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html>; }

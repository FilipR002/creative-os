import type { Metadata } from 'next';
import './globals.css';
import { Polyfills }    from '@/components/Polyfills';
import { AuthProvider } from '@/lib/auth-context';
import { AppShell }     from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'Creative OS',
  description: 'AI-powered creative intelligence',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Polyfills />
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}

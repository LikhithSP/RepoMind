import type { Metadata } from 'next';
import { EB_Garamond } from 'next/font/google';
import './globals.css';

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-eb-garamond',
});

export const metadata: Metadata = {
  title: 'RepoMind — Agentic Codebase Assistant',
  description: 'Production-grade agentic RAG for codebases with hybrid retrieval, cross-encoder re-ranking, and cited source snippets.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={ebGaramond.variable}>
      <body className={ebGaramond.className}>{children}</body>
    </html>
  );
}

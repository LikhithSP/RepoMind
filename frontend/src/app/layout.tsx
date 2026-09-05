import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}

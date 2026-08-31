import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CodeRAG — Agentic Codebase Assistant',
  description: 'Production-grade agentic RAG for codebases with hybrid retrieval, cross-encoder re-ranking, and cited source snippets.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

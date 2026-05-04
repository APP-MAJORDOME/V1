import React from 'react';

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16, background: '#fff' }}>
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      {children}
    </section>
  );
}

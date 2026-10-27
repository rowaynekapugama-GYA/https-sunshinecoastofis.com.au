import React from 'react';

/** Dashboard login and nav branding. Plain markup so it works as a server component. */
export const Logo: React.FC = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src="/images/logo.png" alt="Sunshine Coast Oral, Facial & Implant Specialists" style={{ height: 44, width: 'auto' }} />
  </div>
);

export const Icon: React.FC = () => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src="/apple-touch-icon.png" alt="" style={{ height: 24, width: 24, borderRadius: 4 }} />
);

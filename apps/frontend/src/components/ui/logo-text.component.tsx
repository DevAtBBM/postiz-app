import React from 'react';
import { Logo } from '@gitroom/frontend/components/new-layout/logo';

export const LogoTextComponent = () => {
  return (
    <div className="flex items-center gap-[10px]">
      <Logo />
      <span
        style={{
          fontSize: '22px',
          fontWeight: 700,
          letterSpacing: '-0.5px',
          color: 'currentColor',
        }}
      >
        Postnify
      </span>
    </div>
  );
};

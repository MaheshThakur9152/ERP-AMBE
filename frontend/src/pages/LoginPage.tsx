import React from 'react';
import { LoginForm } from '@/features/auth/components/LoginForm';

export const LoginPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))] flex items-center justify-center p-4">
      <LoginForm />
    </div>
  );
};

import React from 'react';
import { LoginForm } from '@/features/auth/components/LoginForm';

export const Login: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 font-sans">
      <LoginForm />
    </div>
  );
};

export default Login;

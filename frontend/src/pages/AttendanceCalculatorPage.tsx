import React from 'react';
import { AttendanceCalculatorPreview } from '@/features/attendance/AttendanceCalculatorPreview';

export const AttendanceCalculatorPage: React.FC = () => {
  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans">
      <AttendanceCalculatorPreview />
    </div>
  );
};

export default AttendanceCalculatorPage;

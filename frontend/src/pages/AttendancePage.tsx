import React from 'react';
import { AttendanceTab } from '@/features/attendance/components/AttendanceTab';

export const AttendancePage: React.FC = () => {
  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans">
      <AttendanceTab />
    </div>
  );
};

export default AttendancePage;

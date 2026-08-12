import React from 'react';
import { Activity } from 'lucide-react';

export const LogsTab: React.FC = () => {
  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans space-y-6">
      <div className="flex items-center gap-3">
        <Activity className="w-7 h-7 text-[#20B2AA]" />
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">System Logs</h1>
      </div>
      <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-xs text-center text-gray-500">
        No active system log records found.
      </div>
    </div>
  );
};

export const LogsPage = LogsTab;
export default LogsPage;

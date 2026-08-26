export interface AttendanceRecordItem {
  srNo?: number;
  biometricCode: string;
  name: string;
  weeklyOff: string;
  regularShifts: Record<string, string>;
  extraShifts?: Record<string, string>;
  totalPresent?: number;
  totalWeeklyOff?: number;
  hd?: number;
  totalDays?: number;
  [key: string]: any;
}

export interface AttendanceSheet {
  id: string;
  site_id?: string;
  siteId?: string;
  company_id?: string;
  companyId?: string;
  siteName?: string;
  companyName?: string;
  month: string;
  year: number | string;
  records: AttendanceRecordItem[];
  summary?: any;
  is_locked?: boolean;
  isLocked?: boolean;
  created_at?: string;
  updated_at?: string;
}

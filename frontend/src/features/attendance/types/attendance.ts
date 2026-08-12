export type AttendanceStatus =
  | 'P'
  | 'A'
  | 'HD'
  | 'W/O'
  | 'WOP'
  | 'WOE'
  | 'HDE'
  | 'PH'
  | 'Leave';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  timestamp?: string;
  updatedAt?: string;
  photoUrl?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  isSynced?: boolean;
  isLocked?: boolean;
  remarks?: string;
}

export interface EmployeeAttendanceData {
  id: string;
  name: string;
  biometricCode: string;
  phone?: string;
  role: string;
  shift?: string;
  siteId: string;
  siteName: string;
  weeklyOff?: string; // e.g. 'Sunday'
  status: 'Active' | 'Inactive' | 'On Leave' | 'Reliever' | 'Deleted' | 'Stopped';
  joiningDate?: string;
  leavingDate?: string;
  returnDate?: string;
  leaveReason?: string;
  photoUrl?: string;
  salaryDetails?: {
    deductionBreakdown?: {
      advance?: number;
      uniform?: number;
      shoes?: number;
      others?: number;
    };
  };
}

export interface AttendanceStats {
  presentToday: number;
  absentToday: number;
  totalWorkingScore: number;
}

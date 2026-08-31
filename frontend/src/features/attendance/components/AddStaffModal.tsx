import React from 'react';
import { StaffFormModal, StaffFormModalProps } from '@/features/staff/components/StaffFormModal';

export { StaffFormModal };
export type { StaffFormModalProps };

export interface AddStaffModalProps extends StaffFormModalProps {}

export const AddStaffModal: React.FC<AddStaffModalProps> = (props) => {
  return <StaffFormModal {...props} mode={props.mode || 'add'} />;
};

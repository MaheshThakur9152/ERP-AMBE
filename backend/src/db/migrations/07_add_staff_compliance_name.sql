-- Migration: 07_add_staff_compliance_name.sql
-- Add compliance_name column to staff table

ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS compliance_name text DEFAULT '';

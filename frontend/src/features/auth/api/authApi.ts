import { supabase } from '@/lib/supabase';
import { UserProfile } from '../types';

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error loading user profile:', error.message);
    return null;
  }
  return data;
}

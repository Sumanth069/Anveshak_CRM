'use server';

import { prisma } from '@/lib/prisma';
import { supabase } from '@/lib/supabase';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'SALES_REP' | string;
  isActive: boolean;
  assignedCount: number;
  title?: string;
  phone?: string;
}

/**
 * Native Supabase Auth: User Registration
 * Registers the user in Supabase's auth.users engine and syncs user profile to PostgreSQL database
 */
export async function registerUserAction(userData: {
  fullName: string;
  email: string;
  password: string;
  role?: string;
  title?: string;
  phone?: string;
}) {
  const cleanEmail = userData.email.trim().toLowerCase();
  const cleanName = userData.fullName.trim();
  const role = userData.role || 'SALES_REP';
  const title = userData.title || (role === 'ADMIN' ? 'System Administrator' : role === 'MANAGER' ? 'Sales Manager' : 'Sales Representative');
  const phone = userData.phone || '';

  if (!cleanEmail || !cleanName || !userData.password) {
    return { success: false, error: 'Full name, email address, and password are required.' };
  }

  if (userData.password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.' };
  }

  try {
    // 1. Register with Native Supabase Auth (GoTrue Engine)
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: cleanEmail,
      password: userData.password,
      options: {
        data: {
          full_name: cleanName,
          role: role,
          title: title,
          phone: phone
        }
      }
    });

    if (authError) {
      // If user already registered in Supabase Auth, return user-friendly message
      if (authError.message.includes('already registered') || authError.message.includes('User already registered')) {
        return { success: false, error: 'An account with this email address is already registered in Supabase.' };
      }
      return { success: false, error: authError.message };
    }

    const userId = authData.user?.id || `USR-${Date.now()}`;

    // 2. Sync profile to database (users_list table & Prisma) for relational queries
    try {
      await supabase
        .from('users_list')
        .upsert({
          id: userId,
          full_name: cleanName,
          email: cleanEmail,
          password: userData.password,
          role: role,
          is_active: true,
          assigned_count: 0
        }, { onConflict: 'email' });
    } catch (tableErr) {
      console.warn('Sync to users_list table warning:', tableErr);
    }

    try {
      await prisma.user.upsert({
        where: { email: cleanEmail },
        update: { fullName: cleanName, role: role, isActive: true },
        create: {
          id: userId,
          fullName: cleanName,
          email: cleanEmail,
          password: userData.password,
          role: role,
          isActive: true,
          assignedCount: 0
        }
      });
    } catch (prismaErr) {
      console.warn('Sync to Prisma user table warning:', prismaErr);
    }

    return {
      success: true,
      user: {
        id: userId,
        fullName: cleanName,
        email: cleanEmail,
        role: role,
        isActive: true,
        assignedCount: 0,
        title: title,
        phone: phone
      },
      session: authData.session
    };
  } catch (err: any) {
    console.error('registerUserAction error:', err);
    return { success: false, error: err.message || 'Error creating account in Supabase.' };
  }
}

/**
 * Native Supabase Auth: User Sign-In / Login
 * Authenticates user credentials with Supabase GoTrue Auth service
 */
export async function loginAction(email: string, password: string) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPass = password.trim();

  if (!cleanEmail || !cleanPass) {
    return { success: false, error: 'Please enter both your email address and password.' };
  }

  try {
    // 1. Authenticate with Native Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPass
    });

    if (authError) {
      // Fallback: Check direct database record if user was provisioned via database seed
      const { data: dbUser } = await supabase
        .from('users_list')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (dbUser && dbUser.password === cleanPass) {
        if (dbUser.is_active === false) {
          return { success: false, error: 'Your account has been deactivated by an Administrator.' };
        }

        // Auto-register in Native Supabase Auth so future logins use native auth
        try {
          await supabase.auth.signUp({
            email: cleanEmail,
            password: cleanPass,
            options: {
              data: {
                full_name: dbUser.full_name,
                role: dbUser.role || 'SALES_REP'
              }
            }
          });
        } catch (e) {
          console.warn('Auto-sync to Supabase auth warning:', e);
        }

        return {
          success: true,
          user: {
            id: dbUser.id,
            fullName: dbUser.full_name,
            email: dbUser.email,
            role: dbUser.role || 'SALES_REP',
            isActive: dbUser.is_active ?? true,
            assignedCount: dbUser.assigned_count || 0
          }
        };
      }

      return { success: false, error: authError.message || 'Invalid email or password. Please verify credentials.' };
    }

    if (!authData.user) {
      return { success: false, error: 'User record not found in Supabase Auth.' };
    }

    // 2. Check if user is deactivated in database
    const { data: dbProfile } = await supabase
      .from('users_list')
      .select('*')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (dbProfile && dbProfile.is_active === false) {
      await supabase.auth.signOut();
      return { success: false, error: 'Your account has been deactivated by an Administrator.' };
    }

    const meta = authData.user.user_metadata || {};
    const fullName = meta.full_name || dbProfile?.full_name || cleanEmail.split('@')[0];
    const role = meta.role || dbProfile?.role || 'SALES_REP';

    return {
      success: true,
      user: {
        id: authData.user.id,
        fullName: fullName,
        email: authData.user.email || cleanEmail,
        role: role,
        isActive: true,
        assignedCount: dbProfile?.assigned_count || 0,
        title: meta.title || (role === 'ADMIN' ? 'System Administrator' : role === 'MANAGER' ? 'Sales Manager' : 'Sales Representative'),
        phone: meta.phone || ''
      },
      session: authData.session
    };
  } catch (err: any) {
    console.error('loginAction error:', err);
    return { success: false, error: err.message || 'Authentication error with Supabase.' };
  }
}

/**
 * Native Supabase Auth: Password Reset Request
 * Sends password reset link via Supabase Auth
 */
export async function resetPasswordAction(email: string) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return { success: false, error: 'Email address is required.' };

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
    if (error) return { success: false, error: error.message };
    return { success: true, message: 'Password reset link sent to your email address.' };
  } catch (err: any) {
    console.error('resetPasswordAction error:', err);
    return { success: false, error: err.message || 'Failed to send password reset.' };
  }
}

/**
 * Native Supabase Auth: Sign Out
 */
export async function signOutAction() {
  try {
    await supabase.auth.signOut();
    return { success: true };
  } catch (err: any) {
    console.error('signOutAction error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Fetch all registered users from database
 */
export async function getUsersListAction() {
  // 1. Direct Supabase
  try {
    const { data, error } = await supabase
      .from('users_list')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      return {
        success: true,
        users: data.map(u => ({
          id: u.id,
          fullName: u.full_name,
          email: u.email,
          role: u.role || 'SALES_REP',
          isActive: u.is_active ?? true,
          assignedCount: u.assigned_count || 0,
          createdAt: u.created_at
        }))
      };
    }
  } catch (err) {
    console.warn('Supabase getUsersListAction error, trying Prisma:', err);
  }

  // 2. Prisma Fallback
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' }
    });

    if (users && users.length > 0) {
      return {
        success: true,
        users: users.map(u => ({
          id: u.id,
          fullName: u.fullName,
          email: u.email,
          role: u.role || 'SALES_REP',
          isActive: u.isActive ?? true,
          assignedCount: u.assignedCount || 0,
          createdAt: u.createdAt
        }))
      };
    }
    return { success: true, users: [] };
  } catch (err: any) {
    console.error('getUsersListAction error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Admin User Provisioning: Create or Invite User
 */
export async function createUserAction(userData: {
  fullName: string;
  email: string;
  password?: string;
  role: string;
}) {
  return registerUserAction({
    fullName: userData.fullName,
    email: userData.email,
    password: userData.password || '12345678',
    role: userData.role
  });
}

/**
 * Update User Details / Profile / Role / Password in Supabase
 */
export async function updateUserAction(id: string, updates: {
  fullName?: string;
  role?: string;
  isActive?: boolean;
  password?: string;
  assignedCount?: number;
}) {
  const supaData: any = {};
  if (updates.fullName !== undefined) supaData.full_name = updates.fullName.trim();
  if (updates.role !== undefined) supaData.role = updates.role;
  if (updates.isActive !== undefined) supaData.is_active = updates.isActive;
  if (updates.password !== undefined) supaData.password = updates.password;
  if (updates.assignedCount !== undefined) supaData.assigned_count = updates.assignedCount;

  // 1. Update in Supabase users_list
  try {
    const { data, error } = await supabase
      .from('users_list')
      .update(supaData)
      .eq('id', id)
      .select()
      .single();

    if (!error && data) {
      // Also update in Prisma if possible
      try {
        const prismaData: any = {};
        if (updates.fullName !== undefined) prismaData.fullName = updates.fullName.trim();
        if (updates.role !== undefined) prismaData.role = updates.role;
        if (updates.isActive !== undefined) prismaData.isActive = updates.isActive;
        if (updates.password !== undefined) prismaData.password = updates.password;
        if (updates.assignedCount !== undefined) prismaData.assignedCount = updates.assignedCount;
        await prisma.user.update({ where: { id }, data: prismaData });
      } catch (e) {
        console.warn('Prisma secondary update skipped:', e);
      }

      return { success: true, user: data };
    }
  } catch (err) {
    console.warn('Supabase updateUserAction error:', err);
  }

  // 2. Prisma Direct Update
  try {
    const prismaData: any = {};
    if (updates.fullName !== undefined) prismaData.fullName = updates.fullName.trim();
    if (updates.role !== undefined) prismaData.role = updates.role;
    if (updates.isActive !== undefined) prismaData.isActive = updates.isActive;
    if (updates.password !== undefined) prismaData.password = updates.password;
    if (updates.assignedCount !== undefined) prismaData.assignedCount = updates.assignedCount;

    const updated = await prisma.user.update({
      where: { id },
      data: prismaData
    });
    return { success: true, user: updated };
  } catch (err: any) {
    console.error('updateUserAction error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Delete User Account from Supabase and Database
 */
export async function deleteUserAction(id: string) {
  try {
    await supabase.from('users_list').delete().eq('id', id);
  } catch (err) {
    console.warn('Supabase delete error:', err);
  }

  try {
    await prisma.user.delete({ where: { id } });
    return { success: true };
  } catch (err) {
    console.warn('Prisma delete error:', err);
  }

  return { success: true };
}

'use server'

import { createAdminSession, revokeAdminSession } from '@/lib/admin-auth';
import { redirect } from 'next/navigation';
import crypto from 'crypto';

export async function loginAdmin(formData: FormData) {
  const user = formData.get('user') as string;
  const password = formData.get('password') as string;

  if (!user || !password) {
    return { success: false, error: 'Identifiants requis' };
  }

  const validUser = process.env.ADMIN_USER || 'admin';
  const validPass = process.env.ADMIN_PASSWORD || 'bizness2026';

  const userBuf = Buffer.from(user);
  const validUserBuf = Buffer.from(validUser);
  const passBuf = Buffer.from(password);
  const validPassBuf = Buffer.from(validPass);

  let isMatch = true;
  if (userBuf.length !== validUserBuf.length) {
    isMatch = false;
  } else if (!crypto.timingSafeEqual(userBuf, validUserBuf)) {
    isMatch = false;
  }

  if (passBuf.length !== validPassBuf.length) {
    isMatch = false;
  } else if (!crypto.timingSafeEqual(passBuf, validPassBuf)) {
    isMatch = false;
  }

  if (isMatch) {
    await createAdminSession();
    // next/navigation redirect throw an error which must not be caught here if we are inside a try/catch, 
    // but here we are at the top level of the action
  } else {
    return { success: false, error: 'Identifiants incorrects' };
  }

  redirect('/admin');
}

export async function logoutAdmin() {
  await revokeAdminSession();
  redirect('/admin/login');
}

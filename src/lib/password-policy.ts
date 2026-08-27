export function validatePasswordPolicy(password: string | null | undefined): { isValid: boolean; error?: string } {
  if (!password || password.trim().length === 0) {
    return { isValid: false, error: 'Le mot de passe ne peut pas être vide.' };
  }
  
  if (password.length < 8) {
    return { isValid: false, error: 'Le mot de passe doit contenir au moins 8 caractères.' };
  }

  return { isValid: true };
}

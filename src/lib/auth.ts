import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const authSecret = import.meta.env.AUTH_SECRET;

if (!authSecret) {
  throw new Error('AUTH_SECRET environment variable must be set to a non-empty value');
}

const JWT_SECRET = authSecret;

export interface UserPayload {
  id: string;
  email: string;
  name: string;
  role: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(user: UserPayload): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): UserPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserPayload;
  } catch (error) {
    return null;
  }
}

export function getSessionFromCookie(cookieHeader: string | null): UserPayload | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  const token = cookies['session'];
  if (!token) return null;

  return verifyToken(token);
}

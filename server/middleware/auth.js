import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production. Refusing to start with the built-in development secret.');
  }
  console.warn('[auth] JWT_SECRET is not set — using the insecure development fallback. Set it in .env before deploying.');
}

export function signToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authenticate(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

const SHARE_TOKEN_PURPOSE = 'document-share';
export const SHARE_TOKEN_TTL = '7d';

export function signShareToken(documentId) {
  return jwt.sign({ documentId: Number(documentId), purpose: SHARE_TOKEN_PURPOSE }, JWT_SECRET, {
    expiresIn: SHARE_TOKEN_TTL,
  });
}

export function verifyShareToken(token, documentId) {
  if (!token) return false;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload.purpose === SHARE_TOKEN_PURPOSE && Number(payload.documentId) === Number(documentId);
  } catch {
    return false;
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

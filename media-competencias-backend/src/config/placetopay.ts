import crypto from 'crypto';

export interface P2PAuth {
  login: string;
  tranKey: string;
  nonce: string;
  seed: string;
}

export const generateAuth = (): P2PAuth => {
  const login = process.env.P2P_LOGIN || '';
  const secretKey = process.env.P2P_SECRET_KEY || '';
  
  const seed = new Date().toISOString();
  
  // Generar un nonce aleatorio seguro
  const nonceBuffer = crypto.randomBytes(16);
  const nonce = nonceBuffer.toString('base64');
  
  // Generar el SHA-256 del nonce (bytes crudos) + seed + secretKey
  const hash = crypto.createHash('sha256');
  hash.update(nonceBuffer);
  hash.update(seed);
  hash.update(secretKey);
  const tranKey = hash.digest('base64');

  return {
    login,
    tranKey,
    nonce,
    seed
  };
};
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = (import.meta as any).env?.VITE_ENCRYPTION_KEY || 'pharma-guard-default-key-32-chars-!!';

export const encryptData = (data: string): string => {
  return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
};

export const decryptData = (ciphertext: string): string => {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_KEY);
    const originalText = bytes.toString(CryptoJS.enc.Utf8);
    return originalText || ciphertext; // Fallback to ciphertext if decryption fails
  } catch (error) {
    console.error('Decryption error:', error);
    return ciphertext;
  }
};

export const encryptObject = (obj: any, sensitiveFields: string[]): any => {
  if (!obj) return obj;
  const encryptedObj = { ...obj };
  
  // Handle top-level fields
  sensitiveFields.forEach(field => {
    if (encryptedObj[field] && typeof encryptedObj[field] === 'string') {
      encryptedObj[field] = encryptData(encryptedObj[field]);
    }
  });

  // Handle aiAnalysis nested fields
  if (encryptedObj.aiAnalysis) {
    encryptedObj.aiAnalysis = { ...encryptedObj.aiAnalysis };
    sensitiveFields.forEach(field => {
      if (encryptedObj.aiAnalysis[field] && typeof encryptedObj.aiAnalysis[field] === 'string') {
        encryptedObj.aiAnalysis[field] = encryptData(encryptedObj.aiAnalysis[field]);
      }
    });
  }

  return encryptedObj;
};

export const decryptObject = (obj: any, sensitiveFields: string[]): any => {
  if (!obj) return obj;
  const decryptedObj = { ...obj };
  
  // Handle top-level fields
  sensitiveFields.forEach(field => {
    if (decryptedObj[field] && typeof decryptedObj[field] === 'string') {
      decryptedObj[field] = decryptData(decryptedObj[field]);
    }
  });

  // Handle aiAnalysis nested fields
  if (decryptedObj.aiAnalysis) {
    decryptedObj.aiAnalysis = { ...decryptedObj.aiAnalysis };
    sensitiveFields.forEach(field => {
      if (decryptedObj.aiAnalysis[field] && typeof decryptedObj.aiAnalysis[field] === 'string') {
        decryptedObj.aiAnalysis[field] = decryptData(decryptedObj.aiAnalysis[field]);
      }
    });
  }

  return decryptedObj;
};

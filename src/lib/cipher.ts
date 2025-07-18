export const generateSalt = (length: number) => {
  return window.crypto.getRandomValues(new Uint8Array(length));
};

export const deriveBitsUsingPBKDF2 = async (passphrase: string, salt: Uint8Array, length: number) => {
  const passphraseBuffer = new TextEncoder().encode(passphrase);
  const passpharseKey = await window.crypto.subtle.importKey(
    "raw", passphraseBuffer,
    "PBKDF2", false, ["deriveBits"],
  );
  return await window.crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: 10000,
    } satisfies Pbkdf2Params,
    passpharseKey,
    length,
  );
};

export const encryptUsingAES256CBC = async (data: ArrayBuffer, key: ArrayBuffer, iv: ArrayBuffer) => {
  const keyKey = await window.crypto.subtle.importKey(
    "raw", key,
    "AES-CBC", false, ["encrypt"]
  );
  return await window.crypto.subtle.encrypt(
    {
      name: "AES-CBC",
      iv,
    } satisfies AesCbcParams,
    keyKey,
    data,
  );
};

export const decryptUsingAES256CBC = async (data: ArrayBuffer, key: ArrayBuffer, iv: ArrayBuffer) => {
  const keyKey = await window.crypto.subtle.importKey(
    "raw", key,
    "AES-CBC", false, ["decrypt"]
  );
  return await window.crypto.subtle.decrypt(
    {
      name: "AES-CBC",
      iv,
    } satisfies AesCbcParams,
    keyKey,
    data,
  );
};

export const encodeStringInBase64 = (data: string) => {
  const utf8Data = new TextEncoder().encode(data);
  return btoa(String.fromCharCode(...utf8Data));
}

export const decodeStringFromBase64 = (data: string) => {
  const utf8Data = atob(data);
  const utf8DataArray = new Uint8Array([...utf8Data].map(char => char.charCodeAt(0)));
  return new TextDecoder().decode(utf8DataArray);
}
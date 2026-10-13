// Files use the format of `openssl enc -aes-256-cbc -pbkdf2`, so the browser and the
// command line can decrypt each other's uploads: "Salted__", an 8-byte salt, then
// AES-256-CBC ciphertext keyed by PBKDF2-SHA256 with OpenSSL's 10000 iterations.
const MAGIC = new TextEncoder().encode("Salted__");
const SALT_SIZE = 8;
const HEADER_SIZE = MAGIC.length + SALT_SIZE;
const AES_BLOCK_SIZE = 16;

const deriveKey = async (passphrase: string, salt: Uint8Array<ArrayBuffer>, usage: KeyUsage) => {
  const passphraseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  // OpenSSL derives the key and the IV together.
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 10000 } satisfies Pbkdf2Params,
    passphraseKey,
    (32 + 16) * 8,
  );
  return {
    key: await crypto.subtle.importKey("raw", bits.slice(0, 32), "AES-CBC", false, [usage]),
    iv: bits.slice(32, 48),
  };
};

export const encryptOpenSSL = async (data: ArrayBuffer, passphrase: string) => {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_SIZE));
  const { key, iv } = await deriveKey(passphrase, salt, "encrypt");
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv } satisfies AesCbcParams,
    key,
    data,
  );

  const result = new Uint8Array(HEADER_SIZE + encrypted.byteLength);
  result.set(MAGIC, 0);
  result.set(salt, MAGIC.length);
  result.set(new Uint8Array(encrypted), HEADER_SIZE);
  return result;
};

export const decryptOpenSSL = async (data: ArrayBuffer, passphrase: string) => {
  const bytes = new Uint8Array(data);
  if (
    bytes.length < HEADER_SIZE + AES_BLOCK_SIZE ||
    MAGIC.some((byte, index) => bytes[index] !== byte)
  ) {
    throw new Error("Invalid encrypted file");
  }

  const salt = bytes.slice(MAGIC.length, HEADER_SIZE);
  const { key, iv } = await deriveKey(passphrase, salt, "decrypt");
  return crypto.subtle.decrypt(
    { name: "AES-CBC", iv } satisfies AesCbcParams,
    key,
    data.slice(HEADER_SIZE),
  );
};

export const encodeStringInBase64 = (data: string) => {
  const utf8Data = new TextEncoder().encode(data);
  return btoa(String.fromCharCode(...utf8Data));
};

export const decodeStringFromBase64 = (data: string) => {
  const utf8Data = atob(data);
  const utf8DataArray = new Uint8Array([...utf8Data].map((char) => char.charCodeAt(0)));
  return new TextDecoder().decode(utf8DataArray);
};

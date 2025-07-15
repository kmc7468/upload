export interface UploadedFile {
  id: string;
  name: string;
  managementToken: string;
  uploadedAt: string;
  isEncrypted: boolean;
  passphrase?: string;
  isExpired?: boolean;
}

export const getUploadedFiles = () => {
  const files = window.localStorage.getItem("uploadedFiles");
  return files ? JSON.parse(files) as UploadedFile[] : [];
};

const saveUploadedFiles = (files: UploadedFile[]) => {
  window.localStorage.setItem("uploadedFiles", JSON.stringify(files));
};

export const addUploadedFile = (file: Omit<UploadedFile, "uploadedAt" | "isExpired">) => {
  const files = getUploadedFiles();
  files.push({
    ...file,
    uploadedAt: new Date().toISOString(),
    isExpired: false,
  });
  saveUploadedFiles(files);
};

export const updateUploadedFile = (fileId: string, updates: Partial<UploadedFile>) => {
  const files = getUploadedFiles();
  saveUploadedFiles(files.map(file => 
    file.id === fileId ? { ...file, ...updates } : file,
  ));
};

export const removeUploadedFile = (fileId: string) => {
  const files = getUploadedFiles();
  saveUploadedFiles(files.filter(({ id }) => id !== fileId));
};

export const removeExpiredFiles = () => {
  const files = getUploadedFiles();
  saveUploadedFiles(files.filter(({ isExpired }) => !isExpired));
};
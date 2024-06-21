import { ID_CHARS, ID_LENGTH } from "$lib/loadenv";

const idRegex = new RegExp(`^[${ID_CHARS}]{${ID_LENGTH}}$`);

export const match = (param: string) => {
  return idRegex.test(param);
};
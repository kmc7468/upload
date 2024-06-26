export const findAsync = <T>(array: T[], predicate: (value: T) => Promise<boolean>) => {
  return new Promise<T | undefined>(resolve => {
    let i = 0;
    array.forEach(async value => {
      if (await predicate(value)) {
        resolve(value);
      } else if (array.length === ++i) {
        resolve(undefined);
      }
    });
  });
};

export const someAsync = async <T>(array: T[], predicate: (value: T) => Promise<boolean>) => {
  return await findAsync(array, predicate) !== undefined;
};
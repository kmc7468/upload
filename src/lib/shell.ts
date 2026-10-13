// Quotes a value for a POSIX shell, so commands shown to users can be pasted as they are.
// File names come from whoever uploaded them, and inside single quotes nothing such as
// $( ) or a backtick is run. Values made only of characters with no special meaning are
// left bare, so ordinary URLs and names read as typed.
export const shellQuote = (value: string) =>
  /^[\w.,:/@%+=-]+$/.test(value) ? value : `'${value.replaceAll("'", `'\\''`)}'`;

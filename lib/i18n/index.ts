import { en } from "./en";

type Dict = typeof en;
export type I18nKey = keyof Dict;

export function t(key: I18nKey): string {
  return en[key];
}

import { stemmer } from "stemmer";

export function stem(token: string): string {
  return stemmer(token);
}

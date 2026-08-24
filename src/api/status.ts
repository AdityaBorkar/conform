import type { CheckResult } from "@/types.ts";

export const Status = {
  fail: (message?: string): CheckResult => {
    if (message === undefined) {
      return { status: "fail" };
    }
    return { message, status: "fail" };
  },
  pass: (message?: string): CheckResult => {
    if (message === undefined) {
      return { status: "pass" };
    }
    return { message, status: "pass" };
  },
  warn: (message?: string): CheckResult => {
    if (message === undefined) {
      return { status: "warn" };
    }
    return { message, status: "warn" };
  },
};

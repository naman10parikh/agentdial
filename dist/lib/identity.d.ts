import type { Identity } from "../adapters/types.js";
export declare function parseIdentity(filePath: string): Promise<Identity>;
export declare function writeIdentity(
  filePath: string,
  identity: Identity,
  body?: string,
): Promise<void>;
export declare function validateIdentity(data: unknown): Identity;
//# sourceMappingURL=identity.d.ts.map

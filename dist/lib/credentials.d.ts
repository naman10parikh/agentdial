import type { ChannelType } from "../adapters/types.js";
export declare function saveCredential(
  channel: ChannelType,
  key: string,
  value: string,
): Promise<void>;
export declare function getCredential(
  channel: ChannelType,
  key: string,
): Promise<string | undefined>;
export declare function listCredentials(
  channel: ChannelType,
): Promise<string[]>;
export declare function deleteCredential(
  channel: ChannelType,
  key: string,
): Promise<boolean>;
export declare function listConfiguredChannels(): Promise<ChannelType[]>;
//# sourceMappingURL=credentials.d.ts.map

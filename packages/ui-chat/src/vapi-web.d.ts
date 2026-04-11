declare module "@vapi-ai/web" {
  export type VapiAssistantOverrides = {
    variableValues?: Record<string, string>;
    [key: string]: unknown;
  };

  export default class Vapi {
    constructor(publicKey: string);
    start(
      assistant: string | Record<string, unknown>,
      assistantOverrides?: VapiAssistantOverrides,
    ): Promise<void> | void;
    stop(): Promise<void> | void;
    on?(event: string, handler: (payload: unknown) => void): void;
  }
}
declare module "@vapi-ai/web" {
  export default class Vapi {
    constructor(publicKey: string);
    start(assistant: string): Promise<void> | void;
    stop(): Promise<void> | void;
  }
}

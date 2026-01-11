declare module "stun" {
  export interface RInfo {
    address: string;
    port: number;
  }

  export interface Message {
    transactionId: Buffer;
    addXorAddress(address: string, port: number): void;
  }

  export interface Server {
    on(
      event: "bindingRequest",
      callback: (req: Message, rinfo: RInfo) => void
    ): void;
    listen(port: number, callback?: () => void): void;
    send(message: Message, port: number, address: string): void;
  }

  export interface ServerOptions {
    type: "udp4" | "udp6";
  }

  export function createServer(options: ServerOptions): Server;
  export function createMessage(type: number, transactionId: Buffer): Message;

  export const constants: {
    STUN_BINDING_RESPONSE: number;
  };
}

export {};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, unknown>
          ) => void;
        };
      };
    };
    FB?: {
      init: (params: Record<string, unknown>) => void;
      login: (
        callback: (response: {
          authResponse?: { accessToken: string };
          status?: string;
        }) => void,
        opts?: { scope: string }
      ) => void;
    };
  }
}

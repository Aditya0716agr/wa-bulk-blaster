
// Type definitions for Chrome extension API
export interface ChromeStorage {
  local: {
    get: (keys: string[], callback: (result: any) => void) => void;
    set: (items: object, callback?: () => void) => void;
  }
}

export interface ChromeRuntime {
  sendMessage: (message: any, callback?: (response: any) => void) => void;
  onMessage?: {
    addListener: (callback: (message: any, sender: any, sendResponse: any) => void) => void;
    removeListener: (callback: (message: any, sender: any, sendResponse: any) => void) => void;
  };
}

export interface ChromeApi {
  storage?: ChromeStorage;
  runtime?: ChromeRuntime;
  tabs?: any;
}

declare global {
  interface Window {
    chrome?: ChromeApi;
  }
}

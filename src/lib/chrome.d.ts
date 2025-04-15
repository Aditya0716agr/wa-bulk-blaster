
// Type definitions for Chrome extension API
export interface ChromeStorage {
  local: {
    get: (keys: string[] | string | null, callback: (result: any) => void) => void;
    set: (items: object, callback?: () => void) => void;
    remove: (keys: string | string[], callback?: () => void) => void;
  }
}

export interface ChromeRuntimeMessage {
  action: string;
  data?: any;
  [key: string]: any;
}

export interface ChromeRuntime {
  sendMessage: (message: ChromeRuntimeMessage, callback?: (response: any) => void) => void;
  onMessage: {
    addListener: (callback: (message: any, sender: any, sendResponse: any) => boolean | void) => void;
    removeListener: (callback: (message: any, sender: any, sendResponse: any) => void) => void;
  };
  getURL: (path: string) => string;
}

export interface ChromeScripting {
  executeScript: (params: {
    target: { tabId: number };
    func: (...args: any[]) => any;
    args?: any[];
  }) => Promise<any[]>;
}

export interface ChromeTabs {
  create: (options: { url: string; active?: boolean }) => Promise<{ id: number }>;
  remove: (tabId: number) => Promise<void>;
  query: (queryInfo: { url?: string }) => Promise<{ id: number }[]>;
  executeScript?: (tabId: number, details: { code: string }) => Promise<any[]>;
}

export interface ChromeApi {
  storage: ChromeStorage;
  runtime: ChromeRuntime;
  tabs?: ChromeTabs;
  scripting?: ChromeScripting;
}

declare global {
  interface Window {
    chrome?: ChromeApi;
  }
}

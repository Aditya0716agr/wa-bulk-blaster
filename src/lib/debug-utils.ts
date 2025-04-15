
import { showToast } from "./toast-utils";

// Debug mode flag - set to true to enable debug mode
const DEBUG_MODE = true;

// Log levels
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

// Debug log function
export function debugLog(level: LogLevel, message: string, data?: any) {
  if (!DEBUG_MODE) return;
  
  const prefix = '🔍 [WA Blaster]';
  
  switch (level) {
    case 'info':
      console.info(`${prefix} ℹ️ ${message}`, data || '');
      break;
    case 'warn':
      console.warn(`${prefix} ⚠️ ${message}`, data || '');
      break;
    case 'error':
      console.error(`${prefix} 🔴 ${message}`, data || '');
      break;
    case 'debug':
      console.debug(`${prefix} 🐞 ${message}`, data || '');
      break;
  }
}

// Debug toast - shows a toast with debug information
export function debugToast(message: string, data?: any) {
  if (!DEBUG_MODE) return;
  
  showToast('info', `Debug: ${message}`, {
    description: data ? JSON.stringify(data).substring(0, 50) : undefined,
    duration: 3000
  });
  
  debugLog('debug', message, data);
}

// Function to check if WhatsApp is open and user is logged in
export async function checkWhatsAppStatus(): Promise<{isOpen: boolean, isLoggedIn: boolean}> {
  if (!window.chrome?.runtime?.sendMessage) {
    return { isOpen: false, isLoggedIn: false };
  }
  
  // Check if WhatsApp Web is open in any tab
  try {
    const tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
    const isOpen = tabs.length > 0;
    
    if (!isOpen) {
      debugLog('warn', 'WhatsApp Web is not open in any tab');
      return { isOpen: false, isLoggedIn: false };
    }
    
    // If WhatsApp is open, check if user is logged in
    const tab = tabs[0];
    const [results] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Check for login indicators
        const loginCheck = document.querySelector('[data-testid="intro-text"]') || 
                          document.querySelector('[data-testid="qrcode"]');
        return { isLoggedIn: !loginCheck };
      }
    });
    
    const isLoggedIn = results.result?.isLoggedIn || false;
    debugLog('info', `WhatsApp status: isOpen=${isOpen}, isLoggedIn=${isLoggedIn}`);
    
    return { isOpen, isLoggedIn };
  } catch (error) {
    debugLog('error', 'Error checking WhatsApp status', error);
    return { isOpen: false, isLoggedIn: false };
  }
}

// Function to directly open a WhatsApp chat for testing
export function openWhatsAppChat(number: string) {
  if (!window.chrome?.tabs?.create) {
    debugLog('error', 'Chrome API not available');
    return;
  }
  
  window.chrome.tabs.create({
    url: `https://web.whatsapp.com/send?phone=${number}`,
    active: true
  });
}

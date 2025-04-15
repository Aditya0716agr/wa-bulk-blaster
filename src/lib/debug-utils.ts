
import { showToast } from "./toast-utils";

// Debug levels
export type DebugLevel = 'info' | 'warn' | 'error' | 'debug';

// Enable debug mode - change to true when troubleshooting
const DEBUG_MODE = true;

// Log with timestamp and level
export function debugLog(level: DebugLevel, message: string, data?: any): void {
  if (!DEBUG_MODE) return;
  
  const timestamp = new Date().toISOString();
  const prefix = `[WA-Blaster ${timestamp}] ${level.toUpperCase()}:`;
  
  switch (level) {
    case 'error':
      console.error(prefix, message, data || '');
      break;
    case 'warn':
      console.warn(prefix, message, data || '');
      break;
    case 'info':
      console.info(prefix, message, data || '');
      break;
    case 'debug':
    default:
      console.log(prefix, message, data || '');
  }
}

// Show debug toast when in debug mode
export function debugToast(message: string, data?: any): void {
  if (!DEBUG_MODE) return;
  
  debugLog('debug', message, data);
  
  showToast("info", "Debug Info", {
    description: message,
    duration: 3000
  });
}

// Function to check if WhatsApp Web is open and user is logged in
export async function checkWhatsAppStatus(): Promise<{
  isOpen: boolean;
  isLoggedIn: boolean;
  error?: string;
}> {
  if (!window.chrome?.tabs?.query) {
    return { isOpen: false, isLoggedIn: false, error: "Chrome API not available" };
  }
  
  try {
    // Check if WhatsApp Web is open
    const tabs = await window.chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
    
    if (tabs.length === 0) {
      return { isOpen: false, isLoggedIn: false };
    }
    
    // WhatsApp is open, check if logged in
    if (!window.chrome.scripting?.executeScript) {
      return { isOpen: true, isLoggedIn: false, error: "Scripting API not available" };
    }
    
    const [result] = await window.chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      func: () => {
        // Check for login elements
        const qrCode = document.querySelector('[data-testid="qrcode"]');
        const intro = document.querySelector('[data-testid="intro-text"]');
        // Check for elements that indicate we're logged in
        const chatList = document.querySelector('[data-testid="chat-list"]');
        
        return {
          hasQrCode: !!qrCode,
          hasIntro: !!intro,
          hasChatList: !!chatList
        };
      }
    });
    
    const isLoggedIn = !result.result.hasQrCode && !result.result.hasIntro && result.result.hasChatList;
    
    return { isOpen: true, isLoggedIn };
  } catch (error) {
    debugLog('error', 'Error checking WhatsApp status', error);
    return { 
      isOpen: false, 
      isLoggedIn: false, 
      error: error instanceof Error ? error.message : String(error) 
    };
  }
}


import { showToast } from "./toast-utils";
import { debugLog } from "./debug-utils";

// Handle bulk message sending results
export function handleMessagingResults(results: any[]) {
  if (!results || results.length === 0) {
    showToast("error", "No results received", {
      description: "Message sending completed, but no result data was returned"
    });
    return;
  }

  // Count successes and failures
  const successful = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const invalid = results.filter(r => r.status === 'invalid').length;

  // Log details of failed messages
  const failedMessages = results.filter(r => r.status === 'failed');
  if (failedMessages.length > 0) {
    debugLog('error', 'Failed messages:', failedMessages);
  }

  if (successful === results.length) {
    showToast("success", "All messages sent successfully", {
      description: `${successful} message(s) delivered`
    });
  } else if (successful > 0) {
    showToast("warning", "Some messages were sent", {
      description: `${successful} sent, ${failed} failed, ${invalid} invalid`
    });
  } else {
    showToast("error", "Failed to send messages", {
      description: `${failed} failed, ${invalid} invalid numbers`,
      duration: 6000,
      action: {
        label: "Get Help",
        onClick: () => {
          // Open WhatsApp directly to test
          window.chrome?.tabs?.create({
            url: "https://web.whatsapp.com/",
            active: true
          });
        }
      }
    });
  }

  // Log detailed results to console for debugging
  debugLog('info', "Message sending results:", results);
}

// Function to add message listener for specific response type
export function addMessageListener(
  actionType: string, 
  callback: (results: any) => void
) {
  if (!window.chrome?.runtime?.onMessage) {
    debugLog('warn', "Chrome runtime API not available");
    return;
  }

  debugLog('info', `Adding message listener for ${actionType}`);
  const listener = (message: any) => {
    debugLog('info', "Received message in listener:", message);
    if (message.action === actionType) {
      callback(message.results);
    }
  };

  window.chrome.runtime.onMessage.addListener(listener);
  
  // Return function to remove listener
  return () => {
    debugLog('info', `Removing message listener for ${actionType}`);
    window.chrome.runtime.onMessage.removeListener(listener);
  };
}

// Simple validation for WhatsApp numbers
export function validateWhatsAppNumber(number: string): boolean {
  // Remove any non-digit characters
  const cleaned = number.replace(/\D/g, '');
  
  // WhatsApp numbers should be at least 8 digits
  // Some countries have 7-digit numbers, but WhatsApp generally needs country code
  return cleaned.length >= 8;
}

// Function to handle WhatsApp Web initialization
export function ensureWhatsAppWebIsOpen(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.chrome?.tabs) {
      debugLog('error', "Chrome tabs API not available");
      resolve(false);
      return;
    }

    // Check if WhatsApp Web is already open
    window.chrome.tabs.query({ url: "https://web.whatsapp.com/*" }).then(tabs => {
      if (tabs.length > 0) {
        // WhatsApp is already open, focus on that tab
        debugLog('info', "WhatsApp Web is already open");
        if (tabs[0].id) {
          // Fixed: Use create() method to focus the tab since update() is not available in our type definition
          window.chrome.tabs.create({
            url: "https://web.whatsapp.com/",
            active: true
          })
            .then(() => {
              showToast("info", "WhatsApp Web tab activated", {
                description: "Please ensure you're logged in before sending messages"
              });
              resolve(true);
            })
            .catch(err => {
              debugLog('error', "Error activating WhatsApp tab:", err);
              resolve(false);
            });
        } else {
          // Fallback to creating a new tab
          window.chrome.tabs.create({
            url: "https://web.whatsapp.com/",
            active: true
          }).then(() => {
            showToast("info", "WhatsApp Web opened", {
              description: "Please ensure you're logged in before sending messages"
            });
            resolve(true);
          });
        }
      } else {
        // Open WhatsApp Web
        debugLog('info', "Opening WhatsApp Web");
        window.chrome.tabs.create({ 
          url: "https://web.whatsapp.com/",
          active: true
        }).then(() => {
          showToast("info", "WhatsApp Web opened", {
            description: "Please ensure you're logged in before sending messages"
          });
          resolve(true);
        });
      }
    });
  });
}

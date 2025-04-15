
import { showToast } from "./toast-utils";

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
      description: `${failed} failed, ${invalid} invalid numbers`
    });
  }

  // Log detailed results to console for debugging
  console.log("Message sending results:", results);
}

// Function to add message listener for specific response type
export function addMessageListener(
  actionType: string, 
  callback: (results: any) => void
) {
  if (!window.chrome?.runtime?.onMessage) return;

  const listener = (message: any) => {
    console.log("Received message in listener:", message);
    if (message.action === actionType) {
      callback(message.results);
    }
  };

  window.chrome.runtime.onMessage.addListener(listener);
  
  // Return function to remove listener
  return () => {
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

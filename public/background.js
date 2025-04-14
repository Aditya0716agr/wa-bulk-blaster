
// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "sendBulkMessages") {
    sendBulkMessages(message.data.numbers, message.data.message, message.data.delay, message.data.attachment);
  } else if (message.action === "toggleAutoReply") {
    toggleAutoReply(message.data.enabled);
  } else if (message.action === "exportContacts") {
    exportContacts();
  }
  return true; // Keep message channel open for async operations
});

// Function to send bulk messages
async function sendBulkMessages(numbers, message, delay, attachment) {
  const results = [];
  
  for (let i = 0; i < numbers.length; i++) {
    const number = numbers[i].trim();
    if (!number) continue;
    
    try {
      // Open WhatsApp direct message link
      const tab = await chrome.tabs.create({
        url: `https://wa.me/${number}`,
        active: false
      });
      
      // Wait for page to load
      await new Promise(r => setTimeout(r, 3000));
      
      // Check if number is valid (by checking for error screens)
      const isValid = await chrome.tabs.executeScript(tab.id, {
        code: `
          // Check if there's an error message about invalid number
          !document.body.textContent.includes('phone number shared via link is not on WhatsApp');
        `
      });
      
      // If number is invalid, log and skip
      if (!isValid[0]) {
        results.push({ number, status: 'invalid', error: 'Number not on WhatsApp' });
        await chrome.tabs.remove(tab.id);
        continue;
      }
      
      // Inject a script to send the message with attachment if provided
      await chrome.tabs.executeScript(tab.id, {
        code: `
          (async () => {
            // Click on "Continue to chat" button if it exists
            const continueBtn = document.querySelector('a[title="Continue to Chat"]');
            if (continueBtn) {
              continueBtn.click();
              await new Promise(r => setTimeout(r, 3000));
            }
            
            // Now we should be in chat window, check if we're properly in WhatsApp Web
            if (!window.location.href.includes('web.whatsapp.com')) {
              return { success: false, error: 'Failed to open WhatsApp Web' };
            }
            
            // Add a small delay to ensure elements are loaded
            await new Promise(r => setTimeout(r, 1500));
            
            // Handle attachment if provided
            const attachment = ${JSON.stringify(attachment)};
            if (attachment) {
              try {
                // First, we need to click the attachment button
                const attachButton = document.querySelector('[data-testid="attach-menu-icon"]') || 
                                     document.querySelector('[data-icon="attach-menu-plus"]');
                
                if (!attachButton) {
                  return { success: false, error: 'Attachment button not found' };
                }
                
                attachButton.click();
                await new Promise(r => setTimeout(r, 500));
                
                // Create a blob from the base64 data
                const binaryString = atob(attachment.data.split(',')[1]);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: attachment.type });
                
                // Create a File object from the Blob
                const file = new File([blob], attachment.name, { type: attachment.type });
                
                // Find the document/photo input
                const fileInputSelector = 'input[type="file"]';
                const fileInput = document.querySelector(fileInputSelector);
                
                if (!fileInput) {
                  return { success: false, error: 'File input not found' };
                }
                
                // Create a DataTransfer object and set the file
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                fileInput.files = dataTransfer.files;
                
                // Trigger a change event
                const event = new Event('change', { bubbles: true });
                fileInput.dispatchEvent(event);
                
                // Wait for attachment to upload
                await new Promise(r => setTimeout(r, 2000));
              } catch (error) {
                console.error('Attachment error:', error);
                return { success: false, error: 'Failed to attach file: ' + error.message };
              }
            }
            
            // Add text message if provided
            const messageText = ${JSON.stringify(message)};
            if (messageText) {
              // Find the message input and add text
              const messageInput = document.querySelector('[data-testid="compose-box-input"]');
              if (messageInput) {
                messageInput.focus();
                // Use document.execCommand for compatibility
                document.execCommand('insertText', false, messageText);
                
                // Trigger input event
                const event = new Event('input', { bubbles: true });
                messageInput.dispatchEvent(event);
              }
            }
            
            // Finally click the send button
            await new Promise(r => setTimeout(r, 500));
            const sendButton = document.querySelector('[data-testid="send"]');
            if (sendButton) {
              sendButton.click();
              return { success: true };
            }
            
            return { success: false, error: 'Send button not found' };
          })();
        `
      });
      
      // Log success
      results.push({ number, status: 'success' });
      
      // Close the tab
      await chrome.tabs.remove(tab.id);
      
      // Wait for the delay specified by user
      await new Promise(r => setTimeout(r, delay * 1000));
      
    } catch (error) {
      results.push({ number, status: 'failed', error: error.message });
      // Try to close tab if it was created but had errors
      try {
        const tabs = await chrome.tabs.query({ url: `https://wa.me/${number}` });
        if (tabs.length > 0) {
          await chrome.tabs.remove(tabs[0].id);
        }
      } catch (e) {
        // Ignore errors when closing tabs
      }
    }
  }
  
  // Send results back to popup
  chrome.runtime.sendMessage({
    action: "bulkMessageResults",
    results: results
  });
}

// Function to toggle auto-reply
function toggleAutoReply(enabled) {
  chrome.storage.local.set({ autoReplyEnabled: enabled });
  
  // Notify content script about the change
  chrome.tabs.query({ url: "https://web.whatsapp.com/*" }, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { 
        action: "autoReplyStatusChanged", 
        enabled: enabled 
      });
    });
  });
}

// Function to export contacts
function exportContacts() {
  chrome.tabs.query({ url: "https://web.whatsapp.com/*" }, (tabs) => {
    if (tabs.length > 0) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "exportContacts" });
    } else {
      chrome.runtime.sendMessage({
        action: "exportContactsResult",
        error: "WhatsApp Web is not open"
      });
    }
  });
}

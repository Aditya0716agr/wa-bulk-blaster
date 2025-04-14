
// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "sendBulkMessages") {
    sendBulkMessages(message.data.numbers, message.data.message, message.data.delay);
  } else if (message.action === "toggleAutoReply") {
    toggleAutoReply(message.data.enabled);
  } else if (message.action === "exportContacts") {
    exportContacts();
  }
});

// Function to send bulk messages
async function sendBulkMessages(numbers, message, delay) {
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
      
      // Wait for a moment to let the page load
      await new Promise(r => setTimeout(r, 3000));
      
      // Inject a script to send the message
      await chrome.tabs.executeScript(tab.id, {
        code: `
          (async () => {
            // Click on "Continue to chat" button if it exists
            const continueBtn = document.querySelector('a[title="Continue to Chat"]');
            if (continueBtn) {
              continueBtn.click();
              await new Promise(r => setTimeout(r, 3000));
            }
            
            // Now we should be in chat window, try to find message input
            const messageInput = document.querySelector('[data-testid="compose-box-input"]');
            if (messageInput) {
              messageInput.focus();
              messageInput.textContent = ${JSON.stringify(message)};
              
              // Trigger input event
              const event = new Event('input', { bubbles: true });
              messageInput.dispatchEvent(event);
              
              // Find and click send button
              const sendButton = document.querySelector('[data-testid="send"]');
              if (sendButton) {
                sendButton.click();
                return true;
              }
            }
            return false;
          })();
        `
      });
      
      // Log result
      results.push({ number, status: 'success' });
      
      // Close the tab
      await chrome.tabs.remove(tab.id);
      
      // Wait for the delay specified by user
      await new Promise(r => setTimeout(r, delay * 1000));
      
    } catch (error) {
      results.push({ number, status: 'failed', error: error.message });
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

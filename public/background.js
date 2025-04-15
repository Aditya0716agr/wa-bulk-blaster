// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message);
  
  if (message.action === "sendBulkMessages") {
    sendBulkMessages(message.data.numbers, message.data.message, message.data.delay, message.data.attachment)
      .then(results => {
        chrome.runtime.sendMessage({
          action: "bulkMessageResults",
          results: results
        });
      });
  } else if (message.action === "toggleAutoReply") {
    toggleAutoReply(message.data.enabled);
  } else if (message.action === "exportContacts") {
    exportContacts();
  } else if (message.action === "getGroups") {
    getGroups().then(groups => {
      sendResponse(groups);
    });
    return true; // Keep message channel open for async response
  } else if (message.action === "sendGroupMessages") {
    sendGroupMessages(message.data.groups, message.data.message, message.data.delay, message.data.attachment)
      .then(results => {
        chrome.runtime.sendMessage({
          action: "groupMessageResults",
          results: results
        });
      });
  } else if (message.action === "updateWelcomeMessage") {
    updateWelcomeMessage(message.data.welcomeMessage);
  } else if (message.action === "getBusinessLabels") {
    getBusinessLabels().then(labels => {
      sendResponse(labels);
    });
    return true; // Keep message channel open for async response
  } else if (message.action === "sendLabelMessages") {
    sendLabelMessages(message.data.label, message.data.message, message.data.delay, message.data.attachment)
      .then(results => {
        chrome.runtime.sendMessage({
          action: "labelMessageResults",
          results: results
        });
      });
  }
  
  return true; // Always return true to indicate async response
});

// Function to send bulk messages
async function sendBulkMessages(numbers, message, delay, attachment) {
  console.log("Starting to send bulk messages to:", numbers);
  const results = [];
  
  for (let i = 0; i < numbers.length; i++) {
    const number = numbers[i].trim();
    if (!number) continue;
    
    try {
      console.log(`Processing number ${i+1}/${numbers.length}: ${number}`);
      
      // Open WhatsApp direct message link
      const tab = await chrome.tabs.create({
        url: `https://wa.me/${number}`,
        active: false
      });
      
      // Wait for page to load
      await new Promise(r => setTimeout(r, 3000));
      
      // Check if number is valid
      let isValid = true;
      try {
        const [validCheck] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            return !document.body.textContent.includes('phone number shared via link is not on WhatsApp');
          }
        });
        isValid = validCheck.result;
      } catch (e) {
        console.error("Error checking if number is valid:", e);
        isValid = false;
      }
      
      // If number is invalid, log and skip
      if (!isValid) {
        console.log(`Number ${number} is invalid`);
        results.push({ number, status: 'invalid', error: 'Number not on WhatsApp' });
        await chrome.tabs.remove(tab.id);
        continue;
      }
      
      // Inject a script to send the message with attachment if provided
      let sendResult;
      try {
        const [result] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: async (messageText, attachmentData) => {
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
            if (attachmentData) {
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
                const binaryString = atob(attachmentData.data.split(',')[1]);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: attachmentData.type });
                
                // Create a File object from the Blob
                const file = new File([blob], attachmentData.name, { type: attachmentData.type });
                
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
          },
          args: [message, attachment]
        });
        
        sendResult = result.result;
      } catch (e) {
        console.error("Error executing script:", e);
        sendResult = { success: false, error: e.message };
      }
      
      // Log result
      if (sendResult && sendResult.success) {
        console.log(`Successfully sent message to ${number}`);
        results.push({ number, status: 'success' });
      } else {
        console.log(`Failed to send message to ${number}:`, sendResult?.error || 'Unknown error');
        results.push({ number, status: 'failed', error: sendResult?.error || 'Unknown error' });
      }
      
      // Close the tab
      await chrome.tabs.remove(tab.id);
      
      // Wait for the delay specified by user
      await new Promise(r => setTimeout(r, delay * 1000));
      
    } catch (error) {
      console.error(`Error processing ${number}:`, error);
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
  
  console.log("Bulk message sending completed with results:", results);
  return results;
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

// Function to get all WhatsApp groups
async function getGroups() {
  return new Promise((resolve) => {
    chrome.tabs.query({ url: "https://web.whatsapp.com/*" }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "getGroups" }, (response) => {
          resolve(response || []);
        });
      } else {
        resolve([]);
      }
    });
  });
}

// Function to get business labels
async function getBusinessLabels() {
  return new Promise((resolve) => {
    chrome.tabs.query({ url: "https://web.whatsapp.com/*" }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "getBusinessLabels" }, (response) => {
          resolve(response || { isBusinessAccount: false, labels: [] });
        });
      } else {
        resolve({ isBusinessAccount: false, labels: [] });
      }
    });
  });
}

// Function to send messages to groups
async function sendGroupMessages(groups, message, delay, attachment) {
  const results = [];
  
  // Get the WhatsApp Web tab
  const tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
  if (tabs.length === 0) {
    chrome.runtime.sendMessage({
      action: "groupMessageResults",
      results: [{ name: "Error", status: "failed", error: "WhatsApp Web is not open" }]
    });
    return;
  }
  
  const tab = tabs[0];
  
  // Send messages to each group
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    
    try {
      // Click on the group to open the chat
      await chrome.tabs.executeScript(tab.id, {
        code: `
          (async () => {
            // Try to find and click the group in the sidebar
            const groups = await ${getGroups.toString()}();
            const group = groups.find(g => g.id === "${group.id}");
            
            if (group && group.element) {
              group.element.click();
              return { success: true };
            }
            
            return { success: false, error: "Group not found" };
          })();
        `
      });
      
      // Wait for chat to load
      await new Promise(r => setTimeout(r, 1000));
      
      // Send the message with attachment if provided
      await chrome.tabs.executeScript(tab.id, {
        code: `
          (async () => {
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
      results.push({ name: group.name, status: 'success' });
      
      // Wait for the delay specified by user
      await new Promise(r => setTimeout(r, delay * 1000));
      
    } catch (error) {
      results.push({ name: group.name, status: 'failed', error: error.message });
    }
  }
  
  // Send results back to popup
  chrome.runtime.sendMessage({
    action: "groupMessageResults",
    results: results
  });
}

// Function to update welcome message
function updateWelcomeMessage(welcomeMessage) {
  // Store welcome message in chrome.storage
  chrome.storage.local.set({ welcomeMessage: welcomeMessage });
  
  // Notify content scripts about the change
  chrome.tabs.query({ url: "https://web.whatsapp.com/*" }, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { 
        action: "welcomeMessageUpdated", 
        welcomeMessage: welcomeMessage 
      });
    });
  });
}

// Function to send messages to chats with specific label
async function sendLabelMessages(label, message, delay, attachment) {
  const results = [];
  
  // Get the WhatsApp Web tab
  const tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
  if (tabs.length === 0) {
    chrome.runtime.sendMessage({
      action: "labelMessageResults",
      results: [{ name: "Error", status: "failed", error: "WhatsApp Web is not open" }]
    });
    return;
  }
  
  const tab = tabs[0];
  
  // Send messages to each chat with the selected label
  for (let i = 0; i < label.chats.length; i++) {
    const chat = label.chats[i];
    
    try {
      // Click on the chat to open it
      await chrome.tabs.executeScript(tab.id, {
        code: `
          (async () => {
            // Try to find and click the chat by ID
            const chatElement = document.querySelector('[data-id="${chat.id}"]');
            if (chatElement) {
              chatElement.click();
              return { success: true };
            }
            return { success: false, error: "Chat not found" };
          })();
        `
      });
      
      // Wait for chat to load
      await new Promise(r => setTimeout(r, 1000));
      
      // Send the message with attachment if provided
      await chrome.tabs.executeScript(tab.id, {
        code: `
          (async () => {
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
      results.push({ name: chat.name, status: 'success' });
      
      // Wait for the delay specified by user
      await new Promise(r => setTimeout(r, delay * 1000));
      
    } catch (error) {
      results.push({ name: chat.name, status: 'failed', error: error.message });
    }
  }
  
  // Send results back to popup
  chrome.runtime.sendMessage({
    action: "labelMessageResults",
    results: results
  });
}

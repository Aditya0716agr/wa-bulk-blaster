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
    return true;
  } else if (message.action === "toggleAutoReply") {
    toggleAutoReply(message.data.enabled);
    return true;
  } else if (message.action === "exportContacts") {
    exportContacts();
    return true;
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
    return true;
  } else if (message.action === "updateWelcomeMessage") {
    updateWelcomeMessage(message.data.welcomeMessage);
    return true;
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
    return true;
  } else if (message.action === "contentScriptReady") {
    console.log("Content script ready on:", message.data.url);
    return true;
  } else if (message.action === "openWhatsApp") {
    chrome.tabs.create({
      url: "https://web.whatsapp.com/",
      active: true
    });
    return true;
  }
  
  return true; // Always return true to indicate async response
});

// Log that the background script has loaded
console.log("WhatsApp Bulk Blaster background script loaded v1.0.4");

// Function to send bulk messages
async function sendBulkMessages(numbers, message, delay, attachment) {
  console.log("Starting to send bulk messages to:", numbers);
  const results = [];
  
  // First, check if WhatsApp Web is open in any tab
  let whatsAppTab = null;
  try {
    const tabs = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
    if (tabs.length > 0) {
      whatsAppTab = tabs[0];
      console.log("Found existing WhatsApp tab:", whatsAppTab.id);
      
      // Focus on the WhatsApp tab
      await chrome.tabs.update(whatsAppTab.id, { active: true });
      
      // Wait a moment to ensure the tab is ready
      await new Promise(r => setTimeout(r, 2000));
    } else {
      // Open WhatsApp Web if not already open
      whatsAppTab = await chrome.tabs.create({
        url: "https://web.whatsapp.com/",
        active: true
      });
      console.log("Created new WhatsApp tab:", whatsAppTab.id);
      
      // Wait for WhatsApp to load - increased to 20 seconds
      await new Promise(r => setTimeout(r, 20000));
    }
  } catch (error) {
    console.error("Error finding/creating WhatsApp tab:", error);
    return [{ number: "Error", status: "failed", error: "Failed to access WhatsApp Web: " + error.message }];
  }
  
  // Check if user is logged in to WhatsApp
  try {
    const [loginCheck] = await chrome.scripting.executeScript({
      target: { tabId: whatsAppTab.id },
      func: () => {
        const loginElements = document.querySelector('[data-testid="intro-text"]') || 
                            document.querySelector('[data-testid="qrcode"]');
        return !!loginElements;
      }
    });
    
    if (loginCheck.result) {
      console.error("User not logged in to WhatsApp Web");
      return [{ number: "Error", status: "failed", error: "Please scan the QR code to log in to WhatsApp Web" }];
    }
  } catch (error) {
    console.error("Error checking login status:", error);
    return [{ number: "Error", status: "failed", error: "Failed to check login status: " + error.message }];
  }
  
  // Process each number
  for (let i = 0; i < numbers.length; i++) {
    const number = numbers[i].trim();
    if (!number) continue;
    
    try {
      console.log(`Processing number ${i+1}/${numbers.length}: ${number}`);
      
      // Modified: Directly use the method that works most reliably - open wa.me links
      const waLink = `https://web.whatsapp.com/send?phone=${number}&text=${encodeURIComponent(message || '')}`;
      console.log("Opening direct wa.me link:", waLink);
      
      await chrome.tabs.update(whatsAppTab.id, {
        url: waLink,
        active: true
      });
      
      // Increased wait time for chat to load properly - critical for message delivery
      console.log("Waiting for chat to load...");
      await new Promise(r => setTimeout(r, 15000));
      
      // Check if number is valid by looking for invalid number message
      let isValid = true;
      try {
        const [validCheck] = await chrome.scripting.executeScript({
          target: { tabId: whatsAppTab.id },
          func: () => {
            // Check for any error messages in the page
            const invalidTexts = [
              'phone number shared via link is not on WhatsApp',
              'invalid phone number',
              'This person is not on WhatsApp'
            ];
            
            for (const text of invalidTexts) {
              if (document.body.textContent.includes(text)) {
                console.error(`Invalid number detected: ${text}`);
                return false;
              }
            }
            
            // Also check if we can find the chat input field as a positive signal
            const chatInput = document.querySelector('[data-testid="compose-box-input"]') || 
                             document.querySelector('[contenteditable="true"]');
                             
            return !!chatInput;
          }
        });
        
        isValid = validCheck.result;
        console.log(`Number ${number} validation check:`, isValid);
      } catch (e) {
        console.error("Error checking if number is valid:", e);
        isValid = false;
      }
      
      // If number is invalid, log and skip
      if (!isValid) {
        console.log(`Number ${number} is invalid`);
        results.push({ number, status: 'invalid', error: 'Number not on WhatsApp' });
        continue;
      }
      
      // Wait to ensure chat is fully loaded
      await new Promise(r => setTimeout(r, 3000));
      
      // Send the message directly from background script to ensure delivery
      try {
        // If we used wa.me link with text parameter, we just need to click send
        const [sendResult] = await chrome.scripting.executeScript({
          target: { tabId: whatsAppTab.id },
          func: async () => {
            try {
              console.log("Looking for send button...");
              // Try multiple send button selectors for reliability
              const sendButtonSelectors = [
                '[data-testid="send"]',
                '[data-icon="send"]',
                'span[data-icon="send"]',
                'button[aria-label="Send"]'
              ];
              
              let sendButton = null;
              for (const selector of sendButtonSelectors) {
                sendButton = document.querySelector(selector);
                if (sendButton) {
                  console.log("Found send button with selector:", selector);
                  break;
                }
              }
              
              if (sendButton) {
                console.log("Clicking send button");
                sendButton.click();
                return { success: true };
              } else {
                // Try alternative - press Enter key on message input
                const inputField = document.querySelector('[data-testid="compose-box-input"]') || 
                                  document.querySelector('[contenteditable="true"]');
                                  
                if (inputField) {
                  console.log("Send button not found, triggering Enter keypress");
                  inputField.dispatchEvent(new KeyboardEvent('keydown', { 
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true
                  }));
                  
                  return { success: true };
                }
                
                return { success: false, error: "No send button or input field found" };
              }
            } catch (e) {
              console.error("Error sending message:", e);
              return { success: false, error: e.toString() };
            }
          }
        });
        
        if (sendResult.result.success) {
          console.log(`Successfully sent message to ${number}`);
          results.push({ number, status: 'success' });
        } else {
          console.error(`Failed to send message to ${number}:`, sendResult.result.error);
          results.push({ number, status: 'failed', error: sendResult.result.error });
        }
      } catch (error) {
        console.error("Error executing send script:", error);
        results.push({ number, status: 'failed', error: error.message });
      }
      
      // Wait for the delay specified by user + additional 2 seconds for reliability
      await new Promise(r => setTimeout(r, (delay * 1000) + 2000));
      
    } catch (error) {
      console.error(`Error processing ${number}:`, error);
      results.push({ number, status: 'failed', error: error.message });
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
    console.error("WhatsApp Web is not open");
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
      console.log(`Sending message to group: ${group.name}`);
      
      // Click on the group to open the chat - use executeScript for better error handling
      let openChatResult;
      try {
        [openChatResult] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (groupId, groupName) => {
            console.log(`Looking for group: ${groupName} with ID: ${groupId}`);
            
            // Try to find the group in the sidebar by name if ID doesn't work
            const groups = document.querySelectorAll('[data-testid="cell-frame-container"]');
            for (const item of groups) {
              const nameEl = item.querySelector('[data-testid="cell-frame-title"]');
              if (nameEl && (item.getAttribute('data-id') === groupId || 
                  nameEl.textContent.trim() === groupName)) {
                console.log("Found group, clicking it");
                item.click();
                return { success: true };
              }
            }
            
            return { success: false, error: "Group not found in sidebar" };
          },
          args: [group.id, group.name]
        });
      } catch (e) {
        console.error("Error opening group chat:", e);
        results.push({ name: group.name, status: 'failed', error: `Error opening chat: ${e.message}` });
        continue;
      }
      
      if (!openChatResult.result.success) {
        console.error("Failed to open group chat:", openChatResult.result.error);
        results.push({ name: group.name, status: 'failed', error: openChatResult.result.error });
        continue;
      }
      
      // Wait for chat to load
      await new Promise(r => setTimeout(r, 3000));
      
      // Send the message with attachment if provided
      let sendResult;
      try {
        [sendResult] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: async (messageText, attachmentData) => {
            console.log("Trying to send message to group");
            
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
                await new Promise(r => setTimeout(r, 1000));
                
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
                await new Promise(r => setTimeout(r, 3000));
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
                console.log("Found message input, adding text");
                messageInput.focus();
                // Use document.execCommand for compatibility
                document.execCommand('insertText', false, messageText);
                
                // Trigger input event
                const event = new Event('input', { bubbles: true });
                messageInput.dispatchEvent(event);
                
                // Additional verification that text was entered
                if (!messageInput.textContent && !messageInput.innerHTML) {
                  console.error("Failed to insert text into input");
                  
                  // Alternative method to set text
                  messageInput.textContent = messageText;
                }
              } else {
                console.error("Message input not found");
                return { success: false, error: 'Message input not found' };
              }
            }
            
            // Finally click the send button
            await new Promise(r => setTimeout(r, 1000));
            const sendButton = document.querySelector('[data-testid="send"]');
            if (sendButton) {
              console.log("Found send button, clicking it");
              sendButton.click();
              return { success: true };
            } else {
              console.error("Send button not found");
              return { success: false, error: 'Send button not found' };
            }
          },
          args: [message, attachment]
        });
      } catch (e) {
        console.error("Error sending message:", e);
        results.push({ name: group.name, status: 'failed', error: `Error sending message: ${e.message}` });
        continue;
      }
      
      if (sendResult.result.success) {
        console.log(`Successfully sent message to group: ${group.name}`);
        results.push({ name: group.name, status: 'success' });
      } else {
        console.error(`Failed to send message to group ${group.name}:`, sendResult.result.error);
        results.push({ name: group.name, status: 'failed', error: sendResult.result.error });
      }
      
      // Wait for the delay specified by user
      await new Promise(r => setTimeout(r, delay * 1000));
    } catch (error) {
      console.error(`Error processing group ${group.name}:`, error);
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

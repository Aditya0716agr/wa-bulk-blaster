// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);
window.addEventListener('load', init); // Add an additional listener for window.load

// Global variables
let autoReplyEnabled = false;
let floatingButton = null;
let welcomeMessage = "Welcome to the group! We're glad to have you here.";
let isInitialized = false;
let lastMessageSent = null;

// Get stored settings from storage
chrome.storage.local.get(['autoReplyEnabled', 'welcomeMessage'], (result) => {
  console.log("Retrieved stored settings:", result);
  autoReplyEnabled = result.autoReplyEnabled || false;
  welcomeMessage = result.welcomeMessage || welcomeMessage;
});

// Initialize content script
function init() {
  // Prevent multiple initializations
  if (isInitialized) return;
  isInitialized = true;
  
  console.log("🚀 WhatsApp Bulk Blaster content script initializing... v1.0.3");
  
  // Check if this is WhatsApp Web
  if (!window.location.href.includes('web.whatsapp.com')) {
    console.log("Not on WhatsApp Web, checking for wa.me links");
    if (window.location.href.includes('wa.me')) {
      setupInvalidNumberDetection();
    }
    return;
  }
  
  console.log("On WhatsApp Web, setting up extension functionality");
  
  // Add a small delay to ensure WhatsApp Web DOM is loaded
  setTimeout(() => {
    createFloatingButton();
    setupMessageObserver();
    setupAutoReply();
    setupGroupObserver();
    setupDirectMessageListeners();
    updateFloatingButton();
    console.log("WhatsApp Bulk Blaster initialized successfully");
    
    // Notify background script that we're ready
    chrome.runtime.sendMessage({ 
      action: "contentScriptReady",
      data: { url: window.location.href }
    });
  }, 5000);
}

// Create floating button
function createFloatingButton() {
  // Remove any existing button first
  if (floatingButton) {
    floatingButton.remove();
  }
  
  // Create the button element
  floatingButton = document.createElement('div');
  floatingButton.innerHTML = 'WhatsApp Bulk Blaster';
  floatingButton.className = 'wa-bulk-blaster-floating-btn';
  
  // Add styles
  const style = document.createElement('style');
  style.textContent = `
    .wa-bulk-blaster-floating-btn {
      position: fixed;
      bottom: 80px;
      right: 20px;
      background-color: #9b87f5;
      color: white;
      padding: 10px 15px;
      border-radius: 20px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      z-index: 1000;
      cursor: pointer;
      font-family: sans-serif;
      font-size: 14px;
      transition: all 0.3s ease;
    }
    .wa-bulk-blaster-floating-btn:hover {
      background-color: #7E69AB;
      transform: translateY(-2px);
    }
  `;
  
  document.head.appendChild(style);
  document.body.appendChild(floatingButton);
  
  // Add click listener
  floatingButton.addEventListener('click', () => {
    alert('WA Bulk Blaster is active! Version 1.0.1');
  });
  
  console.log("Floating button created");
}

// Setup message observer to detect incoming messages
function setupMessageObserver() {
  // Create a mutation observer to watch for new messages
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length) {
        // Check if new nodes contain message elements
        checkForNewMessages();
      }
    }
  });
  
  // Periodically check for the chat container and observe it
  const checkForContainer = setInterval(() => {
    const chatContainer = document.querySelector('#main div.copyable-area');
    if (chatContainer) {
      observer.observe(chatContainer, { childList: true, subtree: true });
      clearInterval(checkForContainer);
    }
  }, 2000);
}

// Setup observer for new group participants
function setupGroupObserver() {
  // Create a mutation observer to watch for messages in group chats
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length) {
        // Check for join messages
        checkForNewParticipants();
      }
    }
  });
  
  // Periodically check for the chat container and observe it
  const checkForContainer = setInterval(() => {
    const chatContainer = document.querySelector('#main div.copyable-area');
    if (chatContainer) {
      observer.observe(chatContainer, { childList: true, subtree: true });
      clearInterval(checkForContainer);
    }
  }, 2000);
}

// Check for messages indicating new participants
function checkForNewParticipants() {
  const messages = document.querySelectorAll('div.message-system');
  
  messages.forEach(message => {
    // Skip if already processed
    if (message.dataset.processed) return;
    message.dataset.processed = 'true';
    
    const messageText = message.innerText || '';
    
    // Check for join messages
    if (messageText.includes('joined using this group') || 
        messageText.includes('added') || 
        messageText.includes('joined')) {
      
      // Extract the participant name if possible
      let participantName = '';
      const nameMatch = messageText.match(/([^\s]+) joined|([^\s]+) was added/);
      if (nameMatch) {
        participantName = nameMatch[1] || nameMatch[2];
      }
      
      // Check if this is a group chat
      const isGroup = !!document.querySelector('[data-testid="group-info-drawer-subject-input"]');
      
      if (isGroup) {
        // Get the stored welcome message
        chrome.storage.local.get(['welcomeMessage'], (result) => {
          const welcomeMsg = result.welcomeMessage || welcomeMessage;
          
          // Personalize welcome message if we have a name
          const personalizedMessage = participantName ? 
            welcomeMsg.replace('{name}', participantName) : welcomeMessage;
          
          // Delay sending the welcome message to make it seem natural
          setTimeout(() => {
            sendMessage(personalizedMessage);
          }, 2000);
        });
      }
    }
  });
}

// Setup listeners for direct message handling
function setupDirectMessageListeners() {
  console.log("Setting up direct message listeners");
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Content script received message:", message);
    
    if (message.action === "sendDirectMessage") {
      console.log("Received direct message request", message.data);
      sendDirectMessage(message.data.message, message.data.attachment)
        .then(result => {
          console.log("Message sending result:", result);
          sendResponse(result);
        })
        .catch(error => {
          console.error("Error sending message:", error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep the message channel open for async response
    }
  });
}

// Function to send a direct message in the current chat
async function sendDirectMessage(messageText, attachment) {
  console.log("🔵 Attempting to send direct message", { messageText, hasAttachment: !!attachment });
  
  try {
    // Ensure we are in WhatsApp Web and in a chat
    if (!window.location.href.includes('web.whatsapp.com')) {
      throw new Error('Not in WhatsApp Web');
    }
    
    // Check if we're in a chat (look for chat input)
    const inputField = await waitForElement('[data-testid="compose-box-input"]', 10000);
    if (!inputField) {
      throw new Error('Message input not found - not in a chat');
    }
    
    // Verify chat is loaded and ready for messages
    const chatHeader = document.querySelector('[data-testid="conversation-header"]');
    if (!chatHeader) {
      throw new Error('Chat not fully loaded');
    }
    
    // Handle attachment if provided
    if (attachment) {
      console.log("Processing attachment", attachment.name);
      try {
        // Click the attachment button
        const attachButton = await waitForElement('[data-testid="attach-menu-icon"]', 5000) || 
                              await waitForElement('[data-icon="attach-menu-plus"]', 5000);
        
        if (!attachButton) {
          throw new Error('Attachment button not found');
        }
        
        attachButton.click();
        await sleep(1000);
        
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
          throw new Error('File input not found');
        }
        
        // Create a DataTransfer object and set the file
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInput.files = dataTransfer.files;
        
        // Trigger a change event
        const event = new Event('change', { bubbles: true });
        fileInput.dispatchEvent(event);
        
        // Wait for attachment to upload
        console.log("Waiting for attachment to upload...");
        await sleep(3000);
        
        console.log("Attachment processed successfully");
      } catch (error) {
        console.error('Attachment error:', error);
        throw new Error('Failed to attach file: ' + error.message);
      }
    }
    
    // Add text message if provided
    if (messageText) {
      try {
        // Find the message input and add text
        console.log("Setting message text...");
        
        // Ensure the input is focused
        inputField.focus();
        
        // Try different methods to insert text
        let textInserted = false;
        
        // Method 1: use document.execCommand
        try {
          document.execCommand('insertText', false, messageText);
          
          // Verify text was inserted
          if (inputField.innerText || inputField.textContent) {
            textInserted = true;
            console.log("Text inserted using execCommand");
          }
        } catch (e) {
          console.warn("execCommand failed:", e);
        }
        
        // Method 2: set innerText/textContent
        if (!textInserted) {
          try {
            // Set text content
            if ('innerText' in inputField) {
              inputField.innerText = messageText;
            } else {
              inputField.textContent = messageText;
            }
            
            // Trigger input event
            const inputEvent = new Event('input', { bubbles: true });
            inputField.dispatchEvent(inputEvent);
            
            console.log("Text inserted using textContent/innerText");
            textInserted = true;
          } catch (e) {
            console.warn("textContent/innerText method failed:", e);
          }
        }
        
        // Method 3: clipboard paste method
        if (!textInserted) {
          try {
            // Copy to clipboard
            await navigator.clipboard.writeText(messageText);
            
            // Send paste event
            const pasteEvent = new ClipboardEvent('paste', {
              bubbles: true,
              clipboardData: new DataTransfer()
            });
            inputField.dispatchEvent(pasteEvent);
            
            console.log("Text inserted using clipboard paste method");
            textInserted = true;
          } catch (e) {
            console.warn("Clipboard paste method failed:", e);
          }
        }
        
        // Final verification
        if (!textInserted) {
          throw new Error("Failed to insert message text using all methods");
        }
        
        // Wait a moment to ensure text is processed
        await sleep(500);
      } catch (error) {
        console.error("Message input error:", error);
        throw new Error('Failed to insert message: ' + error.message);
      }
    }
    
    // Click the send button
    console.log("Clicking send button...");
    const sendButton = await waitForElement('[data-testid="send"]', 5000);
    if (!sendButton) {
      throw new Error('Send button not found');
    }
    
    // Store the message text for verification
    lastMessageSent = messageText;
    
    // Click send button
    sendButton.click();
    
    // Wait to see if message appears in chat
    await sleep(2000);
    
    // Check if message was sent (look for our message text in the latest messages)
    const sentSuccessfully = verifyMessageSent(messageText);
    
    if (sentSuccessfully) {
      console.log("✅ Message sent successfully!");
      return { success: true };
    } else {
      console.warn("⚠️ Could not verify message was sent");
      return { success: true, warning: "Could not verify message was sent" };
    }
  } catch (error) {
    console.error("❌ Failed to send message:", error);
    return { success: false, error: error.message };
  }
}

// Helper function to verify if a message was sent
function verifyMessageSent(messageText) {
  try {
    // Look for sent messages in the chat
    const sentMessages = document.querySelectorAll('[data-testid="msg-text"]');
    if (!sentMessages || sentMessages.length === 0) return false;
    
    // Check the most recent messages (last 3)
    const messageCount = sentMessages.length;
    for (let i = Math.max(0, messageCount - 3); i < messageCount; i++) {
      const msgText = sentMessages[i].textContent;
      if (msgText && msgText.includes(messageText)) {
        return true;
      }
    }
    
    return false;
  } catch (e) {
    console.error("Error verifying message:", e);
    return false;
  }
}

// Helper function to wait for an element to appear in the DOM
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve) => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }
    
    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve(document.querySelector(selector));
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

// Helper function for waiting
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Detect invalid number pages
function setupInvalidNumberDetection() {
  // If on wa.me page, check for invalid number message
  if (window.location.href.includes('wa.me')) {
    // Check for error message indicating number isn't on WhatsApp
    const invalidCheck = setInterval(() => {
      const bodyText = document.body.innerText || '';
      if (bodyText.includes('phone number shared via link is not on WhatsApp')) {
        // Report back to background script that number is invalid
        chrome.runtime.sendMessage({
          action: "invalidNumberDetected",
          url: window.location.href
        });
        clearInterval(invalidCheck);
      }
    }, 1000);
    
    // Clear check after 5 seconds if not found
    setTimeout(() => {
      clearInterval(invalidCheck);
    }, 5000);
  }
}

// Check for new incoming messages
function checkForNewMessages() {
  // If auto-reply is not enabled, do nothing
  if (!autoReplyEnabled) return;
  
  // Find the most recent incoming message
  const messages = document.querySelectorAll('div.message-in');
  if (messages.length === 0) return;
  
  const lastMessage = messages[messages.length - 1];
  
  // Check if message is new (not already replied to)
  if (lastMessage.dataset.replied) return;
  
  // Mark as replied to prevent duplicate replies
  lastMessage.dataset.replied = 'true';
  
  // Get the message text
  const messageText = lastMessage.querySelector('.copyable-text')?.innerText;
  if (!messageText) return;
  
  console.log("Received new message:", messageText);
  
  // Send auto reply after a short delay
  setTimeout(() => {
    sendAutoReply(`Auto-reply: I received your message "${messageText}". I'll get back to you soon.`);
  }, 1500);
}

// Send an auto-reply message
function sendAutoReply(replyText) {
  console.log("Sending auto-reply:", replyText);
  
  // Find the message input field
  const inputField = document.querySelector('[data-testid="compose-box-input"]');
  if (!inputField) {
    console.error("Could not find message input field");
    return;
  }
  
  // Focus and fill input
  inputField.focus();
  document.execCommand('insertText', false, replyText);
  
  // Find and click send button
  setTimeout(() => {
    const sendButton = document.querySelector('[data-testid="send"]');
    if (sendButton) {
      console.log("Clicking send button");
      sendButton.click();
    } else {
      console.error("Could not find send button");
    }
  }, 500);
}

// Generic function to send a message
function sendMessage(messageText) {
  console.log("Sending message:", messageText);
  
  // Find the message input field
  const inputField = document.querySelector('[data-testid="compose-box-input"]');
  if (!inputField) {
    console.error("Could not find message input field");
    return;
  }
  
  // Focus and fill input
  inputField.focus();
  document.execCommand('insertText', false, messageText);
  
  // Find and click send button
  setTimeout(() => {
    const sendButton = document.querySelector('[data-testid="send"]');
    if (sendButton) {
      console.log("Clicking send button");
      sendButton.click();
    } else {
      console.error("Could not find send button");
    }
  }, 500);
}

// Setup auto-reply functionality
function setupAutoReply() {
  console.log("Setting up auto-reply functionality");
  
  // Listen for auto-reply toggle messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Content script received message:", message);
    
    if (message.action === "autoReplyStatusChanged") {
      console.log("Auto-reply status changed to:", message.enabled);
      autoReplyEnabled = message.enabled;
      updateFloatingButton();
    } else if (message.action === "exportContacts") {
      console.log("Exporting contacts");
      exportContacts();
    } else if (message.action === "getGroups") {
      console.log("Getting groups");
      getGroups().then(sendResponse);
      return true; // Keep message channel open for async response
    } else if (message.action === "getBusinessLabels") {
      console.log("Getting business labels");
      getBusinessLabels().then(sendResponse);
      return true; // Keep message channel open for async response
    } else if (message.action === "welcomeMessageUpdated") {
      console.log("Welcome message updated to:", message.welcomeMessage);
      welcomeMessage = message.welcomeMessage;
    }
    return true; // Keep the message channel open
  });
}

// Update floating button based on auto-reply status
function updateFloatingButton() {
  if (!floatingButton) return;
  
  floatingButton.innerHTML = autoReplyEnabled ? 
    'Auto-Reply: ON' : 
    'WhatsApp Bulk Blaster';
    
  floatingButton.style.backgroundColor = autoReplyEnabled ? 
    '#4CAF50' : 
    '#9b87f5';
    
  console.log("Floating button updated, auto-reply:", autoReplyEnabled);
}

// Export contacts
function exportContacts() {
  // Find contact elements
  const contactElements = document.querySelectorAll('[data-testid="cell-frame-container"]');
  const contacts = [];
  
  contactElements.forEach(element => {
    const nameElement = element.querySelector('[data-testid="cell-frame-title"]');
    const phoneElement = element.querySelector('[data-testid="cell-frame-secondary"]');
    
    if (nameElement) {
      contacts.push({
        name: nameElement.innerText,
        phone: phoneElement ? phoneElement.innerText : 'Unknown'
      });
    }
  });
  
  // Send contacts to popup
  chrome.runtime.sendMessage({
    action: "exportContactsResult",
    contacts: contacts
  });
}

// Get all WhatsApp groups
async function getGroups() {
  // Find all chat items
  const chatItems = document.querySelectorAll('[data-testid="cell-frame-container"]');
  const groups = [];
  
  for (const chatItem of chatItems) {
    // Look for group indicators (multiple avatar icons or group icon)
    const isGroup = !!chatItem.querySelector('[data-testid="group-icon"]') || 
                    chatItem.querySelectorAll('[data-testid="default-group"]').length > 0;
    
    if (isGroup) {
      const nameElement = chatItem.querySelector('[data-testid="cell-frame-title"]');
      if (nameElement) {
        groups.push({
          id: chatItem.getAttribute('data-id') || Date.now() + Math.random().toString(),
          name: nameElement.innerText,
          element: chatItem // Store reference to click on it later
        });
      }
    }
  }
  
  return groups;
}

// Get business labels (WhatsApp Business only)
async function getBusinessLabels() {
  // Check for business label elements
  const labels = [];
  const labelElements = document.querySelectorAll('[data-testid="chat-labels-menu"]');
  
  if (labelElements.length === 0) {
    // Not a business account or no labels
    return { isBusinessAccount: false, labels: [] };
  }
  
  // Find all labeled chats
  const chatItems = document.querySelectorAll('[data-testid="cell-frame-container"]');
  const labeledChats = new Map();
  
  for (const chatItem of chatItems) {
    const labelIndicator = chatItem.querySelector('[data-testid="chat-label"]');
    if (labelIndicator) {
      const labelName = labelIndicator.getAttribute('aria-label') || 
                        labelIndicator.getAttribute('title') ||
                        labelIndicator.innerText || 'Unknown Label';
                        
      // Store by label name
      if (!labeledChats.has(labelName)) {
        labeledChats.set(labelName, []);
      }
      
      const nameElement = chatItem.querySelector('[data-testid="cell-frame-title"]');
      if (nameElement) {
        labeledChats.get(labelName).push({
          id: chatItem.getAttribute('data-id') || Date.now() + Math.random().toString(),
          name: nameElement.innerText,
          element: chatItem
        });
      }
    }
  }
  
  // Convert map to array
  labeledChats.forEach((chats, labelName) => {
    labels.push({
      name: labelName,
      chats: chats
    });
  });
  
  return { 
    isBusinessAccount: true, 
    labels: labels 
  };
}

// Ensure WhatsApp Web is loaded before initializing
if (document.readyState === "complete") {
  init();
} else {
  // Sometimes DOMContentLoaded might not be enough, so we also listen for load
  window.addEventListener("load", () => {
    setTimeout(init, 1000);
  });
}

// Re-initialize on URL changes (for SPA)
let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    setTimeout(init, 1000);
  }
}).observe(document, {subtree: true, childList: true});

console.log("WhatsApp Bulk Blaster content script loaded v1.0.3");

// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);
window.addEventListener('load', init); // Add an additional listener for window.load

// Global variables
let autoReplyEnabled = false;
let floatingButton = null;
let welcomeMessage = "Welcome to the group! We're glad to have you here.";
let isInitialized = false;

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
  
  console.log("WhatsApp Bulk Blaster content script initializing...");
  
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
    updateFloatingButton();
    console.log("WhatsApp Bulk Blaster initialized successfully");
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
            welcomeMsg.replace('{name}', participantName) : welcomeMsg;
          
          // Delay sending the welcome message to make it seem natural
          setTimeout(() => {
            sendMessage(personalizedMessage);
          }, 2000);
        });
      }
    }
  });
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

console.log("WhatsApp Bulk Blaster content script loaded");


// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);

// Global variables
let autoReplyEnabled = false;
let floatingButton = null;

// Get auto-reply status from storage
chrome.storage.local.get(['autoReplyEnabled'], (result) => {
  autoReplyEnabled = result.autoReplyEnabled || false;
});

// Initialize content script
function init() {
  // Check if this is WhatsApp Web
  if (!window.location.href.includes('web.whatsapp.com')) return;
  
  // Add a small delay to ensure WhatsApp Web DOM is loaded
  setTimeout(() => {
    createFloatingButton();
    setupMessageObserver();
    setupAutoReply();
  }, 5000);
}

// Create floating button
function createFloatingButton() {
  // Create the button element
  floatingButton = document.createElement('div');
  floatingButton.innerHTML = 'Hello from Extension';
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
    alert('WA Bulk Blaster is active!');
  });
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
  
  // Send auto reply after a short delay
  setTimeout(() => {
    sendAutoReply(`Auto-reply: I received your message "${messageText}". I'll get back to you soon.`);
  }, 1500);
}

// Send an auto-reply message
function sendAutoReply(replyText) {
  // Find the message input field
  const inputField = document.querySelector('[data-testid="compose-box-input"]');
  if (!inputField) return;
  
  // Focus and fill input
  inputField.focus();
  document.execCommand('insertText', false, replyText);
  
  // Find and click send button
  setTimeout(() => {
    const sendButton = document.querySelector('[data-testid="send"]');
    if (sendButton) sendButton.click();
  }, 500);
}

// Setup auto-reply functionality
function setupAutoReply() {
  // Listen for auto-reply toggle messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "autoReplyStatusChanged") {
      autoReplyEnabled = message.enabled;
      updateFloatingButton();
    } else if (message.action === "exportContacts") {
      exportContacts();
    }
    return true;
  });
}

// Update floating button based on auto-reply status
function updateFloatingButton() {
  if (!floatingButton) return;
  
  floatingButton.innerHTML = autoReplyEnabled ? 
    'Auto-Reply: ON' : 
    'Hello from Extension';
    
  floatingButton.style.backgroundColor = autoReplyEnabled ? 
    '#4CAF50' : 
    '#9b87f5';
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

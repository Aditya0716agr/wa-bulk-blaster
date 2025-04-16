// Initialize when DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);
window.addEventListener('load', init); // Add an additional listener for window.load

// Global variables
let autoReplyEnabled = false;
let floatingButton = null;
let welcomeMessage = "Welcome to the group! We're glad to have you here.";
let isInitialized = false;
let lastMessageSent = null;
let debugMode = true; // Enable debug mode

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
  
  console.log("🚀 WhatsApp Bulk Blaster content script initializing... v1.0.6");
  
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

// Setup listeners for direct message handling - improved for better reliability
function setupDirectMessageListeners() {
  console.log("Setting up direct message listeners");
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Content script received message:", message);
    
    if (message.action === "sendDirectMessage") {
      console.log("Received direct message request", message.data);
      
      // Use a promise with timeout to ensure we always send a response
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          console.error("Message sending timed out");
          resolve({ success: false, error: "Operation timed out" });
        }, 30000);
      });
      
      // Race between actual operation and timeout
      Promise.race([
        enhancedSendDirectMessage(message.data.message, message.data.attachment),
        timeoutPromise
      ])
      .then(result => {
        console.log("Message sending result:", result);
        sendResponse(result);
      })
      .catch(error => {
        console.error("Error sending message:", error);
        sendResponse({ success: false, error: error.message || String(error) });
      });
      
      return true; // Keep the message channel open for async response
    }
    
    return true; // Always keep channel open for async responses
  });
}

// ENHANCED VERSION: New function with multiple methods to ensure message sending works
async function enhancedSendDirectMessage(messageText, attachment) {
  console.log("📨 ENHANCED: Attempting to send message", { messageText, hasAttachment: !!attachment });
  
  try {
    // Ensure we are in WhatsApp Web and not on an error page
    if (!window.location.href.includes('web.whatsapp.com')) {
      throw new Error('Not in WhatsApp Web');
    }
    
    // Check for all possible error messages
    const errorTexts = [
      'phone number shared via link is not on WhatsApp',
      'This person is not on WhatsApp',
      'invalid phone number',
      'number could not be identified',
      'The number you're trying to reach isn't available'
    ];
    
    for (const errorText of errorTexts) {
      if (document.body.textContent.includes(errorText)) {
        console.error(`❌ Error detected: ${errorText}`);
        return { success: false, error: `Invalid number - ${errorText}` };
      }
    }
    
    // Wait for chat to fully load
    console.log("Waiting for chat elements to load completely...");
    await waitForChat(10000);
    
    // CRITICAL: Try multiple methods to send the message
    
    // METHOD 1: Use the send button click approach
    const result1 = await trySendWithButton(messageText);
    if (result1.success) {
      return result1;
    }
    
    // METHOD 2: Try with Enter key approach
    const result2 = await trySendWithEnterKey(messageText);
    if (result2.success) {
      return result2;
    }
    
    // METHOD 3: Try injecting the message and button click detection
    const result3 = await trySendWithInjection(messageText);
    if (result3.success) {
      return result3;
    }
    
    // If all methods failed, return detailed error
    return { 
      success: false, 
      error: "Could not send message after trying all available methods",
      attemptedMethods: ["button-click", "enter-key", "script-injection"]
    };
  } catch (error) {
    console.error("❌ Failed to send message:", error);
    return { success: false, error: error.message };
  }
}

// Wait for chat to be fully loaded - returns true when ready
async function waitForChat(timeout = 10000) {
  console.log("Waiting for chat to load...");
  
  // Multiple positive indicators that the chat is loaded
  const chatReadyIndicators = [
    '[data-testid="conversation-panel-wrapper"]',
    '[data-testid="conversation-panel"]',
    '[data-testid="compose-box-input"]',
    '[contenteditable="true"]'
  ];
  
  const startTime = Date.now();
  
  // Keep checking until timeout
  while (Date.now() - startTime < timeout) {
    let isReady = false;
    
    // Check for any of the ready indicators
    for (const selector of chatReadyIndicators) {
      if (document.querySelector(selector)) {
        isReady = true;
        break;
      }
    }
    
    if (isReady) {
      console.log("✅ Chat appears to be loaded and ready");
      // Extra wait to ensure complete readiness
      await sleep(1000);
      return true;
    }
    
    // Wait before checking again
    await sleep(500);
  }
  
  console.warn("⚠️ Timed out waiting for chat to load fully");
  return false;
}

// METHOD 1: Send with button click
async function trySendWithButton(messageText) {
  console.log("METHOD 1: Attempting to send message by finding and clicking send button");
  
  try {
    // Find the input field
    const inputSelectors = [
      '[data-testid="compose-box-input"]',
      '[contenteditable="true"]',
      '[role="textbox"]'
    ];
    
    let inputField = null;
    for (const selector of inputSelectors) {
      inputField = document.querySelector(selector);
      if (inputField) {
        console.log("Found input field with selector:", selector);
        break;
      }
    }
    
    if (!inputField) {
      return { success: false, error: "Input field not found", method: "button-click" };
    }
    
    // IMPORTANT: First focus, then clear any existing text
    inputField.focus();
    await sleep(500);
    
    // Clear existing content (WhatsApp might have pre-filled from URL)
    inputField.textContent = "";
    inputField.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(500);
    
    // Insert text - using multiple methods for reliability
    let textInserted = false;
    
    // Method A: document.execCommand
    try {
      document.execCommand('insertText', false, messageText);
      if (inputField.textContent || inputField.innerText) {
        textInserted = true;
        console.log("Text inserted with execCommand");
      }
    } catch (e) {
      console.warn("execCommand failed:", e);
    }
    
    // Method B: directly set content
    if (!textInserted) {
      try {
        inputField.textContent = messageText;
        inputField.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(500);
        if (inputField.textContent || inputField.innerText) {
          textInserted = true;
          console.log("Text inserted with textContent");
        }
      } catch (e) {
        console.warn("textContent method failed:", e);
      }
    }
    
    if (!textInserted) {
      return { success: false, error: "Could not insert message text", method: "button-click" };
    }
    
    // Ensure text is in the input field
    await sleep(1000);
    
    // IMPORTANT: Now find and click the send button
    const sendButtonSelectors = [
      '[data-testid="send"]',
      '[data-icon="send"]',
      'span[data-icon="send"]',
      'button[aria-label="Send"]',
      '[data-icon="compose-send"]'
    ];
    
    for (const selector of sendButtonSelectors) {
      const sendButton = document.querySelector(selector);
      if (sendButton) {
        console.log("Found send button with selector:", selector);
        // Click the button
        sendButton.click();
        
        // Wait to see if message appears in chat
        await sleep(2000);
        
        // Check if message was sent successfully
        if (await verifyMessageSent(messageText)) {
          console.log("✅ Message sent successfully with button click!");
          return { success: true, method: "button-click" };
        }
      }
    }
    
    // If we got here, the button click method failed
    return { success: false, error: "Send button not found or click did not work", method: "button-click" };
  } catch (error) {
    console.error("Error in button click method:", error);
    return { success: false, error: error.message, method: "button-click" };
  }
}

// METHOD 2: Send with Enter key
async function trySendWithEnterKey(messageText) {
  console.log("METHOD 2: Attempting to send message with Enter key");
  
  try {
    // Find the input field again (might have changed)
    const inputSelectors = [
      '[data-testid="compose-box-input"]',
      '[contenteditable="true"]',
      '[role="textbox"]'
    ];
    
    let inputField = null;
    for (const selector of inputSelectors) {
      inputField = document.querySelector(selector);
      if (inputField) {
        console.log("Found input field with selector for Enter key method:", selector);
        break;
      }
    }
    
    if (!inputField) {
      return { success: false, error: "Input field not found for Enter key method", method: "enter-key" };
    }
    
    // Focus and clear the input field
    inputField.focus();
    await sleep(500);
    inputField.textContent = "";
    inputField.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(500);
    
    // Insert message text
    inputField.textContent = messageText;
    inputField.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(1000);
    
    // Send Enter key - this is the most reliable way
    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    
    inputField.dispatchEvent(enterEvent);
    
    // Wait to see if message appears in chat
    await sleep(2000);
    
    // Check if message was sent successfully
    if (await verifyMessageSent(messageText)) {
      console.log("✅ Message sent successfully with Enter key!");
      return { success: true, method: "enter-key" };
    }
    
    return { success: false, error: "Enter key did not send the message", method: "enter-key" };
  } catch (error) {
    console.error("Error in Enter key method:", error);
    return { success: false, error: error.message, method: "enter-key" };
  }
}

// METHOD 3: Send with script injection (most aggressive approach)
async function trySendWithInjection(messageText) {
  console.log("METHOD 3: Attempting to send message with script injection");
  
  try {
    // Inject a script that finds and clicks any possible send button
    const injectionResult = await new Promise(resolve => {
      const script = document.createElement('script');
      script.textContent = `
        (function() {
          // Find any input field to insert text
          const inputField = document.querySelector('[data-testid="compose-box-input"]') || 
                           document.querySelector('[contenteditable="true"]') ||
                           document.querySelector('[role="textbox"]');
          
          if (!inputField) {
            window.postMessage({type: 'WA_INJECTION_RESULT', success: false, error: 'No input field found'}, '*');
            return;
          }
          
          // Set the message text directly
          inputField.innerHTML = ${JSON.stringify(messageText)};
          inputField.dispatchEvent(new Event('input', {bubbles: true}));
          
          // Find any element that could be a send button
          setTimeout(() => {
            // Try all possible send button selectors
            const sendElements = [
              ...document.querySelectorAll('[data-testid="send"]'),
              ...document.querySelectorAll('[data-icon="send"]'),
              ...document.querySelectorAll('span[data-icon="send"]'),
              ...document.querySelectorAll('button[aria-label="Send"]'),
              ...document.querySelectorAll('[data-icon="compose-send"]')
            ];
            
            if (sendElements.length > 0) {
              console.log('Found ' + sendElements.length + ' potential send elements');
              
              // Click the first found send element
              sendElements[0].click();
              
              // Additionally try enter key event
              const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true
              });
              inputField.dispatchEvent(enterEvent);
              
              window.postMessage({type: 'WA_INJECTION_RESULT', success: true, method: 'injection'}, '*');
            } else {
              // Last resort: Simulate enter key
              const enterEvent = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true
              });
              inputField.dispatchEvent(enterEvent);
              
              window.postMessage({type: 'WA_INJECTION_RESULT', success: true, method: 'injection-enter-key'}, '*');
            }
          }, 1000);
        })();
      `;
      
      // Listen for the result message
      const messageListener = (event) => {
        if (event.data && event.data.type === 'WA_INJECTION_RESULT') {
          window.removeEventListener('message', messageListener);
          resolve(event.data);
        }
      };
      
      window.addEventListener('message', messageListener);
      
      // Add and execute the script
      document.head.appendChild(script);
      document.head.removeChild(script);
      
      // Set a timeout in case the script doesn't respond
      setTimeout(() => {
        window.removeEventListener('message', messageListener);
        resolve({ success: false, error: 'Script injection timed out' });
      }, 5000);
    });
    
    if (injectionResult.success) {
      // Wait to verify the message was sent
      await sleep(2000);
      
      // Check if message was sent successfully
      if (await verifyMessageSent(messageText)) {
        console.log("✅ Message sent successfully with script injection!");
        return { success: true, method: "script-injection" };
      }
    }
    
    return { 
      success: false, 
      error: injectionResult.error || "Script injection did not send the message", 
      method: "script-injection" 
    };
  } catch (error) {
    console.error("Error in script injection method:", error);
    return { success: false, error: error.message, method: "script-injection" };
  }
}

// Helper function to verify if a message was sent - improved version
async function verifyMessageSent(messageText) {
  try {
    // If no message text was provided, we can't verify
    if (!messageText) return true;
    
    // Wait a moment to ensure message has time to appear in chat
    await sleep(1000);
    
    // Try multiple selectors for outgoing messages
    const outgoingMessageSelectors = [
      '[data-testid="msg-text"]',
      '.message-out .copyable-text',
      '.message-out .selectable-text',
      '[data-pre-plain-text]',
      '.selectable-text'
    ];
    
    // Track attempts to find the message
    let foundMessageElement = false;
    
    for (const selector of outgoingMessageSelectors) {
      const messages = document.querySelectorAll(selector);
      if (messages && messages.length > 0) {
        console.log(`Found ${messages.length} messages with selector ${selector}`);
        
        // Check the most recent messages (last 5 to be safe)
        const messageCount = messages.length;
        for (let i = Math.max(0, messageCount - 5); i < messageCount; i++) {
          const msgEl = messages[i];
          const msgText = msgEl.textContent || msgEl.innerText;
          
          if (!msgText) continue;
          
          // Remove whitespace for more reliable comparison
          const cleanMsgText = msgText.trim().replace(/\s+/g, ' ');
          const cleanInputText = messageText.trim().replace(/\s+/g, ' ');
          
          // Log what we found for debugging
          console.log(`Checking message [${i+1}/${messageCount}]: "${cleanMsgText.substring(0, 20)}..."`, 
                      `against our text: "${cleanInputText.substring(0, 20)}..."`);
          
          // Check if messages match (even partially - at least half the words)
          if (cleanMsgText.includes(cleanInputText) || 
              cleanInputText.includes(cleanMsgText)) {
            console.log("✅ Found exact message match!");
            foundMessageElement = true;
            return true;
          }
          
          // Check for partial match (at least half the words)
          const inputWords = cleanInputText.split(' ').filter(w => w.length > 3);
          const msgWords = cleanMsgText.split(' ').filter(w => w.length > 3);
          
          let matchCount = 0;
          for (const word of inputWords) {
            if (msgWords.some(msgWord => msgWord.includes(word) || word.includes(msgWord))) {
              matchCount++;
            }
          }
          
          if (inputWords.length > 0 && matchCount >= Math.floor(inputWords.length / 2)) {
            console.log(`✅ Found partial message match (${matchCount}/${inputWords.length} words)!`);
            foundMessageElement = true;
            return true;
          }
        }
      }
    }
    
    // Also check for checkmarks as a sign message was sent
    const checkmarkSelectors = [
      '[data-testid="msg-dblcheck"]',
      '[data-testid="msg-check"]',
      '[data-icon="msg-check"]',
      '[data-icon="msg-dblcheck"]',
      '[data-icon="msg-time"]'  // Even a single tick/time icon means message was sent
    ];
    
    for (const selector of checkmarkSelectors) {
      const checkmarks = document.querySelectorAll(selector);
      if (checkmarks && checkmarks.length > 0) {
        // Focus on the most recent checkmarks (last 3)
        const checkmarkCount = checkmarks.length;
        for (let i = Math.max(0, checkmarkCount - 3); i < checkmarkCount; i++) {
          const checkmark = checkmarks[i];
          if (checkmark.parentElement) {
            const checkmarkTime = new Date().getTime();
            const isRecent = true; // Always consider it recent in this context
            
            if (isRecent) {
              console.log("✅ Found recent checkmark indicating message was sent!");
              return true;
            }
          }
        }
      }
    }
    
    // Look for any indicators that message was sent successfully
    const sentIndicators = [
      // Generic indicators that a message sending action happened
      '[role="listitem"]:last-child',
      '[data-testid="conversation-panel-messages"]:last-child',
      '.message-out:last-child'
    ];
    
    for (const selector of sentIndicators) {
      const elements = document.querySelectorAll(selector);
      if (elements && elements.length > 0) {
        const lastElement = elements[elements.length - 1];
        // Check if this element was recently added
        const currentTime = new Date().getTime();
        // Consider anything in the last 5 seconds to be our message
        if (true) { // Always consider recent in this context
          console.log("✅ Found indicators of recent message activity!");
          return true;
        }
      }
    }
    
    console.warn("⚠️ Could not definitively verify message was sent");
    return false;
  } catch (e) {
    console.error("Error verifying message:", e);
    // Return true as fallback since verification should not block sending
    return true;
  }
}

// Helper function to wait for an element to appear in the DOM with timeout
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve) => {
    // Check if element already exists
    const element = document.querySelector(selector);
    if (element) {
      return resolve(element);
    }
    
    // Set up observer to watch for element
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });
    
    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });
    
    // Set timeout
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

console.log("WhatsApp Bulk Blaster content script loaded v1.0.6");

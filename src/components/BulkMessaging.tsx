
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { showToast } from "@/lib/toast-utils";
import { Send, Paperclip, FilePlus, FileX, AlertCircle, LogIn } from "lucide-react";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { addMessageListener, handleMessagingResults, validateWhatsAppNumber, ensureWhatsAppWebIsOpen } from '@/lib/messaging-utils';
import { debugLog, debugToast, checkWhatsAppStatus } from '@/lib/debug-utils';

const BulkMessaging: React.FC = () => {
  const [numbers, setNumbers] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [delay, setDelay] = useState<number>(3);
  const [sending, setSending] = useState<boolean>(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<{isOpen: boolean, isLoggedIn: boolean} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check WhatsApp status on component mount
    checkWhatsAppWeb();

    // Set up message listener for bulk message results
    const removeListener = addMessageListener('bulkMessageResults', (results) => {
      setSending(false);
      handleMessagingResults(results);
    });

    // Clean up listener when component unmounts
    return () => {
      if (removeListener) removeListener();
    };
  }, []);

  // Check WhatsApp Web status
  const checkWhatsAppWeb = async () => {
    try {
      const status = await checkWhatsAppStatus();
      setWhatsappStatus(status);
      return status;
    } catch (error) {
      console.error("Error checking WhatsApp status:", error);
      setWhatsappStatus({ isOpen: false, isLoggedIn: false });
      return { isOpen: false, isLoggedIn: false };
    }
  };

  // Open WhatsApp Web
  const openWhatsAppWeb = async () => {
    await ensureWhatsAppWebIsOpen();
    setTimeout(async () => {
      const status = await checkWhatsAppWeb();
      if (status.isOpen) {
        showToast('success', 'WhatsApp Web opened', {
          description: 'Please ensure you are logged in before sending messages'
        });
      }
    }, 3000);
  };

  const validatePhoneNumbers = (): string[] => {
    // Split by commas, new lines, or spaces and remove empty strings
    const numbersArray = numbers
      .split(/[\n,\s]+/)
      .map(num => num.trim())
      .filter(num => num);
    
    // Filter invalid numbers
    const invalidNumbers = numbersArray.filter(num => !validateWhatsAppNumber(num));
    
    if (invalidNumbers.length > 0) {
      showToast("warning", "Some numbers may be invalid", {
        description: `${invalidNumbers.length} numbers don't appear to be valid WhatsApp numbers`
      });
    }
    
    return numbersArray;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const selectedFile = files[0];
    // Check file type and size (10MB limit)
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (!validTypes.includes(selectedFile.type)) {
      showToast("error", "Invalid file type", {
        description: "Please upload an image, PDF, or document file"
      });
      e.target.value = '';
      return;
    }
    
    if (selectedFile.size > maxSize) {
      showToast("error", "File too large", {
        description: "Maximum file size is 10MB"
      });
      e.target.value = '';
      return;
    }
    
    setAttachment(selectedFile);
    showToast("success", "File attached", {
      description: `${selectedFile.name} (${formatFileSize(selectedFile.size)})`
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const removeAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    showToast("info", "Attachment removed");
  };

  const handleSendBulkMessages = async () => {
    const numbersArray = validatePhoneNumbers();
    
    if (numbersArray.length === 0) {
      showToast("error", "No valid numbers found", {
        description: "Please enter at least one valid phone number"
      });
      return;
    }
    
    if (!message.trim() && !attachment) {
      showToast("error", "Message required", {
        description: "Please enter a message or attach a file"
      });
      return;
    }

    // Check if WhatsApp is open and user is logged in
    const status = await checkWhatsAppWeb();
    if (!status.isOpen) {
      showToast("error", "WhatsApp Web is not open", {
        description: "Please open WhatsApp Web in a browser tab",
        duration: 6000,
        action: {
          label: "Open WhatsApp",
          onClick: openWhatsAppWeb
        }
      });
      return;
    }
    
    if (!status.isLoggedIn) {
      showToast("error", "Not logged in to WhatsApp", {
        description: "Please log in to WhatsApp Web",
        duration: 6000,
        action: {
          label: "Open WhatsApp",
          onClick: openWhatsAppWeb
        }
      });
      return;
    }

    setSending(true);
    debugToast("Starting to send bulk messages", { count: numbersArray.length });

    let fileData = null;
    if (attachment) {
      const reader = new FileReader();
      reader.onloadend = () => {
        fileData = {
          name: attachment.name,
          type: attachment.type,
          size: attachment.size,
          data: reader.result
        };

        sendMessages(numbersArray, fileData);
      };
      reader.readAsDataURL(attachment);
    } else {
      sendMessages(numbersArray, null);
    }
  };

  const sendMessages = (numbersArray: string[], fileData: any) => {
    debugLog('info', 'Sending bulk messages', { numbersCount: numbersArray.length, hasAttachment: !!fileData });
    
    if (window.chrome?.runtime?.sendMessage) {
      window.chrome.runtime.sendMessage({
        action: "sendBulkMessages",
        data: {
          numbers: numbersArray,
          message: message.trim(),
          delay: delay,
          attachment: fileData
        }
      });
      
      showToast("info", "Sending messages", {
        description: `Sending to ${numbersArray.length} numbers with ${delay}s delay`
      });
    } else {
      // Dev mode mock
      debugLog('warn', 'Chrome API not available, using mock');
      setTimeout(() => {
        setSending(false);
        showToast("info", "Dev mode", { 
          description: "Chrome APIs not available in development mode" 
        });
      }, 2000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Bulk Message Sender</span>
            {whatsappStatus && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={`ml-2 gap-1 ${whatsappStatus.isLoggedIn ? 'text-green-500' : 'text-amber-500'}`}
                      onClick={openWhatsAppWeb}
                    >
                      <div className={`w-2 h-2 rounded-full ${whatsappStatus.isOpen ? (whatsappStatus.isLoggedIn ? 'bg-green-500' : 'bg-amber-500') : 'bg-red-500'}`} />
                      <span className="text-xs font-normal">
                        {whatsappStatus.isOpen 
                          ? (whatsappStatus.isLoggedIn ? 'WhatsApp Ready' : 'Login Required') 
                          : 'WhatsApp Closed'}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>
                      {whatsappStatus.isOpen 
                        ? (whatsappStatus.isLoggedIn ? 'WhatsApp Web is open and logged in' : 'Please log in to WhatsApp Web') 
                        : 'Click to open WhatsApp Web'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </CardTitle>
          <CardDescription>Send WhatsApp messages to multiple numbers at once</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="numbers">Phone Numbers</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative">
                    <Textarea
                      id="numbers"
                      placeholder="Enter phone numbers (one per line or separated by commas)"
                      value={numbers}
                      onChange={(e) => setNumbers(e.target.value)}
                      className="min-h-[100px] pr-8"
                    />
                    <div className="absolute right-2 top-2 text-muted-foreground">
                      <AlertCircle size={16} />
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Include country code without + or 00 (e.g. 14155552671)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              placeholder="Enter your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
          
          {/* File attachment section */}
          <div className="space-y-2">
            <Label>Attachment (optional)</Label>
            <div className="flex items-center space-x-2">
              <Input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              />
              <Button 
                type="button" 
                variant="outline" 
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="mr-2 h-4 w-4" /> 
                Select File
              </Button>
            </div>
            
            {attachment && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-2 rounded border"
              >
                <div className="flex items-center space-x-2">
                  <FilePlus className="h-4 w-4 text-purple-600" />
                  <div className="text-sm">
                    <p className="font-medium">{attachment.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(attachment.size)}</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0" 
                  onClick={removeAttachment}
                >
                  <FileX className="h-4 w-4" />
                  <span className="sr-only">Remove file</span>
                </Button>
              </motion.div>
            )}
            
            <p className="text-xs text-muted-foreground">
              Supported: Images, PDF, DOC/DOCX (max 10MB)
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Label htmlFor="delay">Delay between messages (seconds):</Label>
            <Input
              id="delay"
              type="number"
              min="1"
              max="30"
              value={delay}
              onChange={(e) => setDelay(parseInt(e.target.value) || 3)}
              className="w-16"
            />
          </div>
        </CardContent>
        <CardFooter>
          {!whatsappStatus?.isOpen ? (
            <Button
              className="w-full bg-purple-700 hover:bg-purple-800"
              onClick={openWhatsAppWeb}
            >
              <LogIn className="mr-2 h-4 w-4" /> Open WhatsApp Web
            </Button>
          ) : (
            <Button
              className="w-full bg-purple-700 hover:bg-purple-800"
              onClick={handleSendBulkMessages}
              disabled={sending || (!numbers.trim() || (!message.trim() && !attachment)) || !whatsappStatus?.isLoggedIn}
            >
              {sending ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" /> Send Bulk Messages
                </>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    </motion.div>
  );
};

export default BulkMessaging;

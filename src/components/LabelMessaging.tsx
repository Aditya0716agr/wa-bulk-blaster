import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Send, Paperclip, FilePlus, FileX } from "lucide-react";
import { ChromeApi } from "@/lib/chrome.d";

// Import type definition for Chrome API
declare global {
  interface Window {
    chrome?: ChromeApi;
  }
}

const LabelMessaging = () => {
  const [message, setMessage] = useState("");
  const [delay, setDelay] = useState(3);
  const [sending, setSending] = useState(false);
  const [labels, setLabels] = useState<{ name: string; chats: any[] }[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load labels from chrome storage
    loadLabels();
  }, []);

  const loadLabels = () => {
    if (window.chrome?.runtime?.sendMessage) {
      window.chrome.runtime.sendMessage({ action: "getBusinessLabels" }, (response) => {
        if (response && response.isBusinessAccount) {
          setLabels(response.labels || []);
        } else {
          toast.error("Business account not detected", {
            description: "Please use a WhatsApp Business account to use labels"
          });
        }
      });
    } else {
      // Mock data for local development
      setLabels([
        { name: "Customer 1", chats: [{ id: "1", name: "John Doe" }] },
        { name: "Customer 2", chats: [{ id: "2", name: "Jane Smith" }] }
      ]);
    }
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const selectedFile = files[0];
      // Check file type and size (10MB limit)
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      const maxSize = 10 * 1024 * 1024; // 10MB
      
      if (!validTypes.includes(selectedFile.type)) {
        toast.error("Invalid file type", {
          description: "Please upload an image, PDF, or document file"
        });
        e.target.value = '';
        return;
      }
      
      if (selectedFile.size > maxSize) {
        toast.error("File too large", {
          description: "Maximum file size is 10MB"
        });
        e.target.value = '';
        return;
      }
      
      setAttachment(selectedFile);
      toast.success("File attached", {
        description: `${selectedFile.name} (${formatFileSize(selectedFile.size)})`
      });
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Handle attachment removal
  const removeAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    toast.info("Attachment removed");
  };

  const handleSendLabelMessages = () => {
    if (!selectedLabel) {
      toast.error("Please select a label");
      return;
    }

    if (!message.trim() && !attachment) {
      toast.error("Please enter a message or attach a file", {
        description: "You must provide at least message text or a file attachment"
      });
      return;
    }

    setSending(true);

    // Find the selected label
    const label = labels.find(label => label.name === selectedLabel);

    if (!label) {
      toast.error("Selected label not found");
      setSending(false);
      return;
    }

    // Prepare file for sending if attached
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

        // Send message to background script
        if (window.chrome?.runtime?.sendMessage) {
          window.chrome.runtime.sendMessage({
            action: "sendLabelMessages",
            data: {
              label: label,
              message: message.trim(),
              delay: delay,
              attachment: fileData
            }
          });
        }

        toast.success("Label messages sending initiated", {
          description: `Sending to chats with label "${label.name}" with ${delay}s delay`
        });

        // Mock for local development
        if (!window.chrome?.runtime?.sendMessage) {
          setTimeout(() => {
            setSending(false);
          }, 2000);
        }
      };
      reader.readAsDataURL(attachment);
    } else {
      // No attachment, just send message
      if (window.chrome?.runtime?.sendMessage) {
        window.chrome.runtime.sendMessage({
          action: "sendLabelMessages",
          data: {
            label: label,
            message: message.trim(),
            delay: delay,
            attachment: null
          }
        });
      }

      toast.success("Label messages sending initiated", {
        description: `Sending to chats with label "${label.name}" with ${delay}s delay`
      });

      // Mock for local development
      if (!window.chrome?.runtime?.sendMessage) {
        setTimeout(() => {
          setSending(false);
        }, 2000);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send to Label</CardTitle>
        <CardDescription>
          Send messages to all chats with a specific label
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="label">Select Label</Label>
          <select
            id="label"
            className="w-full border rounded px-3 py-2"
            value={selectedLabel || ""}
            onChange={(e) => setSelectedLabel(e.target.value)}
          >
            <option value="" disabled>Select a label</option>
            {labels.map((label) => (
              <option key={label.name} value={label.name}>{label.name}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="message">Message</Label>
          <Textarea
            id="message"
            placeholder="Enter your message here..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-[80px]"
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
            <div className="flex items-center justify-between p-2 rounded border">
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
            </div>
          )}
          
          <p className="text-xs text-muted-foreground">
            Supported: Images, PDF, DOC/DOCX (max 10MB)
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Label htmlFor="delay">Delay (seconds):</Label>
          <Input
            id="delay"
            type="number"
            min="1"
            max="30"
            value={delay}
            onChange={(e) => setDelay(parseInt(e.target.value))}
            className="w-16"
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full bg-purple-700 hover:bg-purple-800"
          onClick={handleSendLabelMessages}
          disabled={sending || !selectedLabel || (!message.trim() && !attachment)}
        >
          <Send className="mr-2 h-4 w-4" /> Send to Label
        </Button>
      </CardFooter>
    </Card>
  );
};

export default LabelMessaging;

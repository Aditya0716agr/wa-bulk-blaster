import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Send, Paperclip, FilePlus, FileX } from "lucide-react";
import { ChromeApi } from "@/lib/chrome.d";

// Import type definition for Chrome API
declare global {
  interface Window {
    chrome?: ChromeApi;
  }
}

const GroupMessaging = () => {
  const [groups, setGroups] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [delay, setDelay] = useState(3);
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = () => {
    if (window.chrome?.runtime?.sendMessage) {
      window.chrome.runtime.sendMessage({ action: "getGroups" }, (response) => {
        setGroups(response || []);
      });
    } else {
      // Mock data for local development
      setGroups([
        { id: "group1", name: "Test Group 1" },
        { id: "group2", name: "Test Group 2" }
      ]);
    }
  };

  const handleGroupSelect = (groupId) => {
    setSelectedGroups(prev => {
      if (prev.includes(groupId)) {
        return prev.filter(id => id !== groupId);
      } else {
        return [...prev, groupId];
      }
    });
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const selectedFile = files[0];
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

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const removeAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    toast.info("Attachment removed");
  };

  const handleSendGroupMessages = () => {
    if (!message.trim() && !attachment) {
      toast.error("Please enter a message or attach a file", {
        description: "You must provide at least message text or a file attachment"
      });
      return;
    }
    
    if (selectedGroups.length === 0) {
      toast.error("Please select at least one group", {
        description: "You must select one or more groups to send messages to"
      });
      return;
    }

    setSending(true);

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

        const selectedGroupObjects = groups.filter(group => selectedGroups.includes(group.id));

        if (window.chrome?.runtime?.sendMessage) {
          window.chrome.runtime.sendMessage({
            action: "sendGroupMessages",
            data: {
              groups: selectedGroupObjects,
              message: message.trim(),
              delay: delay,
              attachment: fileData
            }
          });
        }

        toast.success("Group messages sending initiated", {
          description: `Sending to ${selectedGroups.length} groups with ${delay}s delay`
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
      const selectedGroupObjects = groups.filter(group => selectedGroups.includes(group.id));

      if (window.chrome?.runtime?.sendMessage) {
        window.chrome.runtime.sendMessage({
          action: "sendGroupMessages",
          data: {
            groups: selectedGroupObjects,
            message: message.trim(),
            delay: delay,
            attachment: null
          }
        });
      }

      toast.success("Group messages sending initiated", {
        description: `Sending to ${selectedGroups.length} groups with ${delay}s delay`
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
        <CardTitle>Send Group Messages</CardTitle>
        <CardDescription>Send messages to selected WhatsApp groups</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Select Groups</Label>
          <div className="flex flex-col space-y-1 max-h-40 overflow-y-auto border rounded p-2">
            {groups.map(group => (
              <div key={group.id} className="flex items-center space-x-2">
                <Checkbox
                  id={group.id}
                  checked={selectedGroups.includes(group.id)}
                  onCheckedChange={() => handleGroupSelect(group.id)}
                />
                <Label htmlFor={group.id} className="font-normal">
                  {group.name}
                </Label>
              </div>
            ))}
          </div>
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
          onClick={handleSendGroupMessages}
          disabled={sending || (!message.trim() && !attachment) || selectedGroups.length === 0}
        >
          <Send className="mr-2 h-4 w-4" /> Send Group Messages
        </Button>
      </CardFooter>
    </Card>
  );
};

export default GroupMessaging;

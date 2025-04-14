
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Send, Clock, Users, Paperclip, FilePlus, FileX } from "lucide-react";

// Define Chrome types for TypeScript
interface ChromeRuntimeMessage {
  action: string;
  results?: Array<{name: string, status: string}>;
  [key: string]: any;
}

interface ChromeRuntime {
  sendMessage: (message: any, callback?: (response: any) => void) => void;
  onMessage?: {
    addListener: (callback: (message: ChromeRuntimeMessage, sender: any, sendResponse: any) => void) => void;
    removeListener: (callback: (message: ChromeRuntimeMessage, sender: any, sendResponse: any) => void) => void;
  };
}

interface ChromeApi {
  runtime?: ChromeRuntime;
}

declare global {
  interface Window {
    chrome?: ChromeApi;
  }
}

interface Group {
  id: string;
  name: string;
}

const GroupMessaging = () => {
  const [message, setMessage] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [delay, setDelay] = useState(3);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState<Array<{name: string, status: string}>>([]);
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Load groups on component mount
  useEffect(() => {
    fetchGroups();
    
    // Listen for results from background script
    const messageListener = (message: ChromeRuntimeMessage) => {
      if (message.action === "groupMessageResults") {
        setLogs(message.results || []);
        setSending(false);
      }
    };
    
    if (window.chrome?.runtime?.onMessage) {
      window.chrome.runtime.onMessage.addListener(messageListener);
      
      // Cleanup listener on unmount
      return () => {
        if (window.chrome?.runtime?.onMessage) {
          window.chrome.runtime.onMessage.removeListener(messageListener);
        }
      };
    }
  }, []);

  // Fetch groups from WhatsApp Web
  const fetchGroups = () => {
    setLoading(true);
    
    if (window.chrome?.runtime?.sendMessage) {
      window.chrome.runtime.sendMessage(
        { action: "getGroups" },
        (response) => {
          if (response && Array.isArray(response)) {
            setGroups(response);
          } else {
            setGroups([]);
            toast.error("Failed to load groups", {
              description: "Make sure WhatsApp Web is open"
            });
          }
          setLoading(false);
        }
      );
    } else {
      // For local development, mock groups
      setTimeout(() => {
        const mockGroups = [
          { id: "g1", name: "Family Group" },
          { id: "g2", name: "Work Team" },
          { id: "g3", name: "Friends Chat" },
          { id: "g4", name: "Community Group" },
        ];
        setGroups(mockGroups);
        setLoading(false);
      }, 1000);
    }
  };

  // Handle group selection
  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroups(prev => {
      if (prev.includes(groupId)) {
        return prev.filter(id => id !== groupId);
      } else {
        return [...prev, groupId];
      }
    });
  };

  // Handle select all groups
  const toggleSelectAll = () => {
    if (selectedGroups.length === groups.length) {
      setSelectedGroups([]);
    } else {
      setSelectedGroups(groups.map(group => group.id));
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

  // Handle attachment removal
  const removeAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    toast.info("Attachment removed");
  };

  // Send messages to selected groups
  const handleSendGroupMessages = () => {
    if ((!message.trim() && !attachment) || selectedGroups.length === 0) {
      toast.error("Missing information", {
        description: "Please select at least one group and enter a message or attach a file"
      });
      return;
    }

    setSending(true);
    setLogs([]);

    // Filter selected groups
    const groupsToMessage = groups.filter(group => selectedGroups.includes(group.id));

    // Prepare file for sending if attached
    if (attachment) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const fileData = {
          name: attachment.name,
          type: attachment.type,
          size: attachment.size,
          data: reader.result
        };

        // Send message to background script
        if (window.chrome?.runtime?.sendMessage) {
          window.chrome.runtime.sendMessage({
            action: "sendGroupMessages",
            data: {
              groups: groupsToMessage,
              message: message.trim(),
              delay: delay,
              attachment: fileData
            }
          });
        }

        toast.success("Group messages sending initiated", {
          description: `Sending to ${groupsToMessage.length} groups with ${delay}s delay`
        });

        // Mock for local development
        if (!window.chrome?.runtime?.sendMessage) {
          setTimeout(() => {
            const mockResults = groupsToMessage.map(group => ({
              name: group.name,
              status: Math.random() > 0.2 ? 'success' : 'failed'
            }));
            setLogs(mockResults);
            setSending(false);
          }, 2000);
        }
      };
      reader.readAsDataURL(attachment);
    } else {
      // No attachment, just send message
      if (window.chrome?.runtime?.sendMessage) {
        window.chrome.runtime.sendMessage({
          action: "sendGroupMessages",
          data: {
            groups: groupsToMessage,
            message: message.trim(),
            delay: delay,
            attachment: null
          }
        });
      }

      toast.success("Group messages sending initiated", {
        description: `Sending to ${groupsToMessage.length} groups with ${delay}s delay`
      });

      // Mock for local development
      if (!window.chrome?.runtime?.sendMessage) {
        setTimeout(() => {
          const mockResults = groupsToMessage.map(group => ({
            name: group.name,
            status: Math.random() > 0.2 ? 'success' : 'failed'
          }));
          setLogs(mockResults);
          setSending(false);
        }, 2000);
      }
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Group Messaging</CardTitle>
          <CardDescription>
            Send the same message to multiple WhatsApp groups
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="group-message">Message</Label>
            <Textarea 
              id="group-message" 
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
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Select Groups</Label>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={fetchGroups}
                disabled={loading}
              >
                Refresh
              </Button>
            </div>
            
            {loading ? (
              <div className="flex justify-center p-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-700"></div>
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                <Users className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                <p>No groups found</p>
                <p className="mt-1 text-xs">Make sure WhatsApp Web is open</p>
              </div>
            ) : (
              <>
                <div className="flex items-center space-x-2 mb-2">
                  <Checkbox
                    id="select-all"
                    checked={selectedGroups.length === groups.length}
                    onCheckedChange={toggleSelectAll}
                  />
                  <Label htmlFor="select-all" className="text-sm">Select All ({groups.length})</Label>
                </div>
                
                <div className="max-h-[200px] overflow-y-auto border rounded-md p-1">
                  {groups.map((group) => (
                    <div key={group.id} className="flex items-center space-x-2 p-2 hover:bg-slate-50 rounded">
                      <Checkbox
                        id={`group-${group.id}`}
                        checked={selectedGroups.includes(group.id)}
                        onCheckedChange={() => toggleGroupSelection(group.id)}
                      />
                      <Label htmlFor={`group-${group.id}`} className="flex-1 cursor-pointer">
                        {group.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Label htmlFor="group-delay">Delay (seconds):</Label>
            <Input 
              id="group-delay" 
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
            <Send className="mr-2 h-4 w-4" /> Send to {selectedGroups.length} Groups
          </Button>
        </CardFooter>
      </Card>
      
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Send Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[150px] overflow-y-auto text-sm">
              {logs.map((log, index) => (
                <div key={index} className={`mb-1 p-1 rounded flex justify-between ${log.status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  <span>{log.name}</span>
                  <span className="font-semibold">{log.status}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GroupMessaging;

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Send, Clock, Tag, Paperclip, FilePlus, FileX, MessageSquare } from "lucide-react";

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

interface Chat {
  id: string;
  name: string;
}

interface BusinessLabel {
  name: string;
  chats: Chat[];
}

const LabelMessaging = () => {
  const [message, setMessage] = useState("");
  const [labels, setLabels] = useState<BusinessLabel[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [delay, setDelay] = useState(3);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState<Array<{name: string, status: string}>>([]);
  const [isBusinessAccount, setIsBusinessAccount] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  useEffect(() => {
    fetchLabels();
    
    const messageListener = (message: ChromeRuntimeMessage) => {
      if (message.action === "labelMessageResults") {
        setLogs(message.results || []);
        setSending(false);
      }
    };
    
    if (window.chrome?.runtime?.onMessage) {
      window.chrome.runtime.onMessage.addListener(messageListener);
      
      return () => {
        if (window.chrome?.runtime?.onMessage) {
          window.chrome.runtime.onMessage.removeListener(messageListener);
        }
      };
    }
  }, []);

  const fetchLabels = () => {
    setLoading(true);
    
    if (window.chrome?.runtime?.sendMessage) {
      window.chrome.runtime.sendMessage(
        { action: "getBusinessLabels" },
        (response) => {
          if (response) {
            setIsBusinessAccount(response.isBusinessAccount);
            if (response.isBusinessAccount && Array.isArray(response.labels)) {
              setLabels(response.labels);
            } else {
              setLabels([]);
            }
          } else {
            setIsBusinessAccount(false);
            setLabels([]);
            toast.error("Failed to load labels", {
              description: "Make sure WhatsApp Web is open"
            });
          }
          setLoading(false);
        }
      );
    } else {
      setTimeout(() => {
        const mockLabels = [
          { 
            name: "Leads", 
            chats: [
              { id: "c1", name: "John Smith" },
              { id: "c2", name: "Alice Johnson" }
            ] 
          },
          { 
            name: "Customers", 
            chats: [
              { id: "c3", name: "Bob Miller" },
              { id: "c4", name: "Eve Williams" },
              { id: "c5", name: "Carlos Rodriguez" }
            ] 
          },
          { 
            name: "Suppliers", 
            chats: [
              { id: "c6", name: "ABC Company" }
            ] 
          }
        ];
        setIsBusinessAccount(true);
        setLabels(mockLabels);
        setLoading(false);
      }, 1000);
    }
  };

  const handleLabelChange = (value: string) => {
    setSelectedLabel(value);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const removeAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    toast.info("Attachment removed");
  };

  const handleSendLabelMessages = () => {
    if ((!message.trim() && !attachment) || !selectedLabel) {
      toast.error("Missing information", {
        description: "Please select a label and enter a message or attach a file"
      });
      return;
    }

    const label = labels.find(l => l.name === selectedLabel);
    if (!label || label.chats.length === 0) {
      toast.error("No contacts with this label", {
        description: "Please select a different label"
      });
      return;
    }

    setSending(true);
    setLogs([]);

    if (attachment) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const fileData = {
          name: attachment.name,
          type: attachment.type,
          size: attachment.size,
          data: reader.result
        };

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
          description: `Sending to ${label.chats.length} contacts with ${delay}s delay`
        });

        if (!window.chrome?.runtime?.sendMessage) {
          setTimeout(() => {
            const mockResults = label.chats.map(chat => ({
              name: chat.name,
              status: Math.random() > 0.2 ? 'success' : 'failed'
            }));
            setLogs(mockResults);
            setSending(false);
          }, 2000);
        }
      };
      reader.readAsDataURL(attachment);
    } else {
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
        description: `Sending to ${label.chats.length} contacts with ${delay}s delay`
      });

      if (!window.chrome?.runtime?.sendMessage) {
        setTimeout(() => {
          const mockResults = label.chats.map(chat => ({
            name: chat.name,
            status: Math.random() > 0.2 ? 'success' : 'failed'
          }));
          setLogs(mockResults);
          setSending(false);
        }, 2000);
      }
    }
  };

  const getSelectedLabelDetails = () => {
    if (!selectedLabel) return null;
    return labels.find(l => l.name === selectedLabel);
  };

  const selectedLabelDetails = getSelectedLabelDetails();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Label-Based Messaging</CardTitle>
          <CardDescription>
            Send messages to contacts with specific WhatsApp Business labels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isBusinessAccount && !loading ? (
            <div className="text-center py-4 text-sm">
              <Tag className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-muted-foreground">This feature requires WhatsApp Business</p>
              <p className="mt-1 text-xs text-muted-foreground">Regular WhatsApp accounts don't support labels</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="label-select">Select Label</Label>
                
                {loading ? (
                  <div className="flex justify-center p-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-700"></div>
                  </div>
                ) : labels.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    <Tag className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
                    <p>No labels found</p>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={fetchLabels}
                      className="mt-2"
                    >
                      Refresh Labels
                    </Button>
                  </div>
                ) : (
                  <>
                    <Select value={selectedLabel || ''} onValueChange={handleLabelChange}>
                      <SelectTrigger id="label-select">
                        <SelectValue placeholder="Select a label" />
                      </SelectTrigger>
                      <SelectContent>
                        {labels.map((label) => (
                          <SelectItem key={label.name} value={label.name}>
                            {label.name} ({label.chats.length})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {selectedLabelDetails && (
                      <div className="mt-2 text-sm">
                        <p className="font-medium flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" /> 
                          {selectedLabelDetails.chats.length} contacts
                        </p>
                        <div className="max-h-[100px] overflow-y-auto mt-1 text-xs text-muted-foreground border rounded-md p-1">
                          {selectedLabelDetails.chats.map((chat) => (
                            <div key={chat.id} className="p-1">
                              {chat.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="label-message">Message</Label>
                <Textarea 
                  id="label-message" 
                  placeholder="Enter your message here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
              
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
                <Label htmlFor="label-delay">Delay (seconds):</Label>
                <Input 
                  id="label-delay" 
                  type="number" 
                  min="1"
                  max="30"
                  value={delay}
                  onChange={(e) => setDelay(parseInt(e.target.value))}
                  className="w-16"
                />
              </div>
            </>
          )}
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full bg-purple-700 hover:bg-purple-800"
            onClick={handleSendLabelMessages}
            disabled={sending || (!message.trim() && !attachment) || !selectedLabel || !isBusinessAccount}
          >
            <Send className="mr-2 h-4 w-4" /> 
            {selectedLabelDetails ? `Send to ${selectedLabelDetails.chats.length} Contacts` : "Send Messages"}
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

export default LabelMessaging;

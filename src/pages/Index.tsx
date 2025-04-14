
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Send, Download, Clock, MessageSquare } from "lucide-react";

// Type definitions for Chrome extension API
declare global {
  interface Window {
    chrome?: {
      runtime: {
        sendMessage: (message: any) => void;
      };
    };
  }
}

const Index = () => {
  const [message, setMessage] = useState("");
  const [numbers, setNumbers] = useState("");
  const [delay, setDelay] = useState(3);
  const [autoReply, setAutoReply] = useState(false);
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState<Array<{number: string, status: string}>>([]);

  // Handle sending bulk messages
  const handleSendBulkMessages = () => {
    if (!message.trim()) {
      toast.error("Please enter a message", {
        description: "The message cannot be empty"
      });
      return;
    }

    if (!numbers.trim()) {
      toast.error("Please enter at least one phone number", {
        description: "No phone numbers provided"
      });
      return;
    }

    // Parse numbers
    const numberList = numbers.split("\n").filter(n => n.trim());
    
    setSending(true);
    setLogs([]);

    // Send message to background script
    if (window.chrome?.runtime?.sendMessage) {
      window.chrome.runtime.sendMessage({
        action: "sendBulkMessages",
        data: {
          numbers: numberList,
          message: message,
          delay: delay
        }
      });
    }

    toast.success("Bulk messages sending initiated", {
      description: `Sending to ${numberList.length} recipients with ${delay}s delay`
    });

    // Mock for local development
    if (!window.chrome?.runtime?.sendMessage) {
      setTimeout(() => {
        const mockResults = numberList.map(number => ({
          number,
          status: Math.random() > 0.2 ? 'success' : 'failed'
        }));
        setLogs(mockResults);
        setSending(false);
      }, 2000);
    }
  };

  // Handle toggling auto-reply
  const handleToggleAutoReply = (enabled: boolean) => {
    setAutoReply(enabled);
    
    // Send message to background script
    if (window.chrome?.runtime?.sendMessage) {
      window.chrome.runtime.sendMessage({
        action: "toggleAutoReply",
        data: {
          enabled: enabled
        }
      });
    }

    if (enabled) {
      toast.success("Auto-reply enabled", {
        description: "The extension will automatically reply to incoming messages"
      });
    } else {
      toast.info("Auto-reply disabled", {
        description: "Auto-replies are now turned off"
      });
    }
  };

  // Handle exporting contacts
  const handleExportContacts = () => {
    // Send message to background script
    if (window.chrome?.runtime?.sendMessage) {
      window.chrome.runtime.sendMessage({
        action: "exportContacts"
      });
    }

    toast.info("Exporting contacts", {
      description: "Please wait while we collect your WhatsApp contacts"
    });
  };

  return (
    <div className="min-h-[500px] min-w-[350px] p-4 bg-gradient-to-br from-purple-50 to-white">
      <div className="mb-4 flex items-center justify-center space-x-2">
        <img src="/icon48.png" alt="WhatsApp Bulk Blaster" className="w-8 h-8" />
        <h1 className="text-xl font-bold text-purple-800">WhatsApp Bulk Blaster</h1>
      </div>

      <Tabs defaultValue="bulk-message" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="bulk-message">Bulk Message</TabsTrigger>
          <TabsTrigger value="auto-reply">Auto Reply</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>
        
        {/* Bulk Message Tab */}
        <TabsContent value="bulk-message" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Send Bulk Messages</CardTitle>
              <CardDescription>
                Send the same message to multiple WhatsApp contacts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
              <div className="space-y-2">
                <Label htmlFor="numbers">Phone Numbers</Label>
                <Textarea 
                  id="numbers" 
                  placeholder="Enter phone numbers (one per line)..."
                  value={numbers}
                  onChange={(e) => setNumbers(e.target.value)}
                  className="min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground">
                  Format: Full number with country code, no + or spaces
                  <br />
                  Example: 14155552671
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
                onClick={handleSendBulkMessages}
                disabled={sending || !message.trim() || !numbers.trim()}
              >
                <Send className="mr-2 h-4 w-4" /> Send Bulk Messages
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
                      <span>{log.number}</span>
                      <span className="font-semibold">{log.status}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        {/* Auto Reply Tab */}
        <TabsContent value="auto-reply">
          <Card>
            <CardHeader>
              <CardTitle>Auto Reply Bot</CardTitle>
              <CardDescription>
                Automatically reply to incoming messages
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="auto-reply">Auto Reply Bot</Label>
                <Switch
                  id="auto-reply"
                  checked={autoReply}
                  onCheckedChange={handleToggleAutoReply}
                />
              </div>
              
              <div className="rounded-lg border p-4 text-sm space-y-4">
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="font-medium">Default Auto-Reply Message</p>
                    <p className="text-muted-foreground">
                      "Auto-reply: I received your message. I'll get back to you soon."
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <Clock className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="font-medium">Reply Delay</p>
                    <p className="text-muted-foreground">
                      1.5 seconds after receiving a message
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Note: WhatsApp Web must be open in a browser tab for this feature to work
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Export Tab */}
        <TabsContent value="export">
          <Card>
            <CardHeader>
              <CardTitle>Export Contacts</CardTitle>
              <CardDescription>
                Export your WhatsApp contacts to CSV
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">
                Export all your WhatsApp contacts to a CSV file for easy import into other applications.
              </p>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full bg-purple-700 hover:bg-purple-800"
                onClick={handleExportContacts}
              >
                <Download className="mr-2 h-4 w-4" /> Export Contacts
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
      
      <footer className="mt-4 text-center text-xs text-muted-foreground">
        WhatsApp Bulk Blaster &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
};

export default Index;

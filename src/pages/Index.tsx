import { useState, useRef, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Send, Download, Clock, MessageSquare, Paperclip, FilePlus, FileX, AlertCircle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import GroupMessaging from "@/components/GroupMessaging";
import WelcomeSettings from "@/components/WelcomeSettings";
import LabelMessaging from "@/components/LabelMessaging";
import { ChromeApi } from "@/lib/chrome.d";
import { motion } from "framer-motion";
import { fadeIn, slideIn, MotionDiv, MotionCard, MotionButton } from "@/components/ui/motion";

declare global {
  interface Window {
    chrome?: ChromeApi;
  }
}

type NumberStatus = 'valid' | 'invalid' | 'duplicate' | 'unchecked';

interface PhoneNumber {
  value: string;
  status: NumberStatus;
}

const Index = () => {
  const [message, setMessage] = useState("");
  const [numbers, setNumbers] = useState("");
  const [delay, setDelay] = useState(3);
  const [autoReply, setAutoReply] = useState(false);
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState<Array<{number: string, status: string}>>([]);
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validatedNumbers, setValidatedNumbers] = useState<PhoneNumber[]>([]);
  const [summary, setSummary] = useState({ valid: 0, invalid: 0, duplicate: 0 });
  const [activeTab, setActiveTab] = useState("bulk-message");

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

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const removeAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    toast.info("Attachment removed");
  };

  const validateNumbers = useCallback(() => {
    if (!numbers.trim()) return false;

    const numberList = numbers.split("\n")
      .map(n => n.trim())
      .filter(n => n);
    
    const uniqueNumbers = new Set<string>();
    const phoneNumberRegex = /^\d{10,15}$/;
    const validated: PhoneNumber[] = [];
    let validCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;

    numberList.forEach(number => {
      const cleanNumber = number.replace(/[\s\-\(\)]+/g, '');
      
      if (uniqueNumbers.has(cleanNumber)) {
        validated.push({
          value: number,
          status: 'duplicate'
        });
        duplicateCount++;
        return;
      }
      
      if (phoneNumberRegex.test(cleanNumber)) {
        uniqueNumbers.add(cleanNumber);
        validated.push({
          value: cleanNumber,
          status: 'valid'
        });
        validCount++;
      } else {
        validated.push({
          value: number,
          status: 'invalid'
        });
        invalidCount++;
      }
    });

    setValidatedNumbers(validated);
    setSummary({ 
      valid: validCount, 
      invalid: invalidCount, 
      duplicate: duplicateCount 
    });

    return validCount > 0;
  }, [numbers]);

  const handleSendBulkMessages = () => {
    if (!message.trim() && !attachment) {
      toast.error("Please enter a message or attach a file", {
        description: "You must provide at least message text or a file attachment"
      });
      return;
    }

    const isValid = validateNumbers();
    if (!isValid) {
      toast.error("No valid phone numbers found", {
        description: "Please check the phone numbers and try again"
      });
      return;
    }

    setSending(true);
    setLogs([]);

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

        const validNumbersToSend = validatedNumbers
          .filter(item => item.status === 'valid')
          .map(item => item.value);

        if (window.chrome?.runtime?.sendMessage) {
          console.log("Sending bulk messages request to extension");
          window.chrome.runtime.sendMessage({
            action: "sendBulkMessages",
            data: {
              numbers: validNumbersToSend,
              message: message.trim(),
              delay: delay,
              attachment: fileData
            }
          });
          
          const messageListener = (response: any) => {
            if (response.action === "bulkMessageResults") {
              console.log("Received bulk message results:", response.results);
              setLogs(response.results);
              setSending(false);
              
              const successCount = response.results.filter((r: any) => r.status === 'success').length;
              const failCount = response.results.filter((r: any) => r.status !== 'success').length;
              
              if (successCount > 0) {
                toast.success(`Sent ${successCount} messages successfully`, {
                  description: failCount > 0 ? `${failCount} messages failed to send` : undefined
                });
              } else {
                toast.error(`Failed to send any messages`, {
                  description: "Please check the console for more details"
                });
              }
              
              if (window.chrome?.runtime?.onMessage?.removeListener) {
                window.chrome.runtime.onMessage.removeListener(messageListener);
              }
            }
          };
          
          if (window.chrome?.runtime?.onMessage?.addListener) {
            window.chrome.runtime.onMessage.addListener(messageListener);
          }
        }

        toast.success("Bulk messages sending initiated", {
          description: `Sending to ${validNumbersToSend.length} recipients with ${delay}s delay`
        });

        if (!window.chrome?.runtime?.sendMessage) {
          setTimeout(() => {
            const mockResults = validNumbersToSend.map(number => ({
              number,
              status: Math.random() > 0.2 ? 'success' : 'failed'
            }));
            setLogs(mockResults);
            setSending(false);
          }, 2000);
        }
      };
      reader.readAsDataURL(attachment);
    } else {
      const validNumbersToSend = validatedNumbers
        .filter(item => item.status === 'valid')
        .map(item => item.value);

      if (window.chrome?.runtime?.sendMessage) {
        console.log("Sending bulk messages request to extension (no attachment)");
        window.chrome.runtime.sendMessage({
          action: "sendBulkMessages",
          data: {
            numbers: validNumbersToSend,
            message: message.trim(),
            delay: delay,
            attachment: null
          }
        });
        
        const messageListener = (response: any) => {
          if (response.action === "bulkMessageResults") {
            console.log("Received bulk message results:", response.results);
            setLogs(response.results);
            setSending(false);
            
            const successCount = response.results.filter((r: any) => r.status === 'success').length;
            const failCount = response.results.filter((r: any) => r.status !== 'success').length;
            
            if (successCount > 0) {
              toast.success(`Sent ${successCount} messages successfully`, {
                description: failCount > 0 ? `${failCount} messages failed to send` : undefined
              });
            } else {
              toast.error(`Failed to send any messages`, {
                description: "Please check the console for more details"
              });
            }
            
            if (window.chrome?.runtime?.onMessage?.removeListener) {
              window.chrome.runtime.onMessage.removeListener(messageListener);
            }
          }
        };
        
        if (window.chrome?.runtime?.onMessage?.addListener) {
          window.chrome.runtime.onMessage.addListener(messageListener);
        }
      }

      toast.success("Bulk messages sending initiated", {
        description: `Sending to ${validNumbersToSend.length} recipients with ${delay}s delay`
      });

      if (!window.chrome?.runtime?.sendMessage) {
        setTimeout(() => {
          const mockResults = validNumbersToSend.map(number => ({
            number,
            status: Math.random() > 0.2 ? 'success' : 'failed'
          }));
          setLogs(mockResults);
          setSending(false);
        }, 2000);
      }
    }
  };

  const handleToggleAutoReply = (enabled: boolean) => {
    setAutoReply(enabled);
    
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

  const handleExportContacts = () => {
    if (window.chrome?.runtime?.sendMessage) {
      window.chrome.runtime.sendMessage({
        action: "exportContacts"
      });
    }

    toast.info("Exporting contacts", {
      description: "Please wait while we collect your WhatsApp contacts"
    });
  };

  const handleNumbersChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNumbers(e.target.value);
    setValidatedNumbers([]);
    setSummary({ valid: 0, invalid: 0, duplicate: 0 });
  };

  const getNumberStyle = (status: NumberStatus) => {
    switch(status) {
      case 'valid':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'invalid':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'duplicate':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      default:
        return '';
    }
  };

  return (
    <MotionDiv
      className="min-h-[500px] min-w-[350px] p-4 bg-gradient-to-br from-purple-50 to-white"
      initial="initial"
      animate="animate"
      variants={fadeIn}
    >
      <motion.div 
        className="mb-4 flex items-center justify-center space-x-2"
        variants={slideIn}
      >
        <motion.img 
          src="/icon48.png" 
          alt="WhatsApp Bulk Blaster" 
          className="w-8 h-8"
          whileHover={{ scale: 1.1, rotate: 10 }}
          whileTap={{ scale: 0.9 }}
        />
        <motion.h1 
          className="text-xl font-bold bg-gradient-to-r from-purple-600 to-purple-800 bg-clip-text text-transparent"
          whileHover={{ scale: 1.05 }}
        >
          WhatsApp Bulk Blaster
        </motion.h1>
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6 mb-4 bg-purple-50">
          {["bulk-message", "group-message", "label-message", "auto-reply", "welcome", "export"].map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="data-[state=active]:bg-purple-600 data-[state=active]:text-white"
            >
              {tab.split('-')[0].charAt(0).toUpperCase() + tab.split('-')[0].slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>
        
        <TabsContent value="bulk-message" className="space-y-4">
          <MotionCard variants={fadeIn}>
            <CardHeader>
              <CardTitle className="text-purple-800">Send Bulk Messages</CardTitle>
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
              
              <div className="space-y-2">
                <Label htmlFor="numbers">Phone Numbers</Label>
                <Textarea 
                  id="numbers" 
                  placeholder="Enter phone numbers (one per line)..."
                  value={numbers}
                  onChange={handleNumbersChange}
                  className="min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground">
                  Format: Full number with country code, no + or spaces
                  <br />
                  Example: 14155552671
                </p>
                
                {validatedNumbers.length > 0 && (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        <CheckCircle className="mr-1 h-3 w-3" /> {summary.valid} Valid
                      </Badge>
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                        <AlertCircle className="mr-1 h-3 w-3" /> {summary.invalid} Invalid
                      </Badge>
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                        <AlertCircle className="mr-1 h-3 w-3" /> {summary.duplicate} Duplicate
                      </Badge>
                    </div>
                    
                    <div className="max-h-[100px] overflow-y-auto border rounded p-1">
                      {validatedNumbers.map((num, index) => (
                        <div key={index} className={`mb-1 p-1 rounded border ${getNumberStyle(num.status)}`}>
                          {num.value}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
              
              <Button 
                className="w-full"
                variant="outline"
                onClick={validateNumbers}
                disabled={!numbers.trim()}
              >
                Validate Numbers
              </Button>
            </CardContent>
            <CardFooter>
              <MotionButton
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                onClick={handleSendBulkMessages}
                disabled={sending || (!message.trim() && !attachment) || !numbers.trim()}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Send className="mr-2 h-4 w-4" /> Send Bulk Messages
              </MotionButton>
            </CardFooter>
          </MotionCard>
          
          {logs.length > 0 && (
            <MotionCard variants={fadeIn}>
              <CardHeader>
                <CardTitle>Send Results</CardTitle>
              </CardHeader>
              <CardContent>
                <motion.div 
                  className="max-h-[150px] overflow-y-auto text-sm space-y-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ staggerChildren: 0.1 }}
                >
                  {logs.map((log, index) => (
                    <motion.div
                      key={index}
                      className={`mb-1 p-2 rounded-lg flex justify-between items-center ${
                        log.status === 'success' 
                          ? 'bg-green-50 text-green-700 border border-green-200' 
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <span>{log.number}</span>
                      <span className="font-semibold flex items-center">
                        {log.status === 'success' ? (
                          <CheckCircle className="w-4 h-4 mr-1" />
                        ) : (
                          <AlertCircle className="w-4 h-4 mr-1" />
                        )}
                        {log.status}
                      </span>
                    </motion.div>
                  ))}
                </motion.div>
              </CardContent>
            </MotionCard>
          )}
        </TabsContent>
        
        <TabsContent value="group-message">
          <GroupMessaging />
        </TabsContent>
        
        <TabsContent value="label-message">
          <LabelMessaging />
        </TabsContent>
        
        <TabsContent value="auto-reply">
          <MotionCard>
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
          </MotionCard>
        </TabsContent>
        
        <TabsContent value="welcome">
          <WelcomeSettings />
        </TabsContent>
        
        <TabsContent value="export">
          <MotionCard>
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
              <MotionButton
                className="w-full bg-purple-700 hover:bg-purple-800"
                onClick={handleExportContacts}
              >
                <Download className="mr-2 h-4 w-4" /> Export Contacts
              </MotionButton>
            </CardFooter>
          </MotionCard>
        </TabsContent>
      </Tabs>
      
      <motion.footer 
        className="mt-4 text-center text-xs text-purple-600"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        WhatsApp Bulk Blaster &copy; {new Date().getFullYear()}
      </motion.footer>
    </MotionDiv>
  );
};

export default Index;

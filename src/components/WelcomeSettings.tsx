
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { MessageSquare, Save } from "lucide-react";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChromeApi } from "@/lib/chrome.d";

// Add Chrome API to the Window interface
declare global {
  interface Window {
    chrome?: ChromeApi;
  }
}

const WelcomeSettings = () => {
  const [welcomeMessage, setWelcomeMessage] = useState(
    "Welcome to the group, {name}! We're glad to have you here."
  );

  // Load welcome message from storage on component mount
  useEffect(() => {
    if (window.chrome?.storage?.local) {
      window.chrome.storage.local.get(['welcomeMessage'], (result) => {
        if (result.welcomeMessage) {
          setWelcomeMessage(result.welcomeMessage);
        }
      });
    }
  }, []);

  // Save welcome message
  const handleSaveWelcomeMessage = () => {
    if (window.chrome?.runtime?.sendMessage) {
      window.chrome.runtime.sendMessage({
        action: "updateWelcomeMessage",
        data: {
          welcomeMessage: welcomeMessage
        }
      });
      
      toast.success("Welcome message saved", {
        description: "Your custom welcome message has been saved"
      });
    } else {
      // For local development
      toast.success("Welcome message saved", {
        description: "Your custom welcome message has been saved (demo mode)"
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border-purple-100 shadow-sm hover:shadow-md transition-shadow duration-300">
        <CardHeader>
          <CardTitle className="text-purple-800">Auto Welcome Message</CardTitle>
          <CardDescription>
            Customize the welcome message sent to new group members
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-start gap-2 mb-2">
              <MessageSquare className="h-5 w-5 text-purple-600 mt-1" />
              <div>
                <p className="text-sm font-medium">Welcome Message</p>
                <p className="text-xs text-muted-foreground mb-2">
                  Use {"{name}"} to include the new member's name
                </p>
              </div>
            </div>
            
            <motion.div whileTap={{ scale: 0.995 }}>
              <Textarea 
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Welcome to the group, {name}! We're glad to have you here."
                className="min-h-[100px] focus:border-purple-300 focus:ring-purple-200"
              />
            </motion.div>
            
            <motion.div 
              className="p-3 bg-purple-50 border border-purple-100 rounded-md mt-2"
              initial={{ opacity: 0.8 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <p className="text-xs font-medium text-purple-800">Preview:</p>
              <p className="text-sm text-purple-700 mt-1">{welcomeMessage.replace('{name}', 'John')}</p>
            </motion.div>
          </div>
        </CardContent>
        <CardFooter>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.div className="w-full" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button 
                    className="w-full bg-purple-700 hover:bg-purple-800 transition-colors duration-300"
                    onClick={handleSaveWelcomeMessage}
                  >
                    <Save className="mr-2 h-4 w-4" /> Save Welcome Message
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Save your personalized welcome message</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </CardFooter>
      </Card>
    </motion.div>
  );
};

export default WelcomeSettings;

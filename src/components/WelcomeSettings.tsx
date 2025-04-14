
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { MessageSquare, Save } from "lucide-react";

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
    <Card>
      <CardHeader>
        <CardTitle>Auto Welcome Message</CardTitle>
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
          
          <Textarea 
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            placeholder="Welcome to the group, {name}! We're glad to have you here."
            className="min-h-[100px]"
          />
          
          <div className="p-3 bg-purple-50 border border-purple-100 rounded-md mt-2">
            <p className="text-xs font-medium text-purple-800">Preview:</p>
            <p className="text-sm text-purple-700 mt-1">{welcomeMessage.replace('{name}', 'John')}</p>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full bg-purple-700 hover:bg-purple-800"
          onClick={handleSaveWelcomeMessage}
        >
          <Save className="mr-2 h-4 w-4" /> Save Welcome Message
        </Button>
      </CardFooter>
    </Card>
  );
};

export default WelcomeSettings;

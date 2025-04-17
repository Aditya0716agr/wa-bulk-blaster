
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, AlertCircle, Home, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedCard } from "@/components/ui/animated-components";

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.5 }
};

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  const goHome = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-50 p-4">
      <motion.div 
        className="text-center max-w-md w-full"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <AnimatedCard
          className="bg-white p-8 rounded-xl shadow-lg border border-purple-100"
          hover={false}
        >
          <motion.div 
            className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6"
            initial={{ rotate: -90, scale: 0.8 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ 
              type: "spring", 
              stiffness: 100, 
              delay: 0.2 
            }}
          >
            <AlertCircle size={36} className="text-red-500" />
          </motion.div>
          
          <motion.h1 
            className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent"
            variants={fadeIn}
            initial="initial"
            animate="animate"
          >
            404
          </motion.h1>
          
          <motion.p 
            className="text-xl text-gray-600 mb-2"
            variants={fadeIn}
            initial="initial"
            animate="animate"
            transition={{ delay: 0.2 }}
          >
            Page Not Found
          </motion.p>
          
          <motion.p 
            className="text-gray-500 mb-8"
            variants={fadeIn}
            initial="initial"
            animate="animate"
            transition={{ delay: 0.3 }}
          >
            The page you're looking for doesn't exist or has been moved.
            {location.pathname && location.pathname !== "/" && (
              <span className="block mt-2 text-sm font-mono bg-gray-100 p-2 rounded">
                {location.pathname}
              </span>
            )}
          </motion.p>
          
          <motion.div
            className="flex flex-col sm:flex-row gap-3 justify-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Button 
              className="bg-purple-600 hover:bg-purple-700 transition-all"
              onClick={goHome}
            >
              <Home className="mr-2 h-4 w-4" />
              Return Home
            </Button>
            
            <Button 
              variant="outline"
              className="border-purple-200 text-purple-700 hover:bg-purple-50"
              onClick={() => window.location.href = 'https://web.whatsapp.com/'}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              Open WhatsApp Web
            </Button>
          </motion.div>
        </AnimatedCard>
        
        <motion.div
          className="mt-8 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <p className="text-purple-600 text-sm">
            WhatsApp Bulk Blaster &copy; {new Date().getFullYear()}
          </p>
          <p className="text-purple-400 text-xs mt-1">
            Send bulk messages with ease
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default NotFound;

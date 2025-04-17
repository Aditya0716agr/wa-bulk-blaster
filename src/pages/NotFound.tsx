
import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.5 }
};

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-50 p-4">
      <motion.div 
        className="text-center max-w-md w-full"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <motion.div
          className="bg-white p-8 rounded-xl shadow-lg border border-purple-100"
          initial={{ y: 50 }}
          animate={{ y: 0 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
        >
          <motion.div 
            className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6"
            initial={{ rotate: -90 }}
            animate={{ rotate: 0 }}
            transition={{ delay: 0.3, type: "spring", stiffness: 100 }}
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
            className="text-xl text-gray-600 mb-8"
            variants={fadeIn}
            initial="initial"
            animate="animate"
            transition={{ delay: 0.2 }}
          >
            Oops! The page you're looking for doesn't exist.
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <Button 
              className="bg-purple-600 hover:bg-purple-700 py-2 px-6 text-white rounded-lg transition-all"
              onClick={() => window.location.href = '/'}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Return to Home
            </Button>
          </motion.div>
        </motion.div>
        
        <motion.p 
          className="mt-4 text-purple-600 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          WhatsApp Bulk Blaster &copy; {new Date().getFullYear()}
        </motion.p>
      </motion.div>
    </div>
  );
};

export default NotFound;

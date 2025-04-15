
import { toast as sonnerToast } from "sonner";

export type ToastType = "success" | "error" | "info" | "warning";

interface ToastOptions {
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const showToast = (
  type: ToastType,
  title: string,
  options?: ToastOptions
) => {
  const { description, duration, action } = options || {};
  
  switch (type) {
    case "success":
      return sonnerToast.success(title, {
        description,
        duration: duration || 4000,
        action: action
          ? {
              label: action.label,
              onClick: action.onClick,
            }
          : undefined,
      });
    
    case "error":
      return sonnerToast.error(title, {
        description,
        duration: duration || 5000,
        action: action
          ? {
              label: action.label,
              onClick: action.onClick,
            }
          : undefined,
      });
    
    case "info":
      return sonnerToast.info(title, {
        description,
        duration: duration || 4000,
        action: action
          ? {
              label: action.label,
              onClick: action.onClick,
            }
          : undefined,
      });
    
    case "warning":
      return sonnerToast.warning(title, {
        description,
        duration: duration || 4500,
        action: action
          ? {
              label: action.label,
              onClick: action.onClick,
            }
          : undefined,
      });
    
    default:
      return sonnerToast(title, {
        description,
        duration: duration || 4000,
        action: action
          ? {
              label: action.label,
              onClick: action.onClick,
            }
          : undefined,
      });
  }
};

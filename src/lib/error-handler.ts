import { toast } from "sonner";
import { db, auth } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export enum ErrorCategory {
  AUTH = "Authentication",
  FIRESTORE = "Database",
  AI = "AI Intelligence",
  API = "Network API",
  NETWORK = "Connectivity",
  UNKNOWN = "General"
}

export interface AppError {
  category: ErrorCategory;
  message: string;
  originalError?: any;
  nextSteps?: string;
  severity: "info" | "warn" | "error";
}

const ERROR_GUIDANCE: Record<string, string> = {
  "auth/network-request-failed": "Please check your internet connection and try again.",
  "auth/user-disabled": "Your account has been disabled. Please contact support.",
  "permission-denied": "You don't have permission to perform this action. Ensure you are signed in correctly.",
  "quota-exceeded": "The service is currently at capacity. Please try again later.",
  "unavailable": "The database is temporarily unavailable. We're working on it!",
  "not-found": "The requested resource could not be found.",
  "deadline-exceeded": "The operation took too long. Please try again with a smaller file.",
  "resource-exhausted": "Gemini API quota exceeded. Please wait a moment before trying again.",
  "invalid-argument": "The data provided is invalid. Please check your inputs.",
};

export const logError = async (error: AppError) => {
  console.error(`[${error.category}] ${error.message}`, error.originalError);

  // Centralized logging to Firestore
  try {
    const user = auth.currentUser;
    await addDoc(collection(db, "logs"), {
      level: error.severity,
      category: error.category,
      message: error.message,
      stack: error.originalError?.stack || null,
      uid: user?.uid || "anonymous",
      timestamp: serverTimestamp(),
      metadata: {
        code: error.originalError?.code || null,
        name: error.originalError?.name || null,
        url: window.location.href,
      }
    });
  } catch (logErr) {
    console.warn("Failed to save log to Firestore:", logErr);
  }
};

export const handleError = (err: any, category: ErrorCategory = ErrorCategory.UNKNOWN) => {
  let code = err?.code || "";
  let message = err?.message || "An unexpected error occurred.";
  let nextSteps = err?.guidance || "Please try again or contact support if the problem persists.";

  // Handle JSON-encoded Firestore errors from handleFirestoreError
  if (message.startsWith("{") && message.endsWith("}")) {
    try {
      const parsed = JSON.parse(message);
      if (parsed.error) {
        message = parsed.error;
        category = ErrorCategory.FIRESTORE;
        code = parsed.operationType || "";
      }
    } catch (e) {
      // Not JSON, ignore
    }
  }

  const lowerCode = code.toLowerCase();
  const lowerMessage = message.toLowerCase();
  
  for (const [key, guidance] of Object.entries(ERROR_GUIDANCE)) {
    if (lowerCode.includes(key) || lowerMessage.includes(key)) {
      nextSteps = guidance;
      break;
    }
  }

  // AI specific handling
  if (category === ErrorCategory.AI) {
    if (code.includes("safety")) {
      message = "The AI model blocked the response due to safety filters.";
      nextSteps = "Ensure the document content complies with safety guidelines.";
    } else if (code.includes("finish_reason")) {
      message = "The AI model stopped generating before completion.";
      nextSteps = "Try again or use a shorter document.";
    }
  }

  const appError: AppError = {
    category,
    message,
    originalError: err,
    nextSteps,
    severity: "error"
  };

  // Log to console and Firestore
  logError(appError);

  // Show user-friendly toast
  toast.error(message, {
    description: nextSteps,
    duration: 6000,
  });

  return appError;
};

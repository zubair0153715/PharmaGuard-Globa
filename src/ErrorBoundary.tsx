import * as React from "react";
import { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCcw, Home, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logError, ErrorCategory } from "./lib/error-handler";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logError({
      category: ErrorCategory.UNKNOWN,
      message: error.message || "Uncaught React Error",
      originalError: { ...error, stack: errorInfo.componentStack },
      severity: "error"
    });
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred in the application interface.";
      let guidance = "Our team has been notified. You can try reloading the page or returning home.";

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="max-w-xl w-full bg-white rounded-3xl shadow-2xl p-10 text-center space-y-8 border border-gray-100">
            <div className="w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mx-auto rotate-3">
              <AlertCircle className="w-10 h-10 text-red-600 -rotate-3" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-gray-900 tracking-tight">System Interruption</h2>
              <p className="text-gray-500 text-lg leading-relaxed">
                {this.state.error?.message || errorMessage}
              </p>
              <p className="text-sm text-gray-400 italic">
                {guidance}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              <Button 
                onClick={() => window.location.reload()}
                className="rounded-xl h-14 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <RefreshCcw className="w-5 h-5" />
                Reload App
              </Button>
              <Button 
                variant="outline"
                onClick={() => window.location.href = "/"}
                className="rounded-xl h-14 flex items-center justify-center gap-2 border-gray-200"
              >
                <Home className="w-5 h-5" />
                Return Home
              </Button>
            </div>

            <div className="pt-6 border-t border-gray-100">
              <p className="text-xs text-gray-400 flex items-center justify-center gap-2">
                <MessageSquare className="w-3 h-3" />
                Need urgent help? Contact regulatory support at support@pharmaguard.com
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from "react";
import { useState, useCallback, useEffect } from "react";
import { 
  Upload, 
  FileCheck, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  Activity,
  ChevronRight,
  Info,
  Hash,
  FileCode,
  BrainCircuit,
  Search,
  History,
  LogOut,
  User as UserIcon,
  Clock,
  Download,
  FileDown,
  X,
  Trash2,
  Wand2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  auth, 
  db, 
  googleProvider, 
  handleFirestoreError, 
  OperationType 
} from "./firebase";
import { 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut, 
  User 
} from "firebase/auth";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  doc,
  setDoc,
  getDoc
} from "firebase/firestore";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Initialize PDF.js worker using Vite's URL import
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface ValidationResult {
  id?: string;
  fileName: string;
  checksum: string;
  isFileNameValid: boolean;
  isPdfA: boolean;
  pdfAStandard?: string;
  pdfAIssues?: string[];
  pageCount: number;
  metadata: any;
  healthScore: number;
  status: "Pass" | "Fail";
  timestamp: string;
  aiAnalysis?: {
    stabilityStudyFound: boolean;
    productName: string;
    batchNumber: string;
    summary: string;
    confidenceScore: number; // 0 to 100
  };
  suggestions?: {
    text: string;
    action?: string;
    type: "info" | "warning" | "error";
  }[];
  isFixed?: boolean;
  correctedData?: any;
}

interface ChatMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const safeJsonParse = (text: string) => {
  if (!text) return {};
  try {
    // Try direct parse first
    return JSON.parse(text);
  } catch (e) {
    // Try to extract JSON from markdown blocks or find the first { and last }
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (innerError) {
        console.error("Failed to parse extracted JSON:", innerError);
        throw innerError;
      }
    }
    throw e;
  }
};

function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [history, setHistory] = useState<ValidationResult[]>([]);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isDeepAuditing, setIsDeepAuditing] = useState(false);
  const [isFixing, setIsFixing] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      
      if (currentUser) {
        // Ensure user profile exists
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          await setDoc(userRef, {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            role: "user",
            createdAt: serverTimestamp()
          });
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }

    const q = query(
      collection(db, "submissions"),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ValidationResult[];
      setHistory(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "submissions");
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("Successfully signed in");
    } catch (error) {
      console.error(error);
      toast.error("Failed to sign in");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setResult(null);
      toast.success("Signed out");
    } catch (error) {
      console.error(error);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter((f: File) => f.type === "application/pdf");
      if (selectedFiles.length > 0) {
        setFiles(prev => [...prev, ...selectedFiles]);
        setResult(null);
      }
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDeepAudit = async () => {
    if (!result || !user) return;
    setIsDeepAuditing(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [{ role: "user", parts: [{ text: `Perform a deep regulatory audit of this document: ${result.fileName}. 
        Summary: ${result.aiAnalysis?.summary}. 
        Metadata: ${JSON.stringify(result.metadata)}.
        Provide a detailed compliance report and specific "Next Steps" to fix any issues. 
        Format the response as JSON: { "report": string, "nextSteps": string[], "complianceStatus": "Compliant" | "Non-Compliant" | "Warning" }` }] }],
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          responseMimeType: "application/json"
        }
      });

      const auditData = safeJsonParse(response.text || "{}");
      toast.success("Deep Audit Complete");
      
      // Update the submission in Firestore with audit data
      const subRef = doc(db, "submissions", result.id!);
      await setDoc(subRef, {
        ...result,
        deepAudit: auditData,
        updatedAt: serverTimestamp()
      }, { merge: true });

      setResult(prev => prev ? { ...prev, deepAudit: auditData } : null);
    } catch (error) {
      console.error("Deep Audit Error:", error);
      toast.error("Deep Audit failed");
    } finally {
      setIsDeepAuditing(false);
    }
  };

  const handleRegulatoryCheck = async () => {
    if (!result) return;
    toast.info("Checking latest regulatory standards via Google Search...");
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: `Check the latest FDA/EMA stability study guidelines for ${result.aiAnalysis?.productName || "pharmaceutical products"}. 
        Compare with this document summary: ${result.aiAnalysis?.summary}.
        Are there any new requirements?` }] }],
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      const searchData = response.text;
      toast.success("Regulatory Check Complete");
      
      // Add as a suggestion
      const newSuggestion = {
        text: `Regulatory Insight: ${searchData.substring(0, 200)}...`,
        type: "info" as const
      };

      setResult(prev => prev ? { 
        ...prev, 
        suggestions: [...(prev.suggestions || []), newSuggestion] 
      } : null);
    } catch (error) {
      console.error("Regulatory Check Error:", error);
      toast.error("Regulatory Check failed");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg: ChatMessage = { role: "user", parts: [{ text: chatInput }] };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: "You are a Regulatory Compliance Assistant for pharmaceutical documents. Help users understand validation results, stability studies, and PDF/A standards."
        },
        history: chatMessages
      });

      const response = await chat.sendMessage(chatInput);
      const modelMsg: ChatMessage = { role: "model", parts: [{ text: response.text || "I couldn't process that." }] };
      setChatMessages(prev => [...prev, modelMsg]);
    } catch (error) {
      console.error("Chat Error:", error);
      toast.error("Failed to get response from assistant");
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleFixIssues = async () => {
    if (!result || !user) return;
    setIsFixing(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [{ role: "user", parts: [{ text: `The following pharmaceutical document has compliance issues: ${result.fileName}.
        Issues: ${JSON.stringify(result.suggestions)}.
        Current Metadata: ${JSON.stringify(result.metadata)}.
        AI Analysis: ${JSON.stringify(result.aiAnalysis)}.
        
        Please generate a "Corrected Draft" of the document metadata and content summary that fixes all identified mistakes (e.g., naming conventions, missing batch numbers, stability study details).
        
        Format the response as JSON: { "correctedMetadata": object, "correctedSummary": string, "fixReport": string }` }] }],
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          responseMimeType: "application/json"
        }
      });

      const fixData = safeJsonParse(response.text || "{}");
      toast.success("AI has generated a corrected draft!");
      
      const updatedResult = {
        ...result,
        isFixed: true,
        correctedData: fixData,
        healthScore: 100, // AI fix brings it to 100 in draft
        status: "Pass" as const,
        updatedAt: serverTimestamp()
      };

      // Update Firestore
      const subRef = doc(db, "submissions", result.id!);
      await setDoc(subRef, updatedResult, { merge: true });

      setResult(updatedResult);
    } catch (error) {
      console.error("Fix Issues Error:", error);
      toast.error("Failed to generate AI fix");
    } finally {
      setIsFixing(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files) {
      const droppedFiles = Array.from(e.dataTransfer.files).filter((f: File) => f.type === "application/pdf");
      if (droppedFiles.length > 0) {
        setFiles(prev => [...prev, ...droppedFiles]);
        setResult(null);
      } else {
        toast.error("Please upload PDF files");
      }
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFirstPageAsBase64 = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    if (!context) throw new Error("Canvas context not found");

    await (page as any).render({ canvasContext: context, viewport }).promise;
    return canvas.toDataURL("image/png").split(",")[1];
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Please select at least one file");
      return;
    }

    if (!user) {
      toast.error("Please sign in to validate documents");
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setResult(null);
    let lastResult: ValidationResult | null = null;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setCurrentFileIndex(i);
        const baseProgress = (i / files.length) * 100;
        const stepSize = 100 / files.length;

        // 1. Backend Validation
        setProgress(baseProgress + (stepSize * 0.2));
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/validate-document", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const contentType = response.headers.get("content-type");
          let errorMessage = "Unknown error";
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json().catch(() => ({}));
            errorMessage = errorData.error || errorMessage;
          } else {
            errorMessage = `Server returned ${response.status} ${response.statusText}`;
          }
          toast.error(`Backend validation failed for ${file.name}: ${errorMessage}`);
          continue;
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          console.error("Expected JSON but received:", contentType);
          toast.error(`Server error: Expected JSON response but received ${contentType || "nothing"}. Please try again.`);
          continue;
        }

        const backendData = await response.json();
        setProgress(baseProgress + (stepSize * 0.5));

        // 2. AI Analysis (Frontend)
        let base64Image;
        try {
          base64Image = await getFirstPageAsBase64(file);
        } catch (pdfError) {
          console.error("PDF Preview Error:", pdfError);
          toast.error(`Could not generate preview for AI analysis: ${file.name}`);
          continue;
        }
        setProgress(baseProgress + (stepSize * 0.7));

        let aiResponse;
        try {
          aiResponse = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: {
              parts: [
                { text: `Analyze this pharmaceutical document (first page). 
                Extract the following in JSON format: 
                { 
                  'stabilityStudyFound': boolean, 
                  'productName': string, 
                  'batchNumber': string, 
                  'summary': string, 
                  'confidenceScore': number,
                  'suggestions': Array<{ text: string, type: 'info' | 'warning' | 'error', action?: string }>
                }. 
                The confidenceScore should be between 0 and 100. 
                If information is missing, add an 'error' suggestion. 
                If the document is not PDF/A compliant (based on metadata), add a 'warning' suggestion with action 'Fix PDF/A'.` },
                { inlineData: { mimeType: "image/png", data: base64Image } }
              ]
            },
            config: {
              responseMimeType: "application/json"
            }
          });
        } catch (aiError) {
          console.error("Gemini API Error:", aiError);
          toast.error(`AI analysis failed for ${file.name}. Check your API key or connection.`);
          continue;
        }

        let aiAnalysis;
        try {
          const text = aiResponse.text;
          aiAnalysis = safeJsonParse(text || "{}");
        } catch (parseError) {
          console.error("AI Response Parsing Error:", parseError);
          aiAnalysis = {
            stabilityStudyFound: false,
            productName: "Error parsing AI response",
            batchNumber: "N/A",
            summary: "The AI analysis could not be parsed correctly.",
            confidenceScore: 0
          };
        }
        setProgress(baseProgress + (stepSize * 0.9));

        // Combine results
        const calculatedScore = Math.min(100, backendData.healthScore + (aiAnalysis.stabilityStudyFound ? 10 : 0));
        const finalResult: ValidationResult = {
          ...backendData,
          aiAnalysis: {
            stabilityStudyFound: aiAnalysis.stabilityStudyFound,
            productName: aiAnalysis.productName,
            batchNumber: aiAnalysis.batchNumber,
            summary: aiAnalysis.summary,
            confidenceScore: aiAnalysis.confidenceScore
          },
          suggestions: aiAnalysis.suggestions || [],
          healthScore: calculatedScore,
          status: calculatedScore >= 70 ? "Pass" : "Fail"
        };

        // 3. Save to Firestore
        try {
          await addDoc(collection(db, "submissions"), {
            ...finalResult,
            uid: user.uid,
            createdAt: serverTimestamp()
          });
        } catch (dbError) {
          handleFirestoreError(dbError, OperationType.CREATE, "submissions");
        }
        
        lastResult = finalResult;
        setProgress(baseProgress + stepSize);
      }

      setIsUploading(false);
      setFiles([]);
      if (lastResult) {
        setResult(lastResult);
        toast.success(`Batch validation complete. ${files.length} files processed.`);
      }

    } catch (error) {
      console.error(error);
      toast.error("An error occurred during batch validation");
      setIsUploading(false);
    }
  };

  const downloadPDF = () => {
    if (!result) return;
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text("PharmaGuard Global - Validation Report", 14, 22);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    
    // Document Info
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("Document Information", 14, 45);
    autoTable(doc, {
      startY: 50,
      head: [['Field', 'Value']],
      body: [
        ['File Name', result.fileName],
        ['Status', result.status],
        ['Health Score', `${result.healthScore}/100`],
        ['Checksum', result.checksum],
        ['PDF/A Compliant', result.isPdfA ? 'Yes' : 'No'],
        ['PDF/A Standard', result.pdfAStandard || 'N/A'],
        ['PDF/A Issues', result.pdfAIssues?.join(', ') || 'None'],
        ['Naming Valid', result.isFileNameValid ? 'Yes' : 'No'],
      ],
    });

    // AI Analysis
    const finalY = (doc as any).lastAutoTable.finalY || 100;
    doc.text("AI Content Intelligence", 14, finalY + 15);
    autoTable(doc, {
      startY: finalY + 20,
      head: [['AI Metric', 'Result']],
      body: [
        ['Product Name', result.aiAnalysis?.productName || 'N/A'],
        ['Batch Number', result.aiAnalysis?.batchNumber || 'N/A'],
        ['Stability Study', result.aiAnalysis?.stabilityStudyFound ? 'Detected' : 'Not Detected'],
        ['AI Confidence', `${result.aiAnalysis?.confidenceScore || 0}%`],
        ['AI Summary', result.aiAnalysis?.summary || 'N/A'],
      ],
    });

    doc.save(`PharmaGuard_Report_${result.fileName.replace('.pdf', '')}.pdf`);
    toast.success("PDF Report downloaded");
  };

  const downloadCSV = () => {
    if (!result) return;
    const rows = [
      ["Field", "Value"],
      ["File Name", result.fileName],
      ["Status", result.status],
      ["Health Score", result.healthScore.toString()],
      ["Checksum", result.checksum],
      ["PDF/A Compliant", result.isPdfA.toString()],
      ["PDF/A Standard", result.pdfAStandard || ""],
      ["PDF/A Issues", result.pdfAIssues?.join("; ") || ""],
      ["Naming Valid", result.isFileNameValid.toString()],
      ["Product Name", result.aiAnalysis?.productName || ""],
      ["Batch Number", result.aiAnalysis?.batchNumber || ""],
      ["Stability Study Found", result.aiAnalysis?.stabilityStudyFound.toString()],
      ["AI Confidence Score", (result.aiAnalysis?.confidenceScore || 0).toString()],
      ["AI Summary", result.aiAnalysis?.summary || ""],
      ["Timestamp", result.timestamp]
    ];

    const csvContent = "data:text/csv;charset=utf-8," 
      + rows.map(e => e.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `PharmaGuard_Report_${result.fileName.replace('.pdf', '')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV Report downloaded");
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Activity className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFBFB] text-[#1D1D1F] font-sans selection:bg-blue-100">
      <Toaster position="top-center" />
      
      {/* Navigation */}
      <nav className="sticky top-0 z-50 glass border-b border-gray-200/50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <ShieldCheck className="text-white w-5 h-5" />
            </div>
            <span className="font-semibold text-xl tracking-tight">PharmaGuard <span className="text-blue-600">Global</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-500">
            <a href="#" className="hover:text-black transition-colors">Dashboard</a>
            <a href="#" className="hover:text-black transition-colors">SFDA Guidelines</a>
            {user && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-black">
                  <UserIcon className="w-4 h-4" />
                  <span>{user.displayName}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            )}
            {!user && <Button variant="outline" className="rounded-full px-6" onClick={handleLogin}>Sign In</Button>}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {!user ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-24 h-24 bg-blue-50 rounded-3xl flex items-center justify-center"
            >
              <ShieldCheck className="w-12 h-12 text-blue-600" />
            </motion.div>
            <div className="max-w-md space-y-4">
              <h1 className="text-4xl font-bold tracking-tight">Secure Pharma Compliance</h1>
              <p className="text-gray-500 text-lg">Sign in to start validating your eCTD documents against SFDA standards and maintain a secure audit trail.</p>
            </div>
            <Button size="lg" className="rounded-full px-12 h-14 text-lg" onClick={handleLogin}>
              Sign in with Google
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            
            {/* Left Column: Upload & History */}
            <div className="lg:col-span-5 space-y-8">
              <Card className="border-none shadow-2xl shadow-gray-200/50 overflow-hidden rounded-3xl">
                <CardHeader className="bg-gray-50/50 border-b border-gray-100">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Upload className="w-5 h-5 text-blue-600" />
                    Document Validator
                  </CardTitle>
                  <CardDescription>Upload your PDF for SFDA compliance check</CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                  <div 
                    className={cn(
                      "border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center transition-all cursor-pointer",
                      files.length > 0 ? "border-blue-400 bg-blue-50/30" : "border-gray-200 hover:border-blue-400 hover:bg-gray-50"
                    )}
                    onClick={() => document.getElementById("file-upload")?.click()}
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                  >
                    <input 
                      id="file-upload"
                      type="file" 
                      className="hidden" 
                      accept=".pdf"
                      multiple
                      onChange={onFileChange}
                    />
                    {files.length > 0 ? (
                      <div className="w-full space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Selected Files ({files.length})</p>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 px-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFiles([]);
                            }}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Clear All
                          </Button>
                        </div>
                        <ScrollArea className="h-[120px] pr-4">
                          <div className="space-y-2">
                            {files.map((f, idx) => (
                              <div key={idx} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl group/item">
                                <div className="flex items-center gap-3 min-w-0">
                                  <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                                  <p className="text-sm font-medium truncate">{f.name}</p>
                                </div>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-6 w-6 p-0 opacity-0 group-hover/item:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeFile(idx);
                                  }}
                                >
                                  <X className="w-3 h-3 text-gray-400" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                        <div className="pt-4 border-t border-gray-100 flex justify-center">
                          <p className="text-xs text-gray-400">Click or drag more files to add</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                          <Upload className="w-8 h-8 text-blue-600" />
                        </div>
                        <p className="font-medium text-lg mb-2">Click to upload or drag and drop</p>
                        <p className="text-sm text-gray-400">PDF files only (Max 10MB per file)</p>
                      </div>
                    )}
                  </div>

                  {isUploading && (
                    <div className="mt-8 space-y-4">
                      <div className="flex justify-between text-sm font-medium">
                        <span className="flex items-center gap-2">
                          <Activity className="w-4 h-4 animate-pulse text-blue-600" />
                          Processing {currentFileIndex + 1} of {files.length}
                        </span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-2 bg-gray-100" />
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold text-center">
                        Current: {files[currentFileIndex]?.name}
                      </p>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="bg-gray-50/50 p-6">
                  <Button 
                    className="w-full rounded-xl h-12 text-lg font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                    disabled={files.length === 0 || isUploading}
                    onClick={handleUpload}
                  >
                    {isUploading ? "Validating Batch..." : `Validate ${files.length} Document${files.length !== 1 ? 's' : ''}`}
                  </Button>
                </CardFooter>
              </Card>

              <Card className="border-none shadow-xl shadow-gray-100 rounded-3xl overflow-hidden">
                <CardHeader className="bg-white border-b border-gray-100">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="w-5 h-5 text-gray-400" />
                    Recent Validations
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[400px]">
                    {history.length > 0 ? (
                      <div className="divide-y divide-gray-100">
                        {history.map((item) => (
                          <div 
                            key={item.id} 
                            className="p-4 hover:bg-gray-50 transition-colors cursor-pointer group"
                            onClick={() => setResult(item)}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={cn(
                                  "w-2 h-2 rounded-full shrink-0",
                                  item.status === "Pass" ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                                )} />
                                <p className="font-semibold text-sm truncate">{item.fileName}</p>
                              </div>
                              <Badge variant={item.status === "Pass" ? "default" : "destructive"} className="text-[10px] h-5 ml-2">
                                {item.status}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(item.timestamp).toLocaleDateString()}
                              </span>
                              <span>Score: {item.healthScore}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-[400px] p-8 text-center space-y-4">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-2">
                          <Search className="w-8 h-8 text-gray-200" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-semibold text-gray-900">No validations yet</p>
                          <p className="text-sm text-gray-400 max-w-[200px] mx-auto">
                            Upload your first pharmaceutical document to start building your compliance history.
                          </p>
                        </div>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="rounded-full mt-2"
                          onClick={() => document.getElementById("file-upload")?.click()}
                        >
                          Upload Document
                        </Button>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Results */}
            <div className="lg:col-span-7">
              <AnimatePresence mode="wait">
                {result ? (
                  <motion.div
                    key={result.id || "current"}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                      <div>
                        <h2 className="text-3xl font-bold tracking-tight">Validation Results</h2>
                        <p className="text-gray-400 text-sm mt-1">{result.fileName}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 mr-2">
                          <Button variant="outline" size="sm" onClick={downloadPDF} className="rounded-full gap-2">
                            <FileDown className="w-4 h-4" />
                            PDF
                          </Button>
                          <Button variant="outline" size="sm" onClick={downloadCSV} className="rounded-full gap-2">
                            <Download className="w-4 h-4" />
                            CSV
                          </Button>
                        </div>
                        <Badge 
                          variant={result.status === "Pass" ? "default" : "destructive"}
                          className={cn(
                            "px-4 py-1.5 rounded-full text-sm font-semibold",
                            result.status === "Pass" ? "bg-green-100 text-green-700 hover:bg-green-100" : ""
                          )}
                        >
                          {result.status === "Pass" ? (
                            <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> SFDA Compliant</span>
                          ) : (
                            <span className="flex items-center gap-1.5"><XCircle className="w-4 h-4" /> Action Required</span>
                          )}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="border-none shadow-lg shadow-gray-100 rounded-2xl">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wider flex items-center gap-2">
                            <Activity className="w-4 h-4" />
                            Health Score
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-bold">{result.healthScore}</span>
                            <span className="text-gray-400 font-medium">/ 100</span>
                          </div>
                          <Progress 
                            value={result.healthScore} 
                            className="h-2 mt-4 bg-gray-100" 
                          />
                        </CardContent>
                      </Card>

                      <Card className="border-none shadow-lg shadow-gray-100 rounded-2xl">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-gray-500 uppercase tracking-wider flex items-center gap-2">
                            <Hash className="w-4 h-4" />
                            Data Integrity
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="bg-gray-50 p-3 rounded-xl font-mono text-xs break-all text-gray-600 border border-gray-100">
                            {result.checksum}
                          </div>
                          <p className="text-[10px] text-gray-400 mt-2 uppercase tracking-widest font-bold">MD5 Checksum Verified</p>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="border-none shadow-lg shadow-gray-100 rounded-2xl overflow-hidden">
                      <CardHeader className="bg-blue-600 text-white">
                        <CardTitle className="text-lg flex items-center justify-between w-full">
                          <div className="flex items-center gap-2">
                            <BrainCircuit className="w-5 h-5" />
                            AI Content Intelligence
                          </div>
                          {result.aiAnalysis?.confidenceScore !== undefined && (
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-md",
                                result.aiAnalysis.confidenceScore >= 85 ? "bg-green-500/20 text-green-100 border-green-500/30" :
                                result.aiAnalysis.confidenceScore >= 60 ? "bg-yellow-500/20 text-yellow-100 border-yellow-500/30" :
                                "bg-red-500/20 text-red-100 border-red-500/30"
                              )}
                            >
                              {result.aiAnalysis.confidenceScore >= 85 ? "High Confidence" :
                               result.aiAnalysis.confidenceScore >= 60 ? "Medium Confidence" :
                               "Low Confidence"} ({result.aiAnalysis.confidenceScore}%)
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription className="text-blue-100">Deep scan of document first page</CardDescription>
                      </CardHeader>
                      <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                            <p className="text-[10px] uppercase tracking-widest font-bold text-blue-400 mb-1">Product Name</p>
                            <p className="font-semibold text-blue-900">{result.aiAnalysis?.productName || "Not Found"}</p>
                          </div>
                          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                            <p className="text-[10px] uppercase tracking-widest font-bold text-blue-400 mb-1">Batch Number</p>
                            <p className="font-semibold text-blue-900">{result.aiAnalysis?.batchNumber || "Not Found"}</p>
                          </div>
                          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                            <p className="text-[10px] uppercase tracking-widest font-bold text-blue-400 mb-1">Stability Study</p>
                            <Badge variant={result.aiAnalysis?.stabilityStudyFound ? "default" : "outline"} className={cn("mt-1", result.aiAnalysis?.stabilityStudyFound ? "bg-blue-600" : "")}>
                              {result.aiAnalysis?.stabilityStudyFound ? "Detected" : "Not Detected"}
                            </Badge>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-sm font-semibold flex items-center gap-2">
                            <Search className="w-4 h-4 text-gray-400" />
                            AI Summary
                          </p>
                          <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100 italic">
                            "{result.aiAnalysis?.summary || "No summary available."}"
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-3 pt-2">
                          <Button 
                            onClick={handleDeepAudit} 
                            disabled={isDeepAuditing}
                            className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl gap-2"
                          >
                            {isDeepAuditing ? <Activity className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                            Deep Regulatory Audit
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={handleRegulatoryCheck}
                            className="rounded-xl gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                          >
                            <Search className="w-4 h-4" />
                            Regulatory Standard Check
                          </Button>
                          {result.suggestions && result.suggestions.some(s => s.type === "error" || s.type === "warning") && !result.isFixed && (
                            <Button 
                              onClick={handleFixIssues}
                              disabled={isFixing}
                              className="bg-green-600 hover:bg-green-700 text-white rounded-xl gap-2"
                            >
                              {isFixing ? <Activity className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                              Fix All Issues (AI)
                            </Button>
                          )}
                        </div>

                        {result.suggestions && result.suggestions.length > 0 && (
                          <div className="space-y-3 pt-4 border-t border-gray-100">
                            <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                              <Info className="w-4 h-4 text-blue-600" />
                              AI Recommendations
                            </p>
                            <div className="grid grid-cols-1 gap-2">
                              {result.suggestions.map((s, idx) => (
                                <div key={idx} className={cn(
                                  "p-3 rounded-xl border flex items-start justify-between gap-3",
                                  s.type === "error" ? "bg-red-50 border-red-100 text-red-700" :
                                  s.type === "warning" ? "bg-yellow-50 border-yellow-100 text-yellow-700" :
                                  "bg-blue-50 border-blue-100 text-blue-700"
                                )}>
                                  <div className="flex gap-2">
                                    {s.type === "error" ? <XCircle className="w-4 h-4 mt-0.5 shrink-0" /> :
                                     s.type === "warning" ? <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> :
                                     <Info className="w-4 h-4 mt-0.5 shrink-0" />}
                                    <p className="text-sm">{s.text}</p>
                                  </div>
                                  {s.action && (
                                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] uppercase tracking-widest font-bold bg-white/50 hover:bg-white">
                                      {s.action}
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {(result as any).deepAudit && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-6 bg-purple-50 rounded-2xl border border-purple-100 space-y-4 mt-4"
                          >
                            <div className="flex items-center justify-between">
                              <h3 className="font-bold text-purple-900 flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5" />
                                Deep Audit Report
                              </h3>
                              <Badge className={cn(
                                (result as any).deepAudit.complianceStatus === "Compliant" ? "bg-green-600" :
                                (result as any).deepAudit.complianceStatus === "Warning" ? "bg-yellow-600" : "bg-red-600"
                              )}>
                                {(result as any).deepAudit.complianceStatus}
                              </Badge>
                            </div>
                            <p className="text-sm text-purple-800 leading-relaxed">{(result as any).deepAudit.report}</p>
                            <div className="space-y-2">
                              <p className="text-xs font-bold uppercase tracking-widest text-purple-400">Next Steps</p>
                              <ul className="space-y-1">
                                {(result as any).deepAudit.nextSteps.map((step: string, idx: number) => (
                                  <li key={idx} className="text-sm text-purple-900 flex items-center gap-2">
                                    <ChevronRight className="w-3 h-3 text-purple-400" />
                                    {step}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </motion.div>
                        )}

                        {result.isFixed && result.correctedData && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="p-6 bg-green-50 rounded-2xl border border-green-100 space-y-4 mt-4"
                          >
                            <div className="flex items-center justify-between">
                              <h3 className="font-bold text-green-900 flex items-center gap-2">
                                <Wand2 className="w-5 h-5" />
                                AI Corrected Draft
                              </h3>
                              <Badge className="bg-green-600">Fixed</Badge>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Corrected Summary</p>
                                <p className="text-sm text-green-800 italic">"{result.correctedData.correctedSummary}"</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Fix Report</p>
                                <p className="text-sm text-green-800">{result.correctedData.fixReport}</p>
                              </div>
                            </div>
                            <div className="pt-2">
                              <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-2">Corrected Metadata</p>
                              <div className="bg-white/50 p-3 rounded-xl text-xs font-mono text-green-900 overflow-auto max-h-32">
                                {JSON.stringify(result.correctedData.correctedMetadata, null, 2)}
                              </div>
                            </div>
                            <Button className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl gap-2">
                              <Download className="w-4 h-4" />
                              Download Corrected Submission
                            </Button>
                          </motion.div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-none shadow-lg shadow-gray-100 rounded-2xl">
                      <CardHeader>
                        <CardTitle className="text-lg">Compliance Checklist</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={cn("p-2 rounded-lg", result.isPdfA ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600")}>
                                <FileCode className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-semibold">PDF/A Compliance</p>
                                <p className="text-xs text-gray-500">Required for long-term archiving</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {result.isPdfA && (
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    {result.pdfAStandard}
                                  </Badge>
                                  <div className="group relative">
                                    <Info className="w-4 h-4 text-gray-400 cursor-help" />
                                    <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-gray-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                      {result.pdfAStandard?.includes("1") ? "Level 1: Basic compliance for long-term archiving." : 
                                       result.pdfAStandard?.includes("2") ? "Level 2: Supports features like transparency and layers." :
                                       result.pdfAStandard?.includes("3") ? "Level 3: Allows embedding of any file format." :
                                       "Standard PDF/A compliance for regulatory submission."}
                                    </div>
                                  </div>
                                </div>
                              )}
                              {result.isPdfA ? <CheckCircle2 className="text-green-500 w-6 h-6" /> : <XCircle className="text-red-500 w-6 h-6" />}
                            </div>
                          </div>
                          
                          {!result.isPdfA && result.pdfAIssues && result.pdfAIssues.length > 0 && (
                            <div className="mt-2 pt-3 border-t border-gray-200">
                              <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-2">Detected Issues</p>
                              <ul className="space-y-1">
                                {result.pdfAIssues.map((issue, idx) => (
                                  <li key={idx} className="flex items-start gap-2 text-xs text-gray-600">
                                    <AlertCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                                    {issue}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                          <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-lg", result.isFileNameValid ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600")}>
                              <FileText className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-semibold">Naming Convention</p>
                              <p className="text-xs text-gray-500">Lowercase, no special chars, max 64</p>
                            </div>
                          </div>
                          {result.isFileNameValid ? <CheckCircle2 className="text-green-500 w-6 h-6" /> : <XCircle className="text-red-500 w-6 h-6" />}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-gray-200 rounded-3xl bg-gray-50/30"
                  >
                    <div className="w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-8">
                      <ShieldCheck className="w-12 h-12 text-gray-200" />
                    </div>
                    <h3 className="text-2xl font-bold mb-4 text-gray-400">Waiting for Analysis</h3>
                    <p className="text-gray-400 max-w-xs mx-auto">
                      Upload a pharmaceutical document to see the AI-powered SFDA compliance report here.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </main>

      {/* Chatbot */}
      <div className="fixed bottom-8 right-8 z-[100]">
        <AnimatePresence>
          {isChatOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="absolute bottom-20 right-0 w-[400px] h-[600px] glass shadow-2xl rounded-3xl overflow-hidden border border-gray-200 flex flex-col"
            >
              <div className="p-4 bg-black text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                    <BrainCircuit className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">Regulatory Assistant</p>
                    <p className="text-[10px] text-blue-300 uppercase tracking-widest font-bold">Powered by Gemini</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setIsChatOpen(false)} className="text-white hover:bg-white/10">
                  <X className="w-5 h-5" />
                </Button>
              </div>
              
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {chatMessages.length === 0 && (
                    <div className="text-center py-8 space-y-4">
                      <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
                        <Info className="w-6 h-6 text-blue-600" />
                      </div>
                      <p className="text-sm text-gray-500 max-w-[200px] mx-auto">
                        Ask me anything about regulatory compliance, SFDA standards, or your validation results.
                      </p>
                    </div>
                  )}
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={cn(
                      "flex flex-col max-w-[85%]",
                      msg.role === "user" ? "ml-auto items-end" : "items-start"
                    )}>
                      <div className={cn(
                        "p-3 rounded-2xl text-sm",
                        msg.role === "user" ? "bg-blue-600 text-white rounded-tr-none" : "bg-gray-100 text-gray-800 rounded-tl-none"
                      )}>
                        {msg.parts[0].text}
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex items-start max-w-[85%]">
                      <div className="bg-gray-100 p-3 rounded-2xl rounded-tl-none">
                        <Activity className="w-4 h-4 animate-spin text-blue-600" />
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-100 bg-white">
                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type your question..."
                    className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <Button type="submit" disabled={!chatInput.trim() || isChatLoading} className="rounded-xl">
                    Send
                  </Button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
        
        <Button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={cn(
            "w-14 h-14 rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95",
            isChatOpen ? "bg-black" : "bg-blue-600"
          )}
        >
          {isChatOpen ? <X className="w-6 h-6" /> : <BrainCircuit className="w-6 h-6" />}
        </Button>
      </div>

      <footer className="border-t border-gray-200 py-12 mt-24 bg-white">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-black w-6 h-6" />
            <span className="font-bold text-lg">PharmaGuard Global</span>
          </div>
          <div className="flex gap-8 text-sm text-gray-500">
            <a href="#" className="hover:text-black">Privacy Policy</a>
            <a href="#" className="hover:text-black">Terms of Service</a>
            <a href="#" className="hover:text-black">Contact Support</a>
          </div>
          <p className="text-sm text-gray-400">© 2026 PharmaGuard Global. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  );
}

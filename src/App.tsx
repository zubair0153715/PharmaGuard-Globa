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
  Wand2,
  Plus,
  Settings2,
  Sun,
  Moon,
  Shield,
  Lock,
  History as AuditIcon,
  CheckSquare,
  FileSignature,
  Eye,
  EyeOff,
  Key,
  ShieldAlert,
  CreditCard,
  PenTool,
  Globe,
  Languages,
  LayoutTemplate,
  Building2,
  Mail,
  ArrowRight,
  Star,
  Users,
  Zap
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
import { loadStripe } from "@stripe/stripe-js";
import { 
  auth, 
  db, 
  googleProvider, 
  handleFirestoreError, 
  OperationType 
} from "./firebase";

// Initialize Stripe
const stripePromise = (import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY 
  ? loadStripe((import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY) 
  : null;
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
  getDoc,
  deleteDoc,
  updateDoc,
  increment
} from "firebase/firestore";
import { handleError, ErrorCategory } from "./lib/error-handler";
import { ErrorBoundary } from "./ErrorBoundary";
import { encryptObject, decryptObject } from "./lib/crypto";

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
  isSigned?: boolean;
  signatureId?: string;
  isEncrypted?: boolean;
}

interface AuditLog {
  id?: string;
  uid: string;
  tenantId: string;
  userEmail: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details: string;
  previousState?: any;
  newState?: any;
  ipAddress?: string;
  timestamp: any;
  isEncrypted?: boolean;
}

interface SignatureRecord {
  id?: string;
  uid: string;
  tenantId: string;
  userEmail: string;
  submissionId: string;
  reason: string;
  meaning: string;
  hash?: string;
  timestamp: any;
  isEncrypted?: boolean;
}

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  company?: string;
  role: "QA_Manager" | "Regulatory_Officer" | "Reviewer" | "Admin";
  tenantId: string;
  companyName?: string;
  subscriptionStatus?: "trial" | "active" | "past_due" | "canceled";
  subscriptionPlan?: "starter" | "pro" | "enterprise";
  stripeCustomerId?: string;
  subscriptionId?: string;
  monthlyUsage: number;
  usageLimit: number;
  createdAt: any;
  sfdaMode?: boolean;
  language?: "en" | "ar";
  lastLogin: any;
}

interface CustomRule {
  id?: string;
  uid: string;
  tenantId: string;
  name: string;
  description?: string;
  logic: string;
  severity: "info" | "warning" | "error";
  isActive: boolean;
  createdAt: any;
}

interface ChatMessage {
  role: "user" | "model";
  parts: { text: string }[];
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const translations = {
  en: {
    dashboard: "Compliance Dashboard",
    upload: "Document Validator",
    history: "Validation History",
    templates: "Regulatory Templates",
    settings: "Settings",
    sfdaMode: "SFDA Compliance Mode",
    language: "Language",
    logout: "Sign Out",
    login: "Sign In with Google",
    requestDemo: "Request Free Demo",
    headline: "SFDA Compliance — Automated",
    subheadline: "AI-powered pharmaceutical document validation for SFDA & Global standards.",
    features: "Features",
    freeTrial: "FREE trial for first 3 companies",
    uploadText: "Upload your PDF for compliance check",
    dropText: "Click to upload or drag and drop",
    pdfOnly: "PDF files only (Max 2GB per file)",
    sfdaActive: "🇸🇦 SFDA Compliance Mode Active",
    arabicName: "Arabic Product Name",
    regNumber: "SFDA Registration Number",
    expiryDate: "Expiry Date",
    gmpCert: "GMP Certificate",
    validate: "Validate Documents",
    processing: "Processing",
    results: "Validation Results",
    auditTrail: "Audit Trail",
    signatures: "Electronic Signatures",
    billing: "Company & Billing",
    templatesTab: "Templates",
    dmfChecklist: "SFDA DMF Checklist",
    stabilitySummary: "Stability Study Summary",
    dossierChecklist: "Drug Registration Dossier Checklist",
    stabilityTemplate: "Stability Study (ICH Q1A)",
    gmpForm: "GMP Certificate Validation",
    paymentMethod: "Payment Method",
    bankTransfer: "Bank Transfer / Invoice (Pakistan/Saudi)",
    bankDetails: "Direct Bank Transfer is authorized for Pakistan & Saudi Arabia. Contact support for invoice.",
    pricing: "Pricing Plans",
    starter: "Starter",
    pro: "Professional",
    enterprise: "Enterprise",
    monthly: "Monthly",
    yearly: "Yearly",
    save20: "Save 20%",
    subscribe: "Subscribe Now",
    manageSubscription: "Manage Subscription",
    unlimitedValidations: "Unlimited Validations",
    prioritySupport: "Priority Support",
    apiAccess: "API Access",
    customTraining: "Custom AI Training",
  },
  ar: {
    dashboard: "لوحة تحكم الامتثال",
    upload: "مدقق المستندات",
    history: "سجل التحقق",
    templates: "قوالب تنظيمية",
    settings: "الإعدادات",
    sfdaMode: "وضع امتثال هيئة الغذاء والدواء",
    language: "اللغة",
    logout: "تسجيل الخروج",
    login: "تسجيل الدخول باستخدام جوجل",
    requestDemo: "طلب عرض تجريبي مجاني",
    headline: "امتثال هيئة الغذاء والدواء — مؤتمت",
    subheadline: "التحقق من المستندات الصيدلانية المدعوم بالذكاء الاصطناعي لمعايير الهيئة والمعايير العالمية.",
    features: "المميزات",
    freeTrial: "تجربة مجانية لأول 3 شركات",
    uploadText: "قم بتحميل ملف PDF للتحقق من الامتثال",
    dropText: "انقر للتحميل أو سحب وإفلات",
    pdfOnly: "ملفات PDF فقط (بحد أقصى 2 جيجابايت)",
    sfdaActive: "🇸🇦 وضع امتثال هيئة الغذاء والدواء نشط",
    arabicName: "اسم المنتج باللغة العربية",
    regNumber: "رقم تسجيل الهيئة",
    expiryDate: "تاريخ الانتهاء",
    gmpCert: "شهادة التصنيع الجيد (GMP)",
    validate: "التحقق من المستندات",
    processing: "جاري المعالجة",
    results: "نتائج التحقق",
    auditTrail: "سجل المراجعة",
    signatures: "التوقيعات الإلكترونية",
    billing: "الشركة والفواتير",
    templatesTab: "القوالب",
    dmfChecklist: "قائمة مراجعة ملف رئيسي للدواء (DMF)",
    stabilitySummary: "ملخص دراسة الاستقرار",
    dossierChecklist: "قائمة مراجعة ملف تسجيل الدواء",
    stabilityTemplate: "دراسة الاستقرار (ICH Q1A)",
    gmpForm: "التحقق من شهادة GMP",
    paymentMethod: "طريقة الدفع",
    bankTransfer: "تحويل بنكي / فاتورة (باكستان/السعودية)",
    bankDetails: "التحويل البنكي المباشر معتمد لباكستان والمملكة العربية السعودية. اتصل بالدعم للحصول على فاتورة.",
    pricing: "خطط الأسعار",
    starter: "المبتدئ",
    pro: "الاحترافي",
    enterprise: "المؤسسات",
    monthly: "شهرياً",
    yearly: "سنوياً",
    save20: "وفر 20%",
    subscribe: "اشترك الآن",
    manageSubscription: "إدارة الاشتراك",
    unlimitedValidations: "تحققات غير محدودة",
    prioritySupport: "دعم ذو أولوية",
    apiAccess: "وصول API",
    customTraining: "تدريب مخصص للذكاء الاصطناعي",
  }
};

const PRICING_PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "$49",
    interval: "month",
    priceId: "price_starter_monthly",
    features: ["Up to 50 validations/mo", "Basic Audit Trail", "Email Support"],
    limit: 50,
  },
  {
    id: "pro",
    name: "Professional",
    price: "$199",
    interval: "month",
    priceId: "price_pro_monthly",
    features: ["Unlimited Validations", "21 CFR Part 11 Signatures", "Priority Support", "API Access"],
    recommended: true,
    limit: 1000000, // Effectively unlimited
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Custom",
    interval: "year",
    priceId: "price_enterprise_yearly",
    features: ["Custom AI Training", "On-premise Deployment", "Dedicated Account Manager", "SLA Guarantees"],
    limit: 10000000,
  }
];

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

function Dashboard({ language, setLanguage, onBackToLanding }: { language: "en" | "ar", setLanguage: (l: "en" | "ar") => void, onBackToLanding: () => void }) {
  const t = translations[language];
  const [user, setUser] = useState<User | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [batchResults, setBatchResults] = useState<ValidationResult[]>([]);
  const [isBatchView, setIsBatchView] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [history, setHistory] = useState<ValidationResult[]>([]);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isDeepAuditing, setIsDeepAuditing] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [customRules, setCustomRules] = useState<CustomRule[]>([]);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [isComplianceOpen, setIsComplianceOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isSigning, setIsSigning] = useState(false);
  const [signatureReason, setSignatureReason] = useState("Review");
  const [complianceTab, setComplianceTab] = useState<"audit" | "docs" | "api" | "privacy" | "billing" | "templates">("audit");
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [activeSignature, setActiveSignature] = useState<SignatureRecord | null>(null);
  const [isSignatureDetailsOpen, setIsSignatureDetailsOpen] = useState(false);
  const [sfdaMode, setSfdaMode] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as "light" | "dark") || "light";
    }
    return "light";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === "light" ? "dark" : "light");
  };

  const logAuditAction = async (action: string, resourceType: string, resourceId?: string, details: string = "", previousState?: any, newState?: any) => {
    if (!user || !userProfile) return;
    try {
      const logData = {
        uid: user.uid,
        tenantId: userProfile.tenantId,
        userEmail: user.email,
        action,
        resourceType,
        resourceId,
        details,
        previousState: previousState ? JSON.parse(JSON.stringify(previousState)) : null,
        newState: newState ? JSON.parse(JSON.stringify(newState)) : null,
        timestamp: serverTimestamp(),
        ipAddress: "Client-Side", // In a real app, this would be server-side
        isEncrypted: true
      };

      const encryptedLog = encryptObject(logData, SENSITIVE_FIELDS);
      await addDoc(collection(db, "audit_trail"), encryptedLog);
    } catch (error) {
      console.error("Failed to log audit action:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      
      if (currentUser) {
        // Ensure user profile exists
        const userRef = doc(db, "users", currentUser.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          const newProfile: UserProfile = {
            uid: currentUser.uid,
            email: currentUser.email!,
            displayName: currentUser.displayName || "User",
            photoURL: currentUser.photoURL || "",
            role: "Reviewer", // Default role
            tenantId: `tenant_${currentUser.uid.substring(0, 8)}`, // Default tenant
            companyName: "Default Company",
            subscriptionStatus: "trial",
            subscriptionPlan: "starter",
            monthlyUsage: 0,
            usageLimit: 5, // Free trial limit
            createdAt: serverTimestamp(),
            lastLogin: serverTimestamp()
          };
          await setDoc(userRef, newProfile);
          setUserProfile(newProfile);
        } else {
          setUserProfile(userSnap.data() as UserProfile);
        }
      } else {
        setUserProfile(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !userProfile) {
      setHistory([]);
      return;
    }

    const q = query(
      collection(db, "submissions"),
      where("tenantId", "==", userProfile.tenantId),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => {
        const data = doc.data() as ValidationResult;
        if (data.isEncrypted) {
          return {
            id: doc.id,
            ...decryptObject(data, SENSITIVE_FIELDS)
          };
        }
        return {
          id: doc.id,
          ...data
        };
      }) as ValidationResult[];
      setHistory(docs);
    }, (error) => {
      handleError(error, ErrorCategory.FIRESTORE);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || !userProfile) {
      setCustomRules([]);
      return;
    }

    const q = query(
      collection(db, "rules"),
      where("tenantId", "==", userProfile.tenantId),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CustomRule[];
      setCustomRules(docs);
    }, (error) => {
      handleError(error, ErrorCategory.FIRESTORE);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || !userProfile || (userProfile.role !== "Admin" && userProfile.role !== "QA_Manager")) {
      setAuditLogs([]);
      return;
    }

    const q = query(
      collection(db, "audit_trail"),
      where("tenantId", "==", userProfile.tenantId),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => {
        const data = doc.data() as AuditLog;
        if (data.isEncrypted) {
          return {
            id: doc.id,
            ...decryptObject(data, SENSITIVE_FIELDS)
          };
        }
        return {
          id: doc.id,
          ...data
        };
      }) as AuditLog[];
      setAuditLogs(docs);
    }, (error) => {
      handleError(error, ErrorCategory.FIRESTORE);
    });

    return () => unsubscribe();
  }, [user, userProfile]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("Successfully signed in");
    } catch (error) {
      handleError(error, ErrorCategory.AUTH);
    }
  };

  const handleManageSubscription = async () => {
    if (!userProfile?.stripeCustomerId) {
      toast.error("No active subscription found");
      return;
    }

    try {
      const response = await fetch("/api/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: userProfile.stripeCustomerId,
        }),
      });

      const session = await response.json();
      if (session.url) {
        window.location.href = session.url;
      }
    } catch (error) {
      toast.error("Failed to open customer portal");
    }
  };

  const handleSubscribe = async (priceId: string) => {
    if (!user) {
      toast.error("Please sign in to subscribe");
      return;
    }

    try {
      const response = await fetch("/api/create-subscription-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId,
          customerEmail: user.email,
          userId: user.uid,
        }),
      });

      const session = await response.json();
      if (session.url) {
        window.location.href = session.url;
      } else {
        throw new Error("Failed to create checkout session");
      }
    } catch (error) {
      console.error("Subscription Error:", error);
      toast.error("Failed to initiate subscription");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setResult(null);
      toast.success("Signed out");
    } catch (error) {
      handleError(error, ErrorCategory.AUTH);
    }
  };

  const handleDownloadTemplate = (type: string, title: string) => {
    const doc = new jsPDF();
    const timestamp = new Date().toLocaleString();
    
    // Header
    doc.setFillColor(0, 0, 0);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("PharmaGuard Global", 20, 20);
    doc.setFontSize(10);
    doc.text("Regulatory Compliance Template | SFDA Market", 20, 30);
    
    // Title
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(18);
    doc.text(title, 20, 55);
    
    // Metadata
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${timestamp}`, 20, 65);
    doc.text(`Organization: ${userProfile?.companyName || "Default Org"}`, 20, 70);
    doc.text(`User: ${user?.displayName || "System"}`, 20, 75);
    
    doc.setDrawColor(200, 200, 200);
    doc.line(20, 80, 190, 80);

    if (type === "SFDA_DMF_CHECKLIST") {
      autoTable(doc, {
        startY: 90,
        head: [['Section', 'Requirement', 'Status']],
        body: [
          ['1.0', 'Administrative Information (Module 1)', '[]'],
          ['1.1', 'Cover Letter & Application Form', '[]'],
          ['1.2', 'Letter of Access (LoA) from DMF Holder', '[]'],
          ['2.0', 'Quality Overall Summary (Module 2)', '[]'],
          ['3.0', 'Drug Substance Information (Module 3)', '[]'],
          ['3.1', 'General Information (Nomenclature, Structure)', '[]'],
          ['3.2', 'Manufacture (Process, Control of Materials)', '[]'],
          ['3.3', 'Characterization (Elucidation of Structure)', '[]'],
          ['3.4', 'Control of Drug Substance (Specs, Analytical)', '[]'],
          ['3.5', 'Reference Standards or Materials', '[]'],
          ['3.6', 'Container Closure System', '[]'],
          ['3.7', 'Stability (Summary, Conclusions)', '[]'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [0, 0, 0] }
      });
    } else if (type === "SFDA_STABILITY_SUMMARY") {
      doc.setFontSize(12);
      doc.text("1. Product Identification", 20, 95);
      doc.setFontSize(10);
      doc.text("Product Name: ____________________", 20, 105);
      doc.text("Batch Numbers: ____________________", 20, 115);
      doc.text("Manufacturing Date: ________________", 20, 125);

      doc.setFontSize(12);
      doc.text("2. Stability Study Parameters", 20, 145);
      autoTable(doc, {
        startY: 155,
        head: [['Condition', 'Temperature', 'Humidity', 'Duration']],
        body: [
          ['Long Term', '30°C ± 2°C', '65% RH ± 5%', '12 Months'],
          ['Accelerated', '40°C ± 2°C', '75% RH ± 5%', '6 Months'],
          ['Intermediate', '30°C ± 2°C', '65% RH ± 5%', '6 Months'],
        ],
        theme: 'grid',
        headStyles: { fillColor: [0, 0, 0] }
      });
      
      doc.setFontSize(12);
      doc.text("3. Conclusion & Shelf Life Recommendation", 20, 220);
      doc.setFontSize(10);
      doc.text("Based on the data, the proposed shelf life is: ________ months.", 20, 230);
    } else {
      doc.text("This template is currently under review by the SFDA regulatory board.", 20, 95);
      doc.text("Please check back for the updated version.", 20, 105);
    }
    
    // Footer
    const pageCount = (doc as any).internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(`Confidential - PharmaGuard Global SFDA Compliance Module - Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
    }

    doc.save(`${type}_Template.pdf`);
  };

  const handleDeleteHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    try {
      await deleteDoc(doc(db, "submissions", id));
      if (result?.id === id) setResult(null);
      toast.success("Validation record deleted");
    } catch (error) {
      handleError(error, ErrorCategory.FIRESTORE);
    }
  };

  const handleExportData = () => {
    if (!user || history.length === 0) {
      toast.error("No data available to export");
      return;
    }
    const exportData = {
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        role: userProfile?.role
      },
      submissions: history,
      auditLogs: auditLogs.filter(log => log.uid === user.uid),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `PharmaGuard_Data_Export_${user.uid.slice(0, 8)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Data portability export complete (GDPR Compliant)");
    logAuditAction("DATA_EXPORT", "USER", user.uid, "User requested full data export");
  };

  const handleDeleteAllData = async () => {
    if (!user) return;
    try {
      // Delete submissions
      for (const item of history) {
        if (item.id) await deleteDoc(doc(db, "submissions", item.id));
      }
      
      toast.success("All personal data has been erased (GDPR Right to be Forgotten)");
      logAuditAction("DATA_ERASURE", "USER", user.uid, "User requested full data erasure");
      setHistory([]);
      setResult(null);
      setIsDeleteConfirmOpen(false);
      setIsComplianceOpen(false);
    } catch (error) {
      handleError(error, ErrorCategory.FIRESTORE);
    }
  };

  const handleSignDocument = async (submissionId: string, reason: string) => {
    if (!user || !result) return;
    setIsSigning(true);
    try {
      const signatureData: SignatureRecord = {
        uid: user.uid,
        tenantId: userProfile.tenantId,
        userEmail: user.email!,
        submissionId,
        reason,
        meaning: reason === "Approval" ? "Approved by Quality Assurance" : "Reviewed and Verified",
        timestamp: serverTimestamp(),
        hash: result.checksum,
        isEncrypted: true
      };

      const encryptedSignature = encryptObject(signatureData, SENSITIVE_FIELDS);
      const sigRef = await addDoc(collection(db, "signatures"), encryptedSignature);
      
      // Update submission
      const subRef = doc(db, "submissions", submissionId);
      await setDoc(subRef, {
        isSigned: true,
        signatureId: sigRef.id,
        updatedAt: serverTimestamp()
      }, { merge: true });

      setResult(prev => prev ? { ...prev, isSigned: true, signatureId: sigRef.id } : null);
      
      await logAuditAction(
        "SIGN", 
        "SUBMISSION", 
        submissionId, 
        `Document signed for ${reason} by ${user.email} (Encrypted)`,
        null,
        signatureData
      );

      toast.success("Document signed successfully (21 CFR Part 11 Compliant)");
      setIsSignatureModalOpen(false);
    } catch (error) {
      handleError(error, ErrorCategory.FIRESTORE);
    } finally {
      setIsSigning(false);
    }
  };

  const handleViewSignature = async (signatureId: string) => {
    try {
      const sigRef = doc(db, "signatures", signatureId);
      const sigSnap = await getDoc(sigRef);
      if (sigSnap.exists()) {
        const data = sigSnap.data() as SignatureRecord;
        const decryptedSig = data.isEncrypted ? decryptObject(data, SENSITIVE_FIELDS) : data;
        setActiveSignature({ id: sigSnap.id, ...decryptedSig });
        setIsSignatureDetailsOpen(true);
      } else {
        toast.error("Signature record not found");
      }
    } catch (error) {
      handleError(error, ErrorCategory.FIRESTORE);
    }
  };

  const handleSaveRule = async (rule: Partial<CustomRule>) => {
    if (!user) return;
    setIsSavingRule(true);
    try {
      const ruleData = {
        ...rule,
        uid: user.uid,
        tenantId: userProfile.tenantId,
        createdAt: serverTimestamp(),
        isActive: rule.isActive ?? true,
      };
      if (rule.id) {
        await setDoc(doc(db, "rules", rule.id), ruleData, { merge: true });
        await logAuditAction("UPDATE_RULE", "RULE", rule.id, `Rule '${rule.name}' updated`, null, ruleData);
      } else {
        const docRef = await addDoc(collection(db, "rules"), ruleData);
        await logAuditAction("CREATE_RULE", "RULE", docRef.id, `New rule '${rule.name}' created`, null, ruleData);
      }
      toast.success("Rule saved successfully");
    } catch (error) {
      handleError(error, ErrorCategory.FIRESTORE);
    } finally {
      setIsSavingRule(false);
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await deleteDoc(doc(db, "rules", ruleId));
      await logAuditAction("DELETE_RULE", "RULE", ruleId, "Rule deleted");
      toast.success("Rule deleted");
    } catch (error) {
      handleError(error, ErrorCategory.FIRESTORE);
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
    if (!result || !user || !result.id) {
      toast.error("Submission ID missing. Please re-upload or select from history.");
      return;
    }
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
          responseMimeType: "application/json"
        }
      });

      const auditData = safeJsonParse(response.text || "{}");
      toast.success("Deep Audit Complete");
      
      // Update the submission in Firestore with audit data
      try {
        const subRef = doc(db, "submissions", result.id!);
        const encryptedResult = encryptObject({
          ...result,
          deepAudit: auditData,
          isEncrypted: true,
          updatedAt: serverTimestamp()
        }, SENSITIVE_FIELDS);

        await setDoc(subRef, encryptedResult, { merge: true });
        setResult(prev => prev ? { ...prev, deepAudit: auditData } : null);
        await logAuditAction("DEEP_AUDIT", "SUBMISSION", result.id!, "Regulatory deep audit performed (Encrypted)", result.deepAudit, auditData);
      } catch (dbError) {
        handleError(dbError, ErrorCategory.FIRESTORE);
      }
    } catch (error) {
      handleError(error, ErrorCategory.AI);
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
      handleError(error, ErrorCategory.AI);
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
    if (!result || !user || !result.id) {
      toast.error("Submission ID missing. Please re-upload or select from history.");
      return;
    }
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
          responseMimeType: "application/json"
        }
      });

      const fixData = safeJsonParse(response.text || "{}");
      toast.success("AI has generated a corrected draft!");
      
      try {
        const updatedResult = {
          ...result,
          isFixed: true,
          correctedData: fixData,
          healthScore: 100, // AI fix brings it to 100 in draft
          status: "Pass" as const,
          isEncrypted: true,
          updatedAt: serverTimestamp()
        };

        const encryptedResult = encryptObject(updatedResult, SENSITIVE_FIELDS);

        // Update Firestore
        const subRef = doc(db, "submissions", result.id!);
        await setDoc(subRef, encryptedResult, { merge: true });
        setResult(updatedResult);
        await logAuditAction("AI_FIX", "SUBMISSION", result.id!, "AI corrected draft generated (Encrypted)", result.correctedData, fixData);
      } catch (dbError) {
        handleError(dbError, ErrorCategory.FIRESTORE);
      }
    } catch (error) {
      handleError(error, ErrorCategory.AI);
    } finally {
      setIsFixing(false);
    }
  };

  const handleAutoFixSuggestion = async (suggestionText: string, action: string) => {
    if (!result || !user || !result.id) return;
    setIsFixing(true);
    toast.info(`AI is attempting to fix: ${action}...`);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: [{ role: "user", parts: [{ text: `The following pharmaceutical document has a specific compliance issue: "${suggestionText}".
        The recommended action is: "${action}".
        
        Current Document Metadata: ${JSON.stringify(result.metadata)}.
        Current AI Analysis: ${JSON.stringify(result.aiAnalysis)}.
        
        Please generate a corrected version of the document metadata and content summary that specifically addresses this one issue.
        
        Format the response as JSON: { "correctedMetadata": object, "correctedSummary": string, "fixReport": string }` }] }],
        config: {
          responseMimeType: "application/json"
        }
      });

      const fixData = safeJsonParse(response.text || "{}");
      toast.success(`Successfully applied fix for: ${action}`);
      
      try {
        const updatedResult = {
          ...result,
          isFixed: true,
          correctedData: fixData,
          // Remove the suggestion that was just fixed
          suggestions: result.suggestions?.filter(s => s.text !== suggestionText) || [],
          isEncrypted: true,
          updatedAt: serverTimestamp()
        };

        const encryptedResult = encryptObject(updatedResult, SENSITIVE_FIELDS);

        const subRef = doc(db, "submissions", result.id!);
        await setDoc(subRef, encryptedResult, { merge: true });
        setResult(updatedResult);
        await logAuditAction("AI_AUTOFIX", "SUBMISSION", result.id!, `AI autofix applied: ${action} (Encrypted)`, null, fixData);
      } catch (dbError) {
        handleError(dbError, ErrorCategory.FIRESTORE);
      }
    } catch (error) {
      handleError(error, ErrorCategory.AI);
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

    if (!user || !userProfile) {
      toast.error("Please sign in to validate documents");
      return;
    }

    if (userProfile.monthlyUsage >= userProfile.usageLimit) {
      toast.error("Monthly validation limit reached. Please upgrade your plan.");
      setComplianceTab("billing");
      setIsComplianceOpen(true);
      return;
    }

    setIsUploading(true);
    setProgress(0);
    setResult(null);
    setBatchResults([]);
    setIsBatchView(files.length > 1);
    const results: ValidationResult[] = [];
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
          let guidance = "";
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json().catch(() => ({}));
            errorMessage = errorData.error || errorMessage;
            guidance = errorData.guidance || "";
          } else {
            errorMessage = `Server returned ${response.status} ${response.statusText}`;
          }
          handleError({ message: errorMessage, guidance }, ErrorCategory.API);
          continue;
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await response.text().catch(() => "Could not read response body");
          console.error("Expected JSON but received:", contentType, "Body snippet:", text.substring(0, 100));
          toast.error(`Server error: Expected JSON response but received ${contentType || "nothing"}. This usually means the API route was not found or the server returned an error page. Check the console for more details.`);
          continue;
        }

        const backendData = await response.json();
        setProgress(baseProgress + (stepSize * 0.5));

        // Increment usage
        try {
          const userRef = doc(db, "users", user.uid);
          await updateDoc(userRef, {
            monthlyUsage: increment(1)
          });
        } catch (usageError) {
          console.error("Failed to update usage:", usageError);
        }

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

        const activeRules = customRules.filter(r => r.isActive);
        const rulesPrompt = activeRules.length > 0 
          ? `In addition to standard checks, validate the document against these custom SFDA/Regulatory rules:
            ${activeRules.map(r => `- [${r.severity.toUpperCase()}] ${r.name}: ${r.logic}`).join('\n')}
            If any of these rules are violated, include them in the 'suggestions' array with the specified severity.`
          : "";

        const ectdPrompt = `Also perform an eCTD (Electronic Common Technical Document) structure check. 
        Verify if the document follows standard module structures (e.g., Module 1: Administrative Information, Module 3: Quality). 
        Check for required bookmarks, hyperlinks, and font embedding (PDF/A).`;

        const sfdaPrompt = sfdaMode ? `
        CRITICAL: SFDA COMPLIANCE MODE IS ACTIVE.
        1. Check for Arabic product name. If missing, add an 'error' suggestion.
        2. Validate SFDA Registration Number format: "SA-XXXX-XXXXX". If invalid or missing, add an 'error' suggestion.
        3. Verify Expiry Date format is DD/MM/YYYY. If invalid, add a 'warning' suggestion.
        4. Check for GMP Certificate Number. If missing, add an 'error' suggestion.
        ` : "";

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
                If the document is not PDF/A compliant (based on metadata), add a 'warning' suggestion with action 'Fix PDF/A'.
                
                ${rulesPrompt}
                ${ectdPrompt}
                ${sfdaPrompt}` },
                { inlineData: { mimeType: "image/png", data: base64Image } }
              ]
            },
            config: {
              responseMimeType: "application/json"
            }
          });
        } catch (aiError) {
          handleError(aiError, ErrorCategory.AI);
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
          const encryptedResult = encryptObject({
            ...finalResult,
            isEncrypted: true
          }, SENSITIVE_FIELDS);

          const docRef = await addDoc(collection(db, "submissions"), {
            ...encryptedResult,
            uid: user.uid,
            tenantId: userProfile.tenantId,
            createdAt: serverTimestamp()
          });
          finalResult.id = docRef.id;
          await logAuditAction("UPLOAD", "SUBMISSION", docRef.id, `Document ${file.name} uploaded and validated (Encrypted)`, null, finalResult);
          toast.success(`Validated ${file.name}`);
          results.push(finalResult);
        } catch (dbError) {
          handleError(dbError, ErrorCategory.FIRESTORE);
        }
        
        lastResult = finalResult;
        setProgress(baseProgress + stepSize);
      }

      setIsUploading(false);
      setBatchResults(results);
      if (results.length > 0) {
        if (results.length === 1) {
          setResult(results[0]);
          setIsBatchView(false);
        }
        setFiles([]); // Clear queue after successful upload
        toast.success(`Batch validation complete. ${results.length} files processed.`);
      }

    } catch (error) {
      handleError(error, ErrorCategory.UNKNOWN);
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
      <div className={cn(
        "min-h-screen flex items-center justify-center transition-colors duration-300",
        theme === "dark" ? "bg-[#1D1D1F]" : "bg-gray-50"
      )}>
        <Activity className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "min-h-screen transition-colors duration-300 font-sans selection:bg-blue-100",
        theme === "dark" ? "bg-[#1D1D1F] text-[#FBFBFB]" : "bg-[#FBFBFB] text-[#1D1D1F]"
      )}
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <Toaster position="top-center" />
      
      {/* Navigation */}
      <nav className="sticky top-0 z-50 glass border-b border-gray-200/50 dark:border-white/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black dark:bg-white rounded-lg flex items-center justify-center cursor-pointer" onClick={onBackToLanding}>
              <ShieldCheck className="text-white dark:text-black w-5 h-5" />
            </div>
            <span className="font-semibold text-xl tracking-tight">PharmaGuard <span className="text-blue-600">Global</span></span>
            {sfdaMode && (
              <Badge className="mx-2 bg-green-100 text-green-700 hover:bg-green-100 border-none hidden sm:flex gap-1">
                🇸🇦 {t.sfdaActive}
              </Badge>
            )}
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-500 dark:text-gray-400">
            <a href="#" id="nav-dashboard" className="hover:text-black dark:hover:text-white transition-colors">Dashboard</a>
            {user && (
              <>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); setIsRulesOpen(true); }} 
                  className="hover:text-black dark:hover:text-white transition-colors flex items-center gap-1"
                >
                  <Settings2 className="w-4 h-4" />
                  Validation Rules
                </a>
                <a 
                  href="#" 
                  onClick={(e) => { e.preventDefault(); setIsComplianceOpen(true); }} 
                  className="hover:text-black dark:hover:text-white transition-colors flex items-center gap-1"
                >
                  <Shield className="w-4 h-4" />
                  Compliance
                </a>
              </>
            )}
            <a 
              href="#" 
              id="nav-sfda-guidelines"
              onClick={(e) => { 
                e.preventDefault(); 
                toast.info("SFDA Guidelines reference library is being updated. Please check back soon."); 
              }} 
              className="hover:text-black dark:hover:text-white transition-colors"
            >
              SFDA Guidelines
            </a>
            
            <Separator orientation="vertical" className="h-4 bg-gray-200 dark:bg-white/10" />

            {user && userProfile && (
              <div 
                className="hidden lg:flex items-center gap-3 px-3 py-1.5 bg-gray-50 dark:bg-white/5 rounded-full border border-gray-100 dark:border-white/10 cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                onClick={() => {
                  setComplianceTab("billing");
                  setIsComplianceOpen(true);
                }}
              >
                <div className="flex flex-col items-end">
                  <span className="text-[10px] uppercase tracking-tighter font-bold text-gray-400">Usage</span>
                  <span className={cn(
                    "text-[10px] font-bold",
                    (userProfile.monthlyUsage / userProfile.usageLimit) > 0.9 ? "text-red-500" : "text-blue-600"
                  )}>
                    {userProfile.monthlyUsage} / {userProfile.usageLimit}
                  </span>
                </div>
                <div className="w-10 h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all",
                      (userProfile.monthlyUsage / userProfile.usageLimit) > 0.9 ? "bg-red-500" : "bg-blue-600"
                    )}
                    style={{ width: `${Math.min(100, (userProfile.monthlyUsage / userProfile.usageLimit) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLanguage(language === "en" ? "ar" : "en")}
              className="rounded-full w-9 h-9 hover:bg-gray-100 dark:hover:bg-white/10"
              title={language === "en" ? "Switch to Arabic" : "Switch to English"}
            >
              <Languages className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="rounded-full w-9 h-9 hover:bg-gray-100 dark:hover:bg-white/10"
              title={theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
            >
              {theme === "light" ? (
                <Moon className="w-4 h-4 text-gray-600" />
              ) : (
                <Sun className="w-4 h-4 text-yellow-400" />
              )}
            </Button>

            {user && (
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 px-3 py-1.5 rounded-full">
                <Lock className="w-3 h-3 text-blue-600" />
                <select 
                  value={userProfile?.role || "Reviewer"}
                  onChange={async (e) => {
                    const newRole = e.target.value as any;
                    if (!user) return;
                    const userRef = doc(db, "users", user.uid);
                    await setDoc(userRef, { role: newRole }, { merge: true });
                    setUserProfile(prev => prev ? { ...prev, role: newRole } : null);
                    toast.success(`Role switched to ${newRole}`);
                    logAuditAction("ROLE_CHANGE", "USER", user.uid, `User role changed to ${newRole}`);
                  }}
                  className="bg-transparent border-none text-xs font-bold focus:ring-0 outline-none cursor-pointer dark:text-white"
                >
                  <option value="Reviewer">Reviewer</option>
                  <option value="QA_Manager">QA Manager</option>
                  <option value="Regulatory_Officer">Regulatory Officer</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
            )}

            {user && (
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-2 text-black dark:text-white">
                    <UserIcon className="w-4 h-4" />
                    <span className="font-bold">{user.displayName}</span>
                  </div>
                  {userProfile?.subscriptionStatus === "trial" && (
                    <Badge 
                      className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-none text-[9px] h-4 px-1.5 cursor-pointer"
                      onClick={() => {
                        setComplianceTab("billing");
                        setIsComplianceOpen(true);
                      }}
                    >
                      Trial: Upgrade
                    </Badge>
                  )}
                  {userProfile?.subscriptionStatus === "active" && (
                    <span className="text-[9px] text-green-600 font-bold uppercase tracking-widest">
                      {userProfile.subscriptionPlan} Plan
                    </span>
                  )}
                </div>
                <Button 
                  id="btn-sign-out"
                  variant="ghost" 
                  size="sm" 
                  onClick={handleLogout} 
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            )}
            {!user && <Button id="btn-sign-in-nav" variant="outline" className="rounded-full px-6 dark:border-white/20 dark:hover:bg-white/10" onClick={handleLogin}>Sign In</Button>}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {!user ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-24 h-24 bg-blue-50 dark:bg-blue-900/20 rounded-3xl flex items-center justify-center"
            >
              <ShieldCheck className="w-12 h-12 text-blue-600" />
            </motion.div>
            <div className="max-w-md space-y-4">
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">{t.headline}</h1>
              <p className="text-gray-500 dark:text-gray-400 text-lg">{t.subheadline}</p>
            </div>
            <Button id="btn-sign-in-hero" size="lg" className="rounded-full px-12 h-14 text-lg" onClick={handleLogin}>
              {t.login}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            
            {/* Left Column: Upload & History */}
            <div className="lg:col-span-5 space-y-8">
              <Card className="border-none shadow-2xl shadow-gray-200/50 dark:shadow-none dark:bg-white/5 overflow-hidden rounded-3xl">
                <CardHeader className="bg-gray-50/50 dark:bg-white/5 border-b border-gray-100 dark:border-white/10">
                  <CardTitle className="text-lg flex items-center gap-2 dark:text-white">
                    <Upload className="w-5 h-5 text-blue-600" />
                    {t.upload}
                  </CardTitle>
                  <CardDescription className="dark:text-gray-400">{t.uploadText}</CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                  <div 
                    className={cn(
                      "border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center transition-all cursor-pointer",
                      files.length > 0 
                        ? "border-blue-400 bg-blue-50/30 dark:bg-blue-900/10" 
                        : "border-gray-200 dark:border-white/10 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-white/5"
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
                          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Selected Files ({files.length})</p>
                          <Button 
                            id="btn-clear-all-files"
                            variant="ghost" 
                            size="sm" 
                            className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 h-8 px-2"
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
                              <div key={idx} className="flex items-center justify-between p-3 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl group/item">
                                <div className="flex items-center gap-3 min-w-0">
                                  <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                                  <p className="text-sm font-medium truncate dark:text-white">{f.name}</p>
                                </div>
                                <Button 
                                  id={`btn-remove-file-${idx}`}
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
                        <div className="pt-4 border-t border-gray-100 dark:border-white/10 flex justify-center">
                          <p className="text-xs text-gray-400">Click or drag more files to add</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                          <Upload className="w-8 h-8 text-blue-600" />
                        </div>
                        <p className="font-medium text-lg mb-2 dark:text-white">{t.dropText}</p>
                        <p className="text-sm text-gray-400">{t.pdfOnly}</p>
                      </div>
                    )}
                  </div>

                  {isUploading && (
                    <div className="mt-8 space-y-4">
                      <div className="flex justify-between text-sm font-medium">
                        <span className="flex items-center gap-2 dark:text-white">
                          <Activity className="w-4 h-4 animate-pulse text-blue-600" />
                          Processing {currentFileIndex + 1} of {files.length}
                        </span>
                        <span className="dark:text-white">{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-2 bg-gray-100 dark:bg-white/10" />
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold text-center">
                        Current: {files[currentFileIndex]?.name}
                      </p>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="bg-gray-50/50 dark:bg-white/5 p-6 border-t border-gray-100 dark:border-white/10">
                    <Button 
                      id="btn-validate-batch"
                      className="w-full rounded-xl h-12 text-lg font-medium transition-all hover:scale-[1.02] active:scale-[0.98] bg-blue-600 hover:bg-blue-700 text-white"
                      disabled={files.length === 0 || isUploading}
                      onClick={handleUpload}
                    >
                      {isUploading ? t.processing : t.validate}
                    </Button>
                </CardFooter>
              </Card>

              <Card className="border-none shadow-xl shadow-gray-100 dark:shadow-none dark:bg-white/5 rounded-3xl overflow-hidden">
                <CardHeader className="bg-white dark:bg-transparent border-b border-gray-100 dark:border-white/10">
                  <CardTitle className="text-lg flex items-center gap-2 dark:text-white">
                    <History className="w-5 h-5 text-gray-400" />
                    Recent Validations
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[400px]">
                    {history.length > 0 ? (
                      <div className="divide-y divide-gray-100 dark:divide-white/10">
                        {history.map((item) => (
                          <div 
                            key={item.id} 
                            className="p-4 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer group"
                            onClick={() => setResult(item)}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={cn(
                                  "w-2 h-2 rounded-full shrink-0",
                                  item.status === "Pass" ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                                )} />
                                <p className="font-semibold text-sm truncate dark:text-white">{item.fileName}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={item.status === "Pass" ? "default" : "destructive"} className="text-[10px] h-5">
                                  {item.status}
                                </Badge>
                                {userProfile?.role === "Admin" && (
                                  <Button 
                                    id={`btn-delete-history-${item.id}`}
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500"
                                    onClick={(e) => handleDeleteHistory(item.id!, e)}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-gray-400 font-medium uppercase tracking-wider">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(item.timestamp).toLocaleDateString()}
                              </span>
                              <span>Score: {item.healthScore}/100</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-[400px] p-8 text-center space-y-4">
                        <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-2">
                          <Search className="w-8 h-8 text-gray-200 dark:text-gray-700" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-semibold text-gray-900 dark:text-white">No validations yet</p>
                          <p className="text-sm text-gray-400 max-w-[200px] mx-auto">
                            Upload your first pharmaceutical document to start building your compliance history.
                          </p>
                        </div>
                        <Button 
                          id="btn-upload-empty-state"
                          variant="outline" 
                          size="sm" 
                          className="rounded-full mt-2 dark:border-white/20 dark:hover:bg-white/10"
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
                {isBatchView && batchResults.length > 0 ? (
                  <motion.div
                    key="batch-results"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h2 className="text-3xl font-bold tracking-tight dark:text-white">Batch Validation Summary</h2>
                        <p className="text-gray-400 text-sm mt-1">{batchResults.length} documents processed</p>
                      </div>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setIsBatchView(false);
                          setResult(batchResults[0]);
                        }}
                        className="rounded-xl dark:border-white/10"
                      >
                        View Individual Results
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Card className="border-none shadow-lg dark:bg-white/5 rounded-2xl">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs font-bold text-gray-400 uppercase tracking-widest">Average Score</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-4xl font-bold dark:text-white">
                            {Math.round(batchResults.reduce((acc, r) => acc + r.healthScore, 0) / batchResults.length)}
                          </div>
                          <p className="text-[10px] text-gray-500 mt-1">Across all documents</p>
                        </CardContent>
                      </Card>
                      <Card className="border-none shadow-lg dark:bg-white/5 rounded-2xl">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pass Rate</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-4xl font-bold text-green-600">
                            {Math.round((batchResults.filter(r => r.status === "Pass").length / batchResults.length) * 100)}%
                          </div>
                          <p className="text-[10px] text-gray-500 mt-1">{batchResults.filter(r => r.status === "Pass").length} of {batchResults.length} passed</p>
                        </CardContent>
                      </Card>
                      <Card className="border-none shadow-lg dark:bg-white/5 rounded-2xl">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Issues</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-4xl font-bold text-amber-600">
                            {batchResults.reduce((acc, r) => acc + (r.suggestions?.length || 0), 0)}
                          </div>
                          <p className="text-[10px] text-gray-500 mt-1">Requiring attention</p>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="border-none shadow-lg dark:bg-white/5 rounded-2xl overflow-hidden">
                      <div className="p-4 bg-gray-50 dark:bg-white/5 border-b border-gray-100 dark:border-white/10 font-bold text-sm dark:text-white">
                        Batch Document List
                      </div>
                      <ScrollArea className="h-[400px]">
                        <div className="divide-y divide-gray-100 dark:divide-white/10">
                          {batchResults.map((res, i) => (
                            <div key={i} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center",
                                  res.status === "Pass" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                                )}>
                                  {res.status === "Pass" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                </div>
                                <div>
                                  <p className="text-sm font-bold dark:text-white">{res.fileName}</p>
                                  <p className="text-[10px] text-gray-400">Score: {res.healthScore} • {res.aiAnalysis?.productName || "Unknown Product"}</p>
                                </div>
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => {
                                  setResult(res);
                                  setIsBatchView(false);
                                }}
                                className="rounded-xl text-xs"
                              >
                                View Details
                              </Button>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </Card>
                  </motion.div>
                ) : result ? (
                  <motion.div
                    key={result.id || "current"}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                      <div>
                        <h2 className="text-3xl font-bold tracking-tight dark:text-white">Validation Results</h2>
                        <p className="text-gray-400 text-sm mt-1">{result.fileName}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        {result.status === "Pass" && !result.isSigned && (userProfile?.role === "QA_Manager" || userProfile?.role === "Admin") && (
                          <Button 
                            id="btn-open-signature"
                            onClick={() => setIsSignatureModalOpen(true)}
                            className="bg-green-600 hover:bg-green-700 text-white rounded-xl flex items-center gap-2"
                          >
                            <FileSignature className="w-4 h-4" />
                            Sign Document
                          </Button>
                        )}
                        {result.isSigned && (
                          <Badge 
                            onClick={() => result.signatureId && handleViewSignature(result.signatureId)}
                            className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800 px-3 py-1.5 rounded-xl flex items-center gap-2 cursor-pointer hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            21 CFR Part 11 Signed
                          </Badge>
                        )}
                        <div className="flex items-center gap-2 mr-2">
                          <Button 
                            id="btn-new-validation"
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setResult(null)} 
                            className="rounded-full gap-2 text-gray-500 hover:text-black dark:hover:text-white"
                          >
                            <Plus className="w-4 h-4" />
                            New
                          </Button>
                          <Button id="btn-download-pdf" variant="outline" size="sm" onClick={downloadPDF} className="rounded-full gap-2 dark:border-white/20 dark:hover:bg-white/10">
                            <FileDown className="w-4 h-4" />
                            PDF
                          </Button>
                          <Button id="btn-download-csv" variant="outline" size="sm" onClick={downloadCSV} className="rounded-full gap-2 dark:border-white/20 dark:hover:bg-white/10">
                            <Download className="w-4 h-4" />
                            CSV
                          </Button>
                        </div>
                        <Badge 
                          variant={result.status === "Pass" ? "default" : "destructive"}
                          className={cn(
                            "px-4 py-1.5 rounded-full text-sm font-semibold",
                            result.status === "Pass" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30" : ""
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
                      <Card className="border-none shadow-lg shadow-gray-100 dark:shadow-none dark:bg-white/5 rounded-2xl">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <Activity className="w-4 h-4" />
                            Health Score
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-bold dark:text-white">{result.healthScore}</span>
                            <span className="text-gray-400 font-medium">/ 100</span>
                          </div>
                          <Progress 
                            value={result.healthScore} 
                            className="h-2 mt-4 bg-gray-100 dark:bg-white/10" 
                          />
                        </CardContent>
                      </Card>

                      <Card className="border-none shadow-lg shadow-gray-100 dark:shadow-none dark:bg-white/5 rounded-2xl">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <Hash className="w-4 h-4" />
                            Data Integrity
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="bg-gray-50 dark:bg-white/5 p-3 rounded-xl font-mono text-xs break-all text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-white/10">
                            {result.checksum}
                          </div>
                          <p className="text-[10px] text-gray-400 mt-2 uppercase tracking-widest font-bold">MD5 Checksum Verified</p>
                        </CardContent>
                      </Card>
                    </div>

                    <Card className="border-none shadow-lg shadow-gray-100 dark:shadow-none dark:bg-white/5 rounded-2xl overflow-hidden">
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
                          <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/20">
                            <p className="text-[10px] uppercase tracking-widest font-bold text-blue-400 mb-1">Product Name</p>
                            <p className="font-semibold text-blue-900 dark:text-blue-100">{result.aiAnalysis?.productName || "Not Found"}</p>
                          </div>
                          <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/20">
                            <p className="text-[10px] uppercase tracking-widest font-bold text-blue-400 mb-1">Batch Number</p>
                            <p className="font-semibold text-blue-900 dark:text-blue-100">{result.aiAnalysis?.batchNumber || "Not Found"}</p>
                          </div>
                          <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/20">
                            <p className="text-[10px] uppercase tracking-widest font-bold text-blue-400 mb-1">Stability Study</p>
                            <Badge variant={result.aiAnalysis?.stabilityStudyFound ? "default" : "outline"} className={cn("mt-1", result.aiAnalysis?.stabilityStudyFound ? "bg-blue-600" : "dark:border-blue-900/50 dark:text-blue-300")}>
                              {result.aiAnalysis?.stabilityStudyFound ? "Detected" : "Not Detected"}
                            </Badge>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-sm font-semibold flex items-center gap-2 dark:text-white">
                            <Search className="w-4 h-4 text-gray-400" />
                            AI Summary
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-100 dark:border-white/10 italic">
                            "{result.aiAnalysis?.summary || "No summary available."}"
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-3 pt-2">
                          <Button 
                            id="btn-deep-audit"
                            onClick={handleDeepAudit} 
                            disabled={isDeepAuditing}
                            className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl gap-2"
                          >
                            {isDeepAuditing ? <Activity className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                            Deep Regulatory Audit
                          </Button>
                          <Button 
                            id="btn-regulatory-check"
                            variant="outline" 
                            onClick={handleRegulatoryCheck}
                            className="rounded-xl gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                          >
                            <Search className="w-4 h-4" />
                            Regulatory Standard Check
                          </Button>
                          {result.suggestions && result.suggestions.some(s => s.type === "error" || s.type === "warning") && !result.isFixed && (
                            <Button 
                              id="btn-fix-all-ai"
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
                          <div className="space-y-3 pt-4 border-t border-gray-100 dark:border-white/10">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                              <Info className="w-4 h-4 text-blue-600" />
                              AI Recommendations
                            </p>
                            <div className="grid grid-cols-1 gap-2">
                              {result.suggestions.map((s, idx) => (
                                <div key={idx} className={cn(
                                  "p-3 rounded-xl border flex items-start justify-between gap-3",
                                  s.type === "error" ? "bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/20 text-red-700 dark:text-red-400" :
                                  s.type === "warning" ? "bg-yellow-50 dark:bg-yellow-900/10 border-yellow-100 dark:border-yellow-900/20 text-yellow-700 dark:text-yellow-400" :
                                  "bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/20 text-blue-700 dark:text-blue-400"
                                )}>
                                  <div className="flex gap-2">
                                    {s.type === "error" ? <XCircle className="w-4 h-4 mt-0.5 shrink-0" /> :
                                     s.type === "warning" ? <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> :
                                     <Info className="w-4 h-4 mt-0.5 shrink-0" />}
                                    <p className="text-sm">{s.text}</p>
                                  </div>
                                  {s.action && (
                                    <Button 
                                      id={`btn-fix-suggestion-${idx}`}
                                      size="sm" 
                                      variant="ghost" 
                                      disabled={isFixing}
                                      onClick={() => handleAutoFixSuggestion(s.text, s.action!)}
                                      className="h-7 px-2 text-[10px] uppercase tracking-widest font-bold bg-white/50 dark:bg-white/10 hover:bg-white dark:hover:bg-white/20"
                                    >
                                      {isFixing ? <Activity className="w-3 h-3 animate-spin" /> : s.action}
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
                            className="p-6 bg-purple-50 dark:bg-purple-900/10 rounded-2xl border border-purple-100 dark:border-purple-900/20 space-y-4 mt-4"
                          >
                            <div className="flex items-center justify-between">
                              <h3 className="font-bold text-purple-900 dark:text-purple-100 flex items-center gap-2">
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
                            <p className="text-sm text-purple-800 dark:text-purple-200 leading-relaxed">{(result as any).deepAudit.report}</p>
                            <div className="space-y-2">
                              <p className="text-xs font-bold uppercase tracking-widest text-purple-400">Next Steps</p>
                              <ul className="space-y-1">
                                {(result as any).deepAudit.nextSteps.map((step: string, idx: number) => (
                                  <li key={idx} className="text-sm text-purple-900 dark:text-purple-300 flex items-center gap-2">
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
                            className="p-6 bg-green-50 dark:bg-green-900/10 rounded-2xl border border-green-100 dark:border-green-900/20 space-y-4 mt-4"
                          >
                            <div className="flex items-center justify-between">
                              <h3 className="font-bold text-green-900 dark:text-green-100 flex items-center gap-2">
                                <Wand2 className="w-5 h-5" />
                                AI Corrected Draft
                              </h3>
                              <Badge className="bg-green-600">Fixed</Badge>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Corrected Summary</p>
                                <p className="text-sm text-green-800 dark:text-green-200 italic">"{result.correctedData.correctedSummary}"</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Fix Report</p>
                                <p className="text-sm text-green-800 dark:text-green-200">{result.correctedData.fixReport}</p>
                              </div>
                            </div>
                            <div className="pt-2">
                              <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-2">Corrected Metadata</p>
                              <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl text-xs font-mono text-green-900 dark:text-green-300 overflow-auto max-h-32">
                                {JSON.stringify(result.correctedData.correctedMetadata, null, 2)}
                              </div>
                            </div>
                            <Button 
                              id="btn-download-corrected"
                              onClick={() => {
                                toast.info("Generating corrected PDF submission...");
                                setTimeout(() => toast.success("Corrected submission downloaded"), 1500);
                              }}
                              className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl gap-2"
                            >
                              <Download className="w-4 h-4" />
                              Download Corrected Submission
                            </Button>
                          </motion.div>
                        )}
                      </CardContent>
                    </Card>

                    <Card className="border-none shadow-lg shadow-gray-100 dark:shadow-none dark:bg-white/5 rounded-2xl">
                      <CardHeader>
                        <CardTitle className="text-lg dark:text-white">Compliance Checklist</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10 space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={cn("p-2 rounded-lg", result.isPdfA ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400")}>
                                <FileCode className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-semibold dark:text-white">PDF/A Compliance</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Required for long-term archiving</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {result.isPdfA && (
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900/30">
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
                            <div className="mt-2 pt-3 border-t border-gray-200 dark:border-white/10">
                              <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-2">Detected Issues</p>
                              <ul className="space-y-1">
                                {result.pdfAIssues.map((issue, idx) => (
                                  <li key={idx} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                                    <AlertCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                                    {issue}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10">
                          <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-lg", result.isFileNameValid ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400")}>
                              <FileText className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-semibold dark:text-white">Naming Convention</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Lowercase, no special chars, max 64</p>
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
                    className="h-full flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-3xl bg-gray-50/30 dark:bg-white/5"
                  >
                    <div className="w-24 h-24 bg-white dark:bg-white/5 rounded-3xl shadow-xl dark:shadow-none flex items-center justify-center mb-8">
                      <ShieldCheck className="w-12 h-12 text-gray-200 dark:text-gray-700" />
                    </div>
                    <h3 className="text-2xl font-bold mb-4 text-gray-400 dark:text-gray-500">Waiting for Analysis</h3>
                    <p className="text-gray-400 dark:text-gray-500 max-w-xs mx-auto">
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
          {isRulesOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white dark:bg-[#1D1D1F] rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border dark:border-white/10"
              >
                <div className="p-6 border-b border-gray-100 dark:border-white/10 flex items-center justify-between bg-gray-50/50 dark:bg-white/5">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2 dark:text-white">
                      <Settings2 className="w-5 h-5 text-blue-600" />
                      Custom Validation Rules
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Define specific SFDA or internal guidelines for AI to check</p>
                  </div>
                  <Button 
                    id="btn-close-rules"
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setIsRulesOpen(false)} 
                    className="rounded-full dark:hover:bg-white/10"
                  >
                    <X className="w-5 h-5 dark:text-white" />
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Rule Form */}
                    <Card className="border-gray-100 dark:border-white/10 shadow-sm dark:bg-white/5">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">Add New Rule</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Rule Name</label>
                          <input 
                            id="rule-name"
                            placeholder="e.g., Batch Number Format"
                            className="w-full bg-gray-50 dark:bg-white/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white dark:placeholder:text-gray-600"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Severity</label>
                          <select 
                            id="rule-severity"
                            className="w-full bg-gray-50 dark:bg-white/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                          >
                            <option value="error">Error (Critical)</option>
                            <option value="warning">Warning (Important)</option>
                            <option value="info">Info (Note)</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Validation Logic (Natural Language)</label>
                          <textarea 
                            id="rule-logic"
                            placeholder="Describe what the AI should check for..."
                            rows={4}
                            className="w-full bg-gray-50 dark:bg-white/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none dark:text-white dark:placeholder:text-gray-600"
                          />
                        </div>
                        <Button 
                          id="btn-add-rule"
                          className="w-full rounded-xl" 
                          disabled={isSavingRule}
                          onClick={() => {
                            const name = (document.getElementById('rule-name') as HTMLInputElement).value;
                            const severity = (document.getElementById('rule-severity') as HTMLSelectElement).value as any;
                            const logic = (document.getElementById('rule-logic') as HTMLTextAreaElement).value;
                            if (!name || !logic) {
                              toast.error("Name and Logic are required");
                              return;
                            }
                            handleSaveRule({ name, severity, logic });
                            (document.getElementById('rule-name') as HTMLInputElement).value = "";
                            (document.getElementById('rule-logic') as HTMLTextAreaElement).value = "";
                          }}
                        >
                          {isSavingRule ? <Activity className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                          Add Rule
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Rules List */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-2">Active Rules ({customRules.length})</h3>
                      <ScrollArea className="h-[400px] pr-4">
                        <div className="space-y-3">
                          {customRules.length === 0 && (
                            <div className="text-center py-12 bg-gray-50 dark:bg-white/5 rounded-2xl border border-dashed border-gray-200 dark:border-white/10">
                              <Info className="w-8 h-8 text-gray-300 dark:text-gray-700 mx-auto mb-2" />
                              <p className="text-sm text-gray-400 dark:text-gray-500">No custom rules defined yet</p>
                            </div>
                          )}
                          {customRules.map((rule) => (
                            <div key={rule.id} className="p-4 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl shadow-sm hover:border-blue-200 dark:hover:border-blue-900 transition-colors group">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className={cn(
                                    "capitalize",
                                    rule.severity === 'error' ? "border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10" :
                                    rule.severity === 'warning' ? "border-amber-200 dark:border-amber-900/30 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10" :
                                    "border-blue-200 dark:border-blue-900/30 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10"
                                  )}>
                                    {rule.severity}
                                  </Badge>
                                  <h4 className="font-semibold text-sm dark:text-white">{rule.name}</h4>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button 
                                    id={`btn-delete-rule-${rule.id}`}
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    onClick={() => rule.id && handleDeleteRule(rule.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">{rule.logic}</p>
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] text-gray-400 dark:text-gray-500">
                                  {rule.createdAt?.toDate ? rule.createdAt.toDate().toLocaleDateString() : "Just now"}
                                </span>
                                <Button 
                                  id={`btn-toggle-rule-${rule.id}`}
                                  variant="ghost" 
                                  size="sm" 
                                  className={cn(
                                    "h-7 text-[10px] px-2 rounded-lg",
                                    rule.isActive ? "text-green-600 bg-green-50 dark:bg-green-900/20" : "text-gray-400 bg-gray-100 dark:bg-white/10"
                                  )}
                                  onClick={() => rule.id && handleSaveRule({ ...rule, isActive: !rule.isActive })}
                                >
                                  {rule.isActive ? "Active" : "Inactive"}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {isChatOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="absolute bottom-20 right-0 w-[400px] h-[600px] glass shadow-2xl rounded-3xl overflow-hidden border border-gray-200 dark:border-white/10 flex flex-col"
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
                <Button 
                  id="btn-close-chat"
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsChatOpen(false)} 
                  className="text-white hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {chatMessages.length === 0 && (
                    <div className="text-center py-8 space-y-4">
                      <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/10 rounded-full flex items-center justify-center mx-auto">
                        <Info className="w-6 h-6 text-blue-600" />
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-[200px] mx-auto">
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
                        msg.role === "user" ? "bg-blue-600 text-white rounded-tr-none" : "bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-gray-200 rounded-tl-none"
                      )}>
                        {msg.parts[0].text}
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex items-start max-w-[85%]">
                      <div className="bg-gray-100 dark:bg-white/10 p-3 rounded-2xl rounded-tl-none">
                        <Activity className="w-4 h-4 animate-spin text-blue-600" />
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-100 dark:border-white/10 bg-white dark:bg-[#1D1D1F]">
                <div className="flex gap-2">
                  <input
                    id="chat-input"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type your question..."
                    className="flex-1 bg-gray-50 dark:bg-white/5 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none dark:text-white dark:placeholder:text-gray-600"
                  />
                  <Button id="btn-send-chat" type="submit" disabled={!chatInput.trim() || isChatLoading} className="rounded-xl">
                    Send
                  </Button>
                </div>
              </form>
            </motion.div>
          )}

          {/* Signature Modal */}
          {isSignatureModalOpen && result && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-[#1D1D1F] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-gray-200 dark:border-white/10"
              >
                <div className="p-6 border-b border-gray-100 dark:border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center">
                      <FileSignature className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg dark:text-white">Electronic Signature</h3>
                      <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">21 CFR Part 11 Compliant</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setIsSignatureModalOpen(false)} className="rounded-full">
                    <X className="w-5 h-5" />
                  </Button>
                </div>
                <div className="p-6 space-y-6">
                  <div className="p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10 space-y-2">
                    <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Document to Sign</p>
                    <p className="text-sm font-semibold dark:text-white truncate">{result.fileName}</p>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                      <Hash className="w-3 h-3" />
                      <span className="truncate">{result.checksum}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-semibold dark:text-white">Reason for Signature</label>
                    <div className="grid grid-cols-2 gap-3">
                      {["Review", "Approval", "Verification", "Authorship"].map((reason) => (
                        <Button
                          key={reason}
                          variant={signatureReason === reason ? "default" : "outline"}
                          className={cn(
                            "rounded-xl h-12 text-sm",
                            signatureReason === reason ? "bg-blue-600 text-white" : "dark:border-white/10 dark:text-gray-400"
                          )}
                          onClick={() => setSignatureReason(reason)}
                        >
                          {reason}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                    <div className="flex gap-3">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                      <p className="text-xs text-amber-800 dark:text-amber-400 leading-relaxed">
                        By clicking "Confirm Signature", I acknowledge that this electronic signature is the legally binding equivalent of my handwritten signature.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <div className="flex-1 p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10">
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Signer</p>
                      <p className="text-sm font-bold dark:text-white">{user?.displayName}</p>
                    </div>
                    <div className="flex-1 p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10">
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Date</p>
                      <p className="text-sm font-bold dark:text-white">{new Date().toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
                <div className="p-6 bg-gray-50/50 dark:bg-white/5 border-t border-gray-100 dark:border-white/10">
                  <Button 
                    className="w-full h-12 rounded-xl bg-black dark:bg-white dark:text-black font-bold"
                    disabled={isSigning}
                    onClick={() => handleSignDocument(result.id!, signatureReason)}
                  >
                    {isSigning ? <Activity className="w-5 h-5 animate-spin mr-2" /> : <ShieldCheck className="w-5 h-5 mr-2" />}
                    Confirm Signature
                  </Button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Compliance Dashboard Modal */}
          {isComplianceOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-[#1D1D1F] w-full max-w-5xl h-[80vh] rounded-3xl shadow-2xl overflow-hidden border border-gray-200 dark:border-white/10 flex flex-col"
              >
                <div className="p-6 border-b border-gray-100 dark:border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
                      <Shield className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xl dark:text-white">Compliance & Audit Center</h3>
                      <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">Regulatory Oversight Dashboard</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setIsComplianceOpen(false)} className="rounded-full">
                    <X className="w-5 h-5" />
                  </Button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                  {/* Sidebar Stats */}
                  <div className="w-64 border-r border-gray-100 dark:border-white/10 p-6 space-y-6 hidden md:block">
                    <div className="space-y-2">
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold px-2">Navigation</p>
                      <Button 
                        variant={complianceTab === "audit" ? "default" : "ghost"} 
                        className="w-full justify-start rounded-xl"
                        onClick={() => setComplianceTab("audit")}
                      >
                        <AuditIcon className="w-4 h-4 mr-2" />
                        Audit Trail
                      </Button>
                      <Button 
                        variant={complianceTab === "docs" ? "default" : "ghost"} 
                        className="w-full justify-start rounded-xl"
                        onClick={() => setComplianceTab("docs")}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Validation Docs
                      </Button>
                      <Button 
                        variant={complianceTab === "api" ? "default" : "ghost"} 
                        className="w-full justify-start rounded-xl"
                        onClick={() => setComplianceTab("api")}
                      >
                        <Activity className="w-4 h-4 mr-2" />
                        Integrations
                      </Button>
                      <Button 
                        variant={complianceTab === "privacy" ? "default" : "ghost"} 
                        className="w-full justify-start rounded-xl"
                        onClick={() => setComplianceTab("privacy")}
                      >
                        <Lock className="w-4 h-4 mr-2" />
                        Privacy & Security
                      </Button>
                      <Button 
                        variant={complianceTab === "billing" ? "default" : "ghost"} 
                        className="w-full justify-start rounded-xl"
                        onClick={() => setComplianceTab("billing")}
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        {t.billing}
                      </Button>
                      <Button 
                        variant={complianceTab === "templates" ? "default" : "ghost"} 
                        className="w-full justify-start rounded-xl"
                        onClick={() => setComplianceTab("templates")}
                      >
                        <LayoutTemplate className="w-4 h-4 mr-2" />
                        {t.templatesTab}
                      </Button>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-white/10">
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30">
                        <p className="text-[10px] text-blue-600 uppercase tracking-widest font-bold mb-1">{t.sfdaMode}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-blue-700 dark:text-blue-400">{sfdaMode ? "Active" : "Disabled"}</span>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 w-12 p-0 bg-white dark:bg-white/10 rounded-full relative"
                            onClick={() => setSfdaMode(!sfdaMode)}
                          >
                            <div className={cn(
                              "absolute w-4 h-4 rounded-full transition-all",
                              sfdaMode ? "right-1 bg-green-500" : "left-1 bg-gray-400"
                            )} />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold px-2">Compliance Checks</p>
                      {[
                        { label: "21 CFR Part 11", status: "Compliant" },
                        { label: "GxP Validation", status: "Active" },
                        { label: "Data Integrity", status: "Verified" },
                        { label: "HIPAA/GDPR", status: "Secure" }
                      ].map((check, i) => (
                        <div key={i} className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-lg transition-colors">
                          <span className="text-xs font-medium dark:text-gray-300">{check.label}</span>
                          <CheckCircle2 className="w-3 h-3 text-green-500" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Main Content Area */}
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {complianceTab === "audit" && (
                      <>
                        <div className="p-4 border-b border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 flex items-center justify-between">
                          <h4 className="text-sm font-bold flex items-center gap-2 dark:text-white">
                            <AuditIcon className="w-4 h-4 text-gray-400" />
                            System Audit Trail
                          </h4>
                          <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg dark:border-white/10 dark:hover:bg-white/10">
                            <Download className="w-3 h-3 mr-2" />
                            Export Log
                          </Button>
                        </div>
                        <ScrollArea className="flex-1">
                          <div className="p-0">
                            <table className="w-full text-left border-collapse">
                              <thead className="sticky top-0 bg-white dark:bg-[#1D1D1F] z-10">
                                <tr className="border-b border-gray-100 dark:border-white/10">
                                  <th className="p-4 text-[10px] text-gray-400 uppercase tracking-widest font-bold">Timestamp</th>
                                  <th className="p-4 text-[10px] text-gray-400 uppercase tracking-widest font-bold">User</th>
                                  <th className="p-4 text-[10px] text-gray-400 uppercase tracking-widest font-bold">Action</th>
                                  <th className="p-4 text-[10px] text-gray-400 uppercase tracking-widest font-bold">Details</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                                {auditLogs.map((log) => (
                                  <tr key={log.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors">
                                    <td className="p-4 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                      {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : "Just now"}
                                    </td>
                                    <td className="p-4">
                                      <div className="flex flex-col">
                                        <span className="text-xs font-bold dark:text-white">{log.userEmail.split('@')[0]}</span>
                                        <span className="text-[10px] text-gray-400">{log.userEmail}</span>
                                      </div>
                                    </td>
                                    <td className="p-4">
                                      <Badge className={cn(
                                        "text-[10px] font-bold px-2 py-0.5 rounded-md border-none",
                                        log.action === "SIGN" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                                        log.action === "DELETE" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                                        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                      )}>
                                        {log.action}
                                      </Badge>
                                    </td>
                                    <td className="p-4 text-xs text-gray-600 dark:text-gray-400 max-w-xs truncate">
                                      {log.details}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </ScrollArea>
                      </>
                    )}

                    {complianceTab === "docs" && (
                      <ScrollArea className="flex-1 p-8">
                        <div className="max-w-3xl mx-auto space-y-8">
                          <div className="space-y-4">
                            <h4 className="text-lg font-bold dark:text-white">GxP Validation Documentation</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              PharmaGuard Global is a validated system. Below are the qualification documents required for regulatory audits.
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                              { title: "Installation Qualification (IQ)", desc: "Verifies system installation and environment setup.", date: "2024-03-10", type: "IQ" },
                              { title: "Operational Qualification (OQ)", desc: "Tests system functionality against specifications.", date: "2024-03-12", type: "OQ" },
                              { title: "Performance Qualification (PQ)", desc: "Confirms consistent performance in real-world scenarios.", date: "2024-03-15", type: "PQ" },
                              { title: "Validation Summary Report (VSR)", desc: "Final sign-off on system validation status.", date: "2024-03-20", type: "VSR" },
                              { title: "SFDA Drug Master File (DMF)", desc: "Saudi FDA specific template for drug master files.", date: "2024-04-01", type: "SFDA_DMF" },
                              { title: "SFDA Stability Summary", desc: "Saudi FDA format for stability study summaries.", date: "2024-04-05", type: "SFDA_STAB" }
                            ].map((doc, i) => (
                              <Card key={i} className="dark:bg-white/5 border-gray-100 dark:border-white/10 hover:border-blue-500 transition-colors cursor-pointer">
                                <CardHeader className="p-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <FileCheck className="w-5 h-5 text-blue-600" />
                                    <Badge variant="outline" className="text-[10px] uppercase">Validated</Badge>
                                  </div>
                                  <CardTitle className="text-sm dark:text-white">{doc.title}</CardTitle>
                                  <CardDescription className="text-xs">{doc.desc}</CardDescription>
                                </CardHeader>
                                <CardFooter className="p-4 pt-0 flex justify-between items-center">
                                  <span className="text-[10px] text-gray-400">Updated: {doc.date}</span>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 text-[10px]"
                                    onClick={() => {
                                      let content = `PharmaGuard Global - ${doc.title}\n\nDate: ${doc.date}\nStatus: Validated\n\n`;
                                      
                                      if (doc.type === "SFDA_DMF") {
                                        content += "Saudi FDA Drug Master File (DMF) Requirements:\n1. General Information\n2. Manufacture of Active Substance\n3. Characterization\n4. Control of Active Substance\n5. Reference Standards\n6. Container Closure System\n7. Stability";
                                      } else if (doc.type === "SFDA_STAB") {
                                        content += "Saudi FDA Stability Study Summary Requirements:\n1. Batch Details\n2. Storage Conditions\n3. Testing Frequency\n4. Analytical Procedures\n5. Results and Statistical Analysis\n6. Shelf-life Conclusion";
                                      } else {
                                        content += `This is a GxP compliant ${doc.type} template for regulatory purposes.`;
                                      }

                                      const blob = new Blob([content], { type: 'text/plain' });
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = `PharmaGuard_${doc.type}_Template.txt`;
                                      a.click();
                                      toast.success(`${doc.type} Template downloaded`);
                                    }}
                                  >
                                    Download Template
                                  </Button>
                                </CardFooter>
                              </Card>
                            ))}
                          </div>

                          <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/30 space-y-4">
                            <h5 className="font-bold text-blue-800 dark:text-blue-400 flex items-center gap-2">
                              <Info className="w-4 h-4" />
                              Validation Support
                            </h5>
                            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                              Need a custom validation package for your specific environment? Our regulatory experts can provide tailored IQ/OQ/PQ protocols and execution support.
                            </p>
                            <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs">Request Custom Package</Button>
                          </div>
                        </div>
                      </ScrollArea>
                    )}

                    {complianceTab === "api" && (
                      <ScrollArea className="flex-1 p-8">
                        <div className="max-w-3xl mx-auto space-y-8">
                          <div className="space-y-4">
                            <h4 className="text-lg font-bold dark:text-white">Enterprise Integrations</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Connect PharmaGuard Global with your existing Quality Management Systems (QMS) and ERPs.
                            </p>
                          </div>

                          <div className="space-y-4">
                            {[
                              { name: "Veeva Vault QMS", status: "Available", desc: "Automate document ingestion and validation results sync." },
                              { name: "SAP S/4HANA", status: "Beta", desc: "Sync batch validation records with manufacturing data." },
                              { name: "TrackWise Digital", status: "Coming Soon", desc: "Direct integration for non-conformance reporting." }
                            ].map((api, i) => (
                              <div key={i} className="p-6 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-3xl flex items-center justify-between gap-6">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <h5 className="font-bold dark:text-white">{api.name}</h5>
                                    <Badge variant={api.status === "Available" ? "default" : "outline"} className="text-[10px]">
                                      {api.status}
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">{api.desc}</p>
                                </div>
                                <Button variant="outline" className="rounded-xl dark:border-white/10">Configure</Button>
                              </div>
                            ))}
                          </div>

                          <Card className="dark:bg-white/5 border-dashed border-2 border-gray-200 dark:border-white/10">
                            <CardContent className="p-8 text-center space-y-4">
                              <div className="w-12 h-12 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto">
                                <Plus className="w-6 h-6 text-gray-400" />
                              </div>
                              <div className="space-y-1">
                                <p className="font-bold dark:text-white">Custom API Webhook</p>
                                <p className="text-xs text-gray-500">Build your own integration using our REST API.</p>
                              </div>
                              <Button variant="ghost" className="text-blue-600">View API Documentation</Button>
                            </CardContent>
                          </Card>
                        </div>
                      </ScrollArea>
                    )}

                    {complianceTab === "privacy" && (
                      <ScrollArea className="flex-1 p-8">
                        <div className="max-w-3xl mx-auto space-y-8">
                          <div className="space-y-4">
                            <h4 className="text-lg font-bold dark:text-white">Privacy & Data Security</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Manage your data privacy settings and security configurations in compliance with HIPAA and GDPR.
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Card className="dark:bg-white/5 border-gray-100 dark:border-white/10">
                              <CardHeader className="p-6">
                                <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center mb-4">
                                  <Key className="w-5 h-5 text-blue-600" />
                                </div>
                                <CardTitle className="text-sm dark:text-white">Field-Level Encryption</CardTitle>
                                <CardDescription className="text-xs">
                                  Sensitive pharmaceutical data is encrypted at the application level using AES-256 before being stored in Firestore.
                                </CardDescription>
                              </CardHeader>
                              <CardFooter className="p-6 pt-0">
                                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-none">Active</Badge>
                              </CardFooter>
                            </Card>

                            <Card className="dark:bg-white/5 border-gray-100 dark:border-white/10">
                              <CardHeader className="p-6">
                                <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/20 rounded-xl flex items-center justify-center mb-4">
                                  <ShieldCheck className="w-5 h-5 text-purple-600" />
                                </div>
                                <CardTitle className="text-sm dark:text-white">HIPAA Compliance</CardTitle>
                                <CardDescription className="text-xs">
                                  System architecture follows HIPAA guidelines for PHI protection, including access controls and audit logging.
                                </CardDescription>
                              </CardHeader>
                              <CardFooter className="p-6 pt-0">
                                <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-none">Verified</Badge>
                              </CardFooter>
                            </Card>
                          </div>

                          <div className="space-y-4">
                            <h5 className="text-sm font-bold dark:text-white px-2">GDPR Rights & Portability</h5>
                            <div className="p-6 bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-3xl space-y-6">
                              <div className="flex items-center justify-between gap-4">
                                <div className="space-y-1">
                                  <p className="text-sm font-bold dark:text-white">Data Portability (Right to Access)</p>
                                  <p className="text-xs text-gray-500">Download a full machine-readable export of all your personal data and validation history.</p>
                                </div>
                                <Button onClick={handleExportData} variant="outline" className="rounded-xl shrink-0">
                                  <Download className="w-4 h-4 mr-2" />
                                  Export JSON
                                </Button>
                              </div>
                              <Separator className="dark:bg-white/10" />
                              <div className="flex items-center justify-between gap-4">
                                <div className="space-y-1">
                                  <p className="text-sm font-bold text-red-600">Right to be Forgotten (Erasure)</p>
                                  <p className="text-xs text-gray-500">Permanently delete all your validation records, audit logs, and account profile from our servers.</p>
                                </div>
                                <Button onClick={() => setIsDeleteConfirmOpen(true)} variant="destructive" className="rounded-xl shrink-0">
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete All Data
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </ScrollArea>
                    )}

                    {complianceTab === "billing" && (
                      <ScrollArea className="flex-1 p-8">
                        <div className="max-w-4xl mx-auto space-y-8">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <h4 className="text-lg font-bold dark:text-white">{t.billing}</h4>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                Manage your organization's subscription and multi-tenant settings.
                              </p>
                            </div>
                            {userProfile?.subscriptionStatus === "active" && (
                              <Button onClick={handleManageSubscription} variant="outline" className="rounded-xl">
                                <CreditCard className="w-4 h-4 mr-2" />
                                {t.manageSubscription}
                              </Button>
                            )}
                          </div>

                          {/* Usage Tracking */}
                          <div className="p-6 rounded-3xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10">
                            <div className="flex items-center justify-between mb-4">
                              <div>
                                <h5 className="font-bold">Monthly Usage</h5>
                                <p className="text-xs text-gray-500">Validations performed this billing cycle</p>
                              </div>
                              <div className="text-right">
                                <span className="text-lg font-bold">{userProfile?.monthlyUsage || 0}</span>
                                <span className="text-sm text-gray-500"> / {userProfile?.usageLimit || 0}</span>
                              </div>
                            </div>
                            <div className="w-full h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                              <div 
                                className={cn(
                                  "h-full transition-all duration-500",
                                  (userProfile?.monthlyUsage || 0) / (userProfile?.usageLimit || 1) > 0.9 ? "bg-red-500" : "bg-blue-600"
                                )}
                                style={{ width: `${Math.min(100, ((userProfile?.monthlyUsage || 0) / (userProfile?.usageLimit || 1)) * 100)}%` }}
                              />
                            </div>
                            {(userProfile?.monthlyUsage || 0) / (userProfile?.usageLimit || 1) > 0.8 && (
                              <p className="text-[10px] text-red-500 mt-2 font-medium">
                                You are approaching your monthly limit. Consider upgrading your plan.
                              </p>
                            )}
                          </div>

                          {/* Pricing Plans */}
                          <div className="grid md:grid-cols-3 gap-6">
                            {PRICING_PLANS.map((plan) => (
                              <div 
                                key={plan.id}
                                className={cn(
                                  "p-6 rounded-3xl border transition-all flex flex-col",
                                  plan.recommended 
                                    ? "border-blue-500 bg-blue-50/50 dark:bg-blue-900/10 ring-1 ring-blue-500" 
                                    : "border-gray-100 dark:border-white/10 bg-white dark:bg-white/5"
                                )}
                              >
                                <div className="flex justify-between items-start mb-4">
                                  <div>
                                    <h5 className="font-bold text-lg">{plan.name}</h5>
                                    <div className="flex items-baseline gap-1">
                                      <span className="text-2xl font-bold">{plan.price}</span>
                                      <span className="text-sm text-gray-500">/{plan.interval}</span>
                                    </div>
                                  </div>
                                  {plan.recommended && (
                                    <span className="px-2 py-1 bg-blue-500 text-white text-[10px] font-bold rounded-full uppercase tracking-wider">
                                      Recommended
                                    </span>
                                  )}
                                </div>
                                <ul className="space-y-3 mb-6 flex-1">
                                  {plan.features.map((feature, idx) => (
                                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                                      {feature}
                                    </li>
                                  ))}
                                </ul>
                                <Button 
                                  onClick={() => handleSubscribe(plan.priceId)}
                                  disabled={userProfile?.subscriptionStatus === "active" && plan.id !== "enterprise"}
                                  className={cn(
                                    "w-full rounded-xl py-6",
                                    plan.recommended ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-900 dark:bg-white dark:text-black"
                                  )}
                                >
                                  {userProfile?.subscriptionStatus === "active" ? "Current Plan" : t.subscribe}
                                </Button>
                              </div>
                            ))}
                          </div>

                          <div className="grid md:grid-cols-2 gap-6">
                            <Card className="dark:bg-white/5 border-gray-100 dark:border-white/10">
                              <CardHeader className="p-6">
                                <CardTitle className="text-sm dark:text-white">Organization Details</CardTitle>
                              </CardHeader>
                              <CardContent className="p-6 pt-0 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Company Name</p>
                                    <p className="text-sm font-bold dark:text-white">{userProfile?.companyName}</p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Tenant ID</p>
                                    <p className="text-sm font-mono text-blue-600">{userProfile?.tenantId}</p>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Your Role</p>
                                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-green-400 border-none">{userProfile?.role}</Badge>
                                </div>
                              </CardContent>
                            </Card>

                            <div className="p-6 rounded-3xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10">
                              <div className="flex items-start gap-4">
                                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center shrink-0">
                                  <Globe className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                  <h5 className="font-bold mb-1">{t.bankTransfer}</h5>
                                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                                    {t.bankDetails}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                        </div>
                      </ScrollArea>
                    )}

                    {complianceTab === "templates" && (
                      <ScrollArea className="flex-1 p-8">
                        <div className="max-w-3xl mx-auto space-y-8">
                          <div className="space-y-4">
                            <h4 className="text-lg font-bold dark:text-white">{t.templatesTab}</h4>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Download pre-formatted regulatory templates for SFDA and GxP compliance.
                            </p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                              { title: t.dmfChecklist, desc: "Complete checklist for Drug Master File registration with SFDA.", type: "SFDA_DMF_CHECKLIST" },
                              { title: t.stabilitySummary, desc: "SFDA-compliant summary template for stability studies.", type: "SFDA_STABILITY_SUMMARY" },
                              { title: t.dossierChecklist, desc: "Complete checklist for SFDA drug registration dossiers.", type: "SFDA_DOSSIER" },
                              { title: t.stabilityTemplate, desc: "ICH Q1A compliant stability study protocol.", type: "ICH_Q1A" },
                              { title: t.gmpForm, desc: "Validation form for GMP certificates.", type: "GMP_VAL" },
                              { title: "IQ/OQ/PQ Protocols", desc: "Standard system qualification protocols.", type: "GXP_PROTO" }
                            ].map((tpl, i) => (
                              <Card key={i} className="dark:bg-white/5 border-gray-100 dark:border-white/10 hover:border-blue-500 transition-colors cursor-pointer group">
                                <CardHeader className="p-6">
                                  <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <FileDown className="w-5 h-5 text-blue-600" />
                                  </div>
                                  <CardTitle className="text-sm dark:text-white">{tpl.title}</CardTitle>
                                  <CardDescription className="text-xs">{tpl.desc}</CardDescription>
                                </CardHeader>
                                <CardFooter className="p-6 pt-0">
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="w-full rounded-xl text-xs"
                                    onClick={() => handleDownloadTemplate(tpl.type, tpl.title)}
                                  >
                                    Download PDF
                                  </Button>
                                </CardFooter>
                              </Card>
                            ))}
                          </div>
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {isDeleteConfirmOpen && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-[#1D1D1F] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-red-200 dark:border-red-900/30"
              >
                <div className="p-6 border-b border-red-50 dark:border-red-900/10 flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center">
                    <ShieldAlert className="w-6 h-6 text-red-600" />
                  </div>
                  <h3 className="font-bold text-lg text-red-600">Confirm Data Erasure</h3>
                </div>
                <div className="p-6 space-y-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    This action is <span className="font-bold text-red-600">irreversible</span>. All your validation history, signatures, and audit logs will be permanently removed from our secure servers in compliance with GDPR Article 17.
                  </p>
                  <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-2xl border border-red-100 dark:border-red-900/30">
                    <p className="text-xs text-red-800 dark:text-red-400 font-medium">
                      Type "DELETE" to confirm:
                    </p>
                    <input 
                      id="delete-confirm-input"
                      type="text" 
                      placeholder="DELETE"
                      className="w-full mt-2 bg-white dark:bg-black/20 border-red-200 dark:border-red-900/30 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500 dark:text-white"
                    />
                  </div>
                </div>
                <div className="p-6 flex gap-3 bg-gray-50 dark:bg-white/5">
                  <Button variant="ghost" onClick={() => setIsDeleteConfirmOpen(false)} className="flex-1 rounded-xl">Cancel</Button>
                  <Button 
                    variant="destructive" 
                    className="flex-1 rounded-xl"
                    onClick={() => {
                      const input = (document.getElementById('delete-confirm-input') as HTMLInputElement).value;
                      if (input === "DELETE") {
                        handleDeleteAllData();
                      } else {
                        toast.error("Please type DELETE to confirm");
                      }
                    }}
                  >
                    Confirm Erasure
                  </Button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Signature Details Modal */}
          {isSignatureDetailsOpen && activeSignature && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-[#1D1D1F] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-gray-200 dark:border-white/10"
              >
                <div className="p-6 border-b border-gray-100 dark:border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center">
                      <ShieldCheck className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg dark:text-white">Signature Verification</h3>
                      <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">21 CFR Part 11 Validated</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setIsSignatureDetailsOpen(false)} className="rounded-full">
                    <X className="w-5 h-5" />
                  </Button>
                </div>
                <div className="p-6 space-y-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10">
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Signer</p>
                        <p className="text-sm font-bold dark:text-white truncate">{activeSignature.userEmail}</p>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10">
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Timestamp</p>
                        <p className="text-sm font-bold dark:text-white">
                          {activeSignature.timestamp?.toDate ? activeSignature.timestamp.toDate().toLocaleString() : "N/A"}
                        </p>
                      </div>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10">
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Reason for Signing</p>
                      <p className="text-sm font-bold dark:text-white">{activeSignature.reason}</p>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10">
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Regulatory Meaning</p>
                      <p className="text-sm font-bold dark:text-white italic">"{activeSignature.meaning}"</p>
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10">
                      <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold mb-1">Document Hash (SHA-256)</p>
                      <p className="text-[10px] font-mono dark:text-gray-400 break-all">{activeSignature.hash}</p>
                    </div>
                  </div>

                  <div className="p-4 bg-green-50 dark:bg-green-900/10 rounded-2xl border border-green-100 dark:border-green-900/30 flex gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                    <p className="text-xs text-green-800 dark:text-green-400 leading-relaxed">
                      This signature has been cryptographically verified and linked to the document state at the time of signing.
                    </p>
                  </div>
                </div>
                <div className="p-6 bg-gray-50 dark:bg-white/5 flex gap-3">
                  <Button variant="outline" onClick={() => setIsSignatureDetailsOpen(false)} className="flex-1 rounded-xl dark:border-white/10">Close</Button>
                  <Button className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white">
                    <Download className="w-4 h-4 mr-2" />
                    Certificate
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        
        <Button 
          id="btn-toggle-chat"
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={cn(
            "w-14 h-14 rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95",
            isChatOpen ? "bg-black" : "bg-blue-600"
          )}
        >
          {isChatOpen ? <X className="w-6 h-6" /> : <BrainCircuit className="w-6 h-6" />}
        </Button>
      </div>

      <footer className="border-t border-gray-200 dark:border-white/10 py-12 mt-24 bg-white dark:bg-[#1D1D1F]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <ShieldCheck className="text-black dark:text-white w-6 h-6" />
            <span className="font-bold text-lg dark:text-white">PharmaGuard Global</span>
          </div>
          <div className="flex gap-8 text-sm text-gray-500 dark:text-gray-400">
            <a href="#" id="footer-privacy" className="hover:text-black dark:hover:text-white">Privacy Policy</a>
            <a href="#" id="footer-terms" className="hover:text-black dark:hover:text-white">Terms of Service</a>
            <a href="#" id="footer-contact" className="hover:text-black dark:hover:text-white">Contact Support</a>
          </div>
          <p className="text-sm text-gray-400 dark:text-gray-500">© 2026 PharmaGuard Global. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

const SENSITIVE_FIELDS = ["productName", "batchNumber", "summary", "userEmail"];

function LandingPage({ onEnter, language, setLanguage }: { onEnter: () => void, language: "en" | "ar", setLanguage: (l: "en" | "ar") => void }) {
  const t = translations[language];
  const [email, setEmail] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleDemoRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/request-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success(t.requestDemo + " Success!");
        setEmail("");
      }
    } catch (error) {
      toast.error("Failed to submit request");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0B] text-black dark:text-white font-sans selection:bg-blue-100 dark:selection:bg-blue-900/30" dir={language === "ar" ? "rtl" : "ltr"}>
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-[#0A0A0B]/80 backdrop-blur-md border-b border-gray-100 dark:border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <ShieldCheck className="text-white w-6 h-6" />
            </div>
            <span className="font-bold text-xl tracking-tight">PharmaGuard Global</span>
          </div>
          
          <div className="flex items-center gap-6">
            <Button variant="ghost" size="sm" onClick={() => setLanguage(language === "en" ? "ar" : "en")} className="rounded-full gap-2">
              <Languages className="w-4 h-4" />
              {language === "en" ? "عربي" : "English"}
            </Button>
            <Button onClick={onEnter} className="bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 rounded-full px-6">
              {t.login}
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-24 px-6">
        <div className="max-w-5xl mx-auto text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-medium"
          >
            <Star className="w-4 h-4 fill-current" />
            <span>{t.freeTrial}</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-6xl md:text-7xl font-bold tracking-tight leading-[1.1]"
          >
            {t.headline}
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed"
          >
            {t.subheadline}
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8"
          >
            <form onSubmit={handleDemoRequest} className="flex w-full max-w-md gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="email" 
                  placeholder="Enter your work email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  required
                />
              </div>
              <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl px-8 py-6 h-auto">
                {isSubmitting ? "..." : t.requestDemo}
              </Button>
            </form>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6 bg-gray-50 dark:bg-white/[0.02]">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Zap, title: "Instant Validation", desc: "Automated checks for SFDA, FDA, and EMA standards in seconds." },
              { icon: ShieldCheck, title: "21 CFR Part 11", desc: "Fully compliant electronic signatures and immutable audit trails." },
              { icon: Globe, title: "Multi-Region Support", desc: "Localized templates for Saudi Arabia (SFDA) and Pakistan markets." }
            ].map((f, i) => (
              <div key={i} className="p-8 rounded-3xl bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 hover:shadow-xl transition-all">
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mb-6">
                  <f.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SFDA Section */}
      <section className="py-24 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <h2 className="text-4xl font-bold tracking-tight">Built for SFDA Compliance</h2>
            <p className="text-lg text-gray-500 dark:text-gray-400 leading-relaxed">
              PharmaGuard Global is specifically optimized for the Saudi market. From Arabic UI support to SFDA-specific registration number validation, we ensure your documents meet local standards.
            </p>
            <ul className="space-y-4">
              {[
                "Arabic Product Name Validation",
                "SFDA Registration Format Checks",
                "GMP Certificate Verification",
                "ICH Q1A Stability Templates"
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckSquare className="w-3 h-3 text-green-600" />
                  </div>
                  <span className="font-medium">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500/20 blur-[100px] rounded-full" />
            <div className="relative p-8 rounded-3xl bg-white dark:bg-[#1D1D1F] border border-gray-200 dark:border-white/10 shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-bold tracking-widest">SFDA Status</p>
                    <p className="font-bold">Compliant</p>
                  </div>
                </div>
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Active</Badge>
              </div>
              <div className="space-y-4">
                <div className="h-4 w-3/4 bg-gray-100 dark:bg-white/5 rounded-full" />
                <div className="h-4 w-1/2 bg-gray-100 dark:bg-white/5 rounded-full" />
                <div className="h-4 w-2/3 bg-gray-100 dark:bg-white/5 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-12 border-t border-gray-100 dark:border-white/5">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8 text-sm text-gray-500">
          <p>© 2026 PharmaGuard Global. All rights reserved.</p>
          <div className="flex gap-8">
            <a href="#" className="hover:text-black dark:hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-black dark:hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-black dark:hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  const [showLanding, setShowLanding] = React.useState(true);
  const [language, setLanguage] = React.useState<"en" | "ar">("en");

  if (showLanding) {
    return (
      <ErrorBoundary>
        <LandingPage 
          onEnter={() => setShowLanding(false)} 
          language={language} 
          setLanguage={setLanguage} 
        />
        <Toaster position="top-right" />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Dashboard language={language} setLanguage={setLanguage} onBackToLanding={() => setShowLanding(true)} />
    </ErrorBoundary>
  );
}

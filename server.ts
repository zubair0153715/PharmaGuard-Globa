import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import multer from "multer";
import crypto from "crypto";
import { PDFDocument } from "pdf-lib";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TWOCHECKOUT_CONFIG = {
  merchantCode: process.env.TWOCHECKOUT_MERCHANT_CODE,
  secretWord: process.env.TWOCHECKOUT_SECRET_WORD,
  secretKey: process.env.TWOCHECKOUT_SECRET_KEY, // Used for newer HASH signatures
  mode: process.env.VITE_TWO_CHECKOUT_MODE || "sandbox"
};

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
    if (serviceAccount.project_id) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    } else {
      // Fallback for local development or if service account is not provided
      admin.initializeApp({
        projectId: process.env.VITE_FIREBASE_PROJECT_ID || "pharma-guard-global"
      });
    }
  } catch (error) {
    console.error("[FIREBASE ADMIN] Initialization failed:", error);
  }
}

const db = admin.firestore();

const PLAN_LIMITS: Record<string, { name: string, limit: number }> = {
  [process.env.VITE_TWO_CHECKOUT_PRICE_STARTER || "starter_plan"]: { name: "starter", limit: 50 },
  [process.env.VITE_TWO_CHECKOUT_PRICE_PRO || "pro_plan"]: { name: "pro", limit: 1000000 },
  [process.env.VITE_TWO_CHECKOUT_PRICE_ENTERPRISE || "enterprise_plan"]: { name: "enterprise", limit: 10000000 },
};

/**
 * 2Checkout Signature Generator for Buy Links
 * This is a simplified version for Hosted Buy Links
 */
function generate2CheckoutSignature(payload: string) {
  if (!TWOCHECKOUT_CONFIG.secretKey) return "";
  return crypto
    .createHmac("sha256", TWOCHECKOUT_CONFIG.secretKey)
    .update(payload)
    .digest("hex");
}

/**
 * 2Checkout IPN Signature Validator
 */
function validate2CheckoutIPN(body: any, secretWord: string) {
  // Logic to validate 2Checkout IPN HMAC
  // Simplified for this context: usually involves sorting keys and concatenating values
  return true; // Assume valid for now OR implement full check if needed
}

async function startServer() {
  console.log("[SERVER] Starting PharmaGuard Global server...");
  const app = express();
  const PORT = 3000;

  // 1. Basic Middlewares
  app.use(cors());
  app.use(express.json({ limit: "2gb" }));
  app.use(express.urlencoded({ limit: "2gb", extended: true }));

  // 2. Request Logging Middleware (Top-level)
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      if (req.url.startsWith("/api") || res.statusCode >= 400) {
        console.log(`[SERVER] ${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
      }
    });
    next();
  });

  // 3. API Routes
  
  // 2Checkout IPN (Webhook)
  app.post("/api/2checkout/ipn", async (req, res) => {
    const body = req.body;
    const secretWord = TWOCHECKOUT_CONFIG.secretWord;

    console.log("[2CHECKOUT] IPN Received:", body.ORDERSTATUS, body.REFNO);

    if (body.ORDERSTATUS === "COMPLETE") {
      const userId = body.EXTERNAL_REFERENCE || body.CUSTOMER_REFERENCE;
      const productCodes = body["IPN_PCODE[]"];
      const customerId = body.AVANGATE_CUSTOMER_REFERENCE;
      const orderNo = body.REFNO;
      
      const productCode = Array.isArray(productCodes) ? productCodes[0] : (productCodes || body.PROD_CODE);
      const planInfo = productCode ? PLAN_LIMITS[productCode] : null;

      if (userId) {
        await db.collection("users").doc(userId).update({
          twoCheckoutCustomerId: customerId,
          orderReference: orderNo,
          subscriptionStatus: "active",
          subscriptionPlan: planInfo?.name || "starter",
          usageLimit: planInfo?.limit || 50,
          monthlyUsage: 0,
        });
        console.log(`[2CHECKOUT] Subscription activated for user: ${userId} (Plan: ${planInfo?.name})`);
      }
    }

    // IPN Confirmation Response (Required by 2Checkout)
    res.send("IPN_RESPONSE_SUCCESS");
  });

  // Configure Multer for file uploads
  const storage = multer.memoryStorage();
  const upload = multer({ 
    storage,
    limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2GB limit
  });

  // Request Demo Endpoint
  app.post("/api/request-demo", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });
      
      console.log(`[SERVER] Demo request received for: ${email}`);
      // In a real app, you'd save this to a DB or send an email
      res.json({ success: true, message: "Demo request received. We will contact you soon." });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "PharmaGuard Global API" });
  });

  // 2Checkout Subscription Endpoint
  app.post("/api/create-subscription-session", async (req, res) => {
    if (!TWOCHECKOUT_CONFIG.merchantCode) return res.status(500).json({ error: "2Checkout is not configured" });
    
    try {
      const { priceId, customerEmail, userId } = req.body;
      
      // 2Checkout Buy Link Parameters
      // For a real production app, you'd use their API to generate a signed link
      const baseUrl = TWOCHECKOUT_CONFIG.mode === "sandbox" 
        ? "https://sandbox.2checkout.com/checkout/purchase"
        : "https://secure.2checkout.com/checkout/purchase";

      const params = new URLSearchParams({
        sid: TWOCHECKOUT_CONFIG.merchantCode,
        mode: "2CO",
        "li_0_type": "product",
        "li_0_name": "PharmaGuard Subscription",
        "li_0_product_id": priceId,
        "li_0_quantity": "1",
        "li_0_tangible": "N",
        email: customerEmail,
        "x_receipt_link_url": `${req.headers.origin}/`,
        "merchant_order_id": userId
      });

      res.json({ url: `${baseUrl}?${params.toString()}` });
    } catch (error: any) {
      console.error("[2CHECKOUT] Error creating session:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 2Checkout Customer Portal (Simulated as they don't have a direct portal like Stripe)
  app.post("/api/create-portal-session", async (req, res) => {
    res.json({ url: "https://secure.2checkout.com/myaccount/" });
  });

  // SFDA Validator Endpoint
  app.post("/api/validate-document", upload.single("file"), async (req: any, res) => {
    console.log(`[API] Received validation request for: ${req.file?.originalname}`);
    try {
      if (!req.file) {
        return res.status(400).json({ 
          error: "No file uploaded", 
          guidance: "Please select a PDF file to upload." 
        });
      }

      if (req.file.mimetype !== "application/pdf") {
        return res.status(400).json({ 
          error: "Invalid file type", 
          guidance: "Only PDF documents are supported for SFDA validation." 
        });
      }

      const fileBuffer = req.file.buffer;
      const fileName = req.file.originalname;

      // 1. MD5 Checksum
      const hash = crypto.createHash("md5").update(fileBuffer).digest("hex");

      // 2. Filename Validation (SFDA conventions: lowercase, no special chars, max 64 chars)
      const fileNameRegex = /^[a-z0-9-]+\.pdf$/;
      const isFileNameValid = fileNameRegex.test(fileName) && fileName.length <= 64;

      // 3. PDF/A Compliance & Metadata
      let isPdfA = false;
      let pdfAStandard = "N/A";
      let pdfAIssues: string[] = [];
      let metadata = {};
      let pageCount = 0;

      try {
        const pdfDoc = await PDFDocument.load(fileBuffer);
        pageCount = pdfDoc.getPageCount();
        
        // Advanced PDF/A check: Scan buffer for XMP metadata markers
        const bufferString = fileBuffer.toString("utf-8");
        
        // Look for PDF/A version and conformance
        const partMatch = bufferString.match(/<pdfaid:part>(\d+)<\/pdfaid:part>/);
        const conformanceMatch = bufferString.match(/<pdfaid:conformance>([A-Z])<\/pdfaid:conformance>/);
        
        if (partMatch) {
          isPdfA = true;
          const part = partMatch[1];
          const conformance = conformanceMatch ? conformanceMatch[1].toLowerCase() : "";
          pdfAStandard = `PDF/A-${part}${conformance}`;
        } else {
          // Fallback check in keywords
          const keywords = pdfDoc.getKeywords() || "";
          if (keywords.toLowerCase().includes("pdf/a")) {
            isPdfA = true;
            pdfAStandard = "PDF/A (Detected via Keywords)";
          }
        }

        if (!isPdfA) {
          pdfAIssues.push("Missing PDF/A identification in XMP metadata");
          pdfAIssues.push("Document may contain non-embedded fonts or transparent elements");
        }
        
        metadata = {
          title: pdfDoc.getTitle(),
          author: pdfDoc.getAuthor(),
          subject: pdfDoc.getSubject(),
          creator: pdfDoc.getCreator(),
          producer: pdfDoc.getProducer(),
          creationDate: pdfDoc.getCreationDate(),
          modificationDate: pdfDoc.getModificationDate(),
        };
      } catch (pdfError) {
        console.error("PDF Parsing Error:", pdfError);
        return res.status(422).json({ 
          error: "Corrupt or invalid PDF", 
          guidance: "The file could not be parsed as a valid PDF. Please ensure the file is not corrupted." 
        });
      }

      // 4. Score Calculation
      let healthScore = 0;
      if (isFileNameValid) healthScore += 30;
      if (isPdfA) healthScore += 40;
      if (pageCount > 0) healthScore += 30;

      res.json({
        fileName,
        checksum: hash,
        isFileNameValid,
        isPdfA,
        pdfAStandard,
        pdfAIssues,
        pageCount,
        metadata,
        healthScore,
        status: healthScore >= 70 ? "Pass" : "Fail",
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error("Validation Error:", error);
      res.status(500).json({ error: "Internal server error during validation" });
    }
  });

  // Catch-all for unhandled API routes
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API route ${req.method} ${req.url} not found` });
  });

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Global Server Error:", err);
    res.status(err.status || 500).json({
      error: err.message || "An unexpected server error occurred",
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

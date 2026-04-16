import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import multer from "multer";
import crypto from "crypto";
import { PDFDocument } from "pdf-lib";
import Stripe from "stripe";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-01-27" as any })
  : null;

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
  "price_starter_monthly": { name: "starter", limit: 50 },
  "price_pro_monthly": { name: "pro", limit: 1000000 },
  "price_enterprise_yearly": { name: "enterprise", limit: 10000000 },
};

async function startServer() {
  console.log("[SERVER] Starting PharmaGuard Global server...");
  const app = express();
  const PORT = 3000;

  app.use(cors());
  
  // Stripe Webhook (MUST be before express.json)
  app.post("/api/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripe || !sig || !webhookSecret) {
      return res.status(400).send("Webhook Error: Missing stripe or signature");
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error(`[STRIPE] Webhook signature verification failed: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        // Get the price ID from the session line items
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
        const priceId = lineItems.data[0]?.price?.id;
        const planInfo = priceId ? PLAN_LIMITS[priceId] : null;

        if (userId) {
          await db.collection("users").doc(userId).update({
            stripeCustomerId: customerId,
            subscriptionId: subscriptionId,
            subscriptionStatus: "active",
            subscriptionPlan: planInfo?.name || "starter",
            usageLimit: planInfo?.limit || 50,
            monthlyUsage: 0, // Reset usage on new subscription
          });
          console.log(`[STRIPE] Subscription activated for user: ${userId} (Plan: ${planInfo?.name})`);
        }
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        const userSnapshot = await db.collection("users").where("stripeCustomerId", "==", customerId).limit(1).get();
        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          await userDoc.ref.update({
            subscriptionStatus: "canceled",
          });
          console.log(`[STRIPE] Subscription canceled for customer: ${customerId}`);
        }
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const status = subscription.status;
        const priceId = subscription.items.data[0]?.price.id;
        const planInfo = priceId ? PLAN_LIMITS[priceId] : null;

        const userSnapshot = await db.collection("users").where("stripeCustomerId", "==", customerId).limit(1).get();
        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          await userDoc.ref.update({
            subscriptionStatus: status === "active" ? "active" : "past_due",
            subscriptionPlan: planInfo?.name || "starter",
            usageLimit: planInfo?.limit || 50,
          });
        }
        break;
      }
    }

    res.json({ received: true });
  });

  app.use(express.json({ limit: "2gb" }));
  app.use(express.urlencoded({ limit: "2gb", extended: true }));

  // Request logging middleware
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      // Only log API requests or errors to reduce noise
      if (req.url.startsWith("/api") || res.statusCode >= 400) {
        console.log(`[SERVER] ${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
      }
    });
    next();
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

  // Stripe Subscription Endpoint
  app.post("/api/create-subscription-session", async (req, res) => {
    if (!stripe) return res.status(500).json({ error: "Stripe is not configured" });
    
    try {
      const { priceId, customerEmail, userId } = req.body;
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        customer_email: customerEmail,
        client_reference_id: userId,
        success_url: `${req.headers.origin}/?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.origin}/`,
        subscription_data: {
          metadata: { userId }
        }
      });

      res.json({ id: session.id, url: session.url });
    } catch (error: any) {
      console.error("[STRIPE] Error creating session:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Stripe Customer Portal
  app.post("/api/create-portal-session", async (req, res) => {
    if (!stripe) return res.status(500).json({ error: "Stripe is not configured" });
    
    try {
      const { customerId } = req.body;
      if (!customerId) return res.status(400).json({ error: "Customer ID is required" });

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${req.headers.origin}/`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
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

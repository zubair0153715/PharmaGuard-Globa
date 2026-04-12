import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import multer from "multer";
import crypto from "crypto";
import { PDFDocument } from "pdf-lib";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Configure Multer for file uploads
  const storage = multer.memoryStorage();
  const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
  });

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "PharmaGuard Global API" });
  });

  // SFDA Validator Endpoint
  app.post("/api/validate-document", upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
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
        pdfAIssues.push("Failed to parse PDF structure");
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

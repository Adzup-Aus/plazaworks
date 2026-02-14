import type { Express } from "express";
import {
  storage,
  isAuthenticated,
  requireUserId,
  clientPortalAuth,
  createClientPortalToken,
  type ClientPortalRequest,
} from "../../routes/shared";

export function registerClientPortalRoutes(app: Express): void {
  // Share link for job
  app.post("/api/jobs/:jobId/share", isAuthenticated, async (req: any, res) => {
    try {
      const userId = requireUserId(req);
      const job = await storage.getJob(req.params.jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const accessToken = await storage.createClientAccessToken({
        jobId: req.params.jobId,
        createdById: userId,
        isActive: true,
        expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : null,
      });

      res.status(201).json(accessToken);
    } catch (err: any) {
      console.error("Error creating share link:", err);
      res.status(500).json({ message: "Failed to create share link" });
    }
  });

  app.get("/api/jobs/:jobId/share", isAuthenticated, async (req, res) => {
    try {
      const tokens = await storage.getClientAccessTokensByJob(req.params.jobId);
      res.json(tokens);
    } catch (err: any) {
      console.error("Error fetching share links:", err);
      res.status(500).json({ message: "Failed to fetch share links" });
    }
  });

  app.delete("/api/share/:id", isAuthenticated, async (req, res) => {
    try {
      const revoked = await storage.revokeClientAccessToken(req.params.id);
      if (!revoked) {
        return res.status(404).json({ message: "Share link not found" });
      }
      res.json({ revoked: true });
    } catch (err: any) {
      console.error("Error revoking share link:", err);
      res.status(500).json({ message: "Failed to revoke share link" });
    }
  });

  app.get("/s/:shortCode", async (req, res) => {
    try {
      const accessToken = await storage.getClientAccessTokenByShortCode(req.params.shortCode);
      if (!accessToken || !accessToken.isActive) {
        return res.status(404).send("Link not found or expired");
      }

      if (accessToken.expiresAt && new Date(accessToken.expiresAt) < new Date()) {
        return res.status(410).send("This link has expired");
      }

      res.redirect(`/portal/${accessToken.token}`);
    } catch (err: any) {
      console.error("Error resolving short link:", err);
      res.status(500).send("Error resolving link");
    }
  });

  app.get("/api/portal/:token", async (req, res) => {
    try {
      const accessToken = await storage.getClientAccessToken(req.params.token);
      if (!accessToken) {
        return res.status(404).json({ message: "Invalid or expired link" });
      }

      if (accessToken.expiresAt && new Date(accessToken.expiresAt) < new Date()) {
        return res.status(410).json({ message: "This link has expired" });
      }

      const job = await storage.getJob(accessToken.jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      const pcItemsList = await storage.getPCItems(accessToken.jobId);
      const jobInvoices = await storage.getInvoicesByJob(accessToken.jobId);

      res.json({
        job: {
          id: job.id,
          clientName: job.clientName,
          address: job.address,
          jobType: job.jobType,
          status: job.status,
          description: job.description,
        },
        pcItems: pcItemsList.map((item) => ({
          id: item.id,
          title: item.title,
          status: item.status,
          startDate: item.startDate,
          finishDate: item.finishDate,
        })),
        invoices: jobInvoices
          .filter((inv) => inv.status !== "draft")
          .map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            status: inv.status,
            total: inv.total,
            amountPaid: inv.amountPaid,
            amountDue: inv.amountDue,
            dueDate: inv.dueDate,
          })),
      });
    } catch (err: any) {
      console.error("Error fetching portal data:", err);
      res.status(500).json({ message: "Failed to fetch job details" });
    }
  });

  // Client portal auth - request OTP
  app.post("/api/client-portal/auth/request-otp", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const portalAccount = await storage.getClientPortalAccountByEmail(email);
      if (!portalAccount) {
        console.log(`Client portal OTP requested for unknown email: ${email}`);
        return res.json({
          success: true,
          message: "If this email is registered, you will receive a login code",
        });
      }

      const client = await storage.getClient(portalAccount.clientId);
      if (!client?.portalEnabled) {
        console.log(`Client portal OTP requested for disabled portal: ${email}`);
        return res.json({
          success: true,
          message: "If this email is registered, you will receive a login code",
        });
      }

      const verificationCode = await storage.createClientPortalVerificationCode(
        portalAccount.id,
        email,
        "login"
      );

      console.log(`[CLIENT PORTAL] OTP code for ${email}: ${verificationCode.code}`);

      res.json({
        success: true,
        message: "If this email is registered, you will receive a login code",
      });
    } catch (err: any) {
      console.error("Error requesting client portal OTP:", err);
      res.status(500).json({ message: "Failed to request login code" });
    }
  });

  // Client portal auth - verify OTP
  app.post("/api/client-portal/auth/verify-otp", async (req, res) => {
    try {
      const { email, code } = req.body;
      if (!email || !code) {
        return res.status(400).json({ message: "Email and code are required" });
      }

      const verification = await storage.verifyClientPortalCode(email, code, "login");
      if (!verification) {
        return res.status(401).json({ message: "Invalid or expired code" });
      }

      const portalAccount = await storage.getClientPortalAccountByEmail(email);
      if (!portalAccount) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const client = await storage.getClient(portalAccount.clientId);
      if (!client?.portalEnabled) {
        return res.status(403).json({ message: "Portal access is not enabled" });
      }

      await storage.updateClientPortalAccount(portalAccount.id, {
        isVerified: true,
        ...({ lastLoginAt: new Date() } as any),
      });

      const userAgent = req.headers["user-agent"] || undefined;
      const ipAddress = req.ip || req.headers["x-forwarded-for"]?.toString() || undefined;
      const { token } = await createClientPortalToken(
        {
          clientId: client.id,
          portalAccountId: portalAccount.id,
          email: client.email || email,
        },
        userAgent,
        ipAddress
      );

      res.json({
        success: true,
        token,
        client: {
          id: client.id,
          firstName: client.firstName,
          lastName: client.lastName,
          email: client.email,
          portalAccountId: portalAccount.id,
        },
      });
    } catch (err: any) {
      console.error("Error verifying client portal OTP:", err);
      res.status(500).json({ message: "Failed to verify login code" });
    }
  });

  app.get("/api/client-portal/jobs", clientPortalAuth, async (req: ClientPortalRequest, res) => {
    try {
      const clientId = req.clientPortal!.clientId;

      const client = await storage.getClient(clientId);
      if (!client?.portalEnabled) {
        return res.status(403).json({ message: "Portal access not enabled" });
      }

      const jobs = await storage.getClientJobsForPortal(clientId);
      res.json(jobs);
    } catch (err: any) {
      console.error("Error fetching client portal jobs:", err);
      res.status(500).json({ message: "Failed to fetch jobs" });
    }
  });

  app.get(
    "/api/client-portal/jobs/:jobId/timeline",
    clientPortalAuth,
    async (req: ClientPortalRequest, res) => {
      try {
        const clientId = req.clientPortal!.clientId;

        const job = await storage.getJob(req.params.jobId);
        if (!job || job.clientId !== clientId) {
          return res.status(404).json({ message: "Job not found" });
        }

        const milestones = await storage.getJobMilestonesForPortal(req.params.jobId);

        const timeline = milestones.map((m) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          status: m.status,
          progressPercent: m.progressPercent,
          scheduledStartDate: m.scheduledStartDate,
          scheduledEndDate: m.scheduledEndDate,
          completedAt: m.completedAt,
          payments: m.payments,
          mediaCount: m.media.length,
          recentMedia: m.media.slice(0, 4),
        }));

        res.json({ job, timeline });
      } catch (err: any) {
        console.error("Error fetching client portal timeline:", err);
        res.status(500).json({ message: "Failed to fetch timeline" });
      }
    }
  );

  app.post(
    "/api/client-portal/payments/:id/approve",
    clientPortalAuth,
    async (req: ClientPortalRequest, res) => {
      try {
        const clientId = req.clientPortal!.clientId;

        const payment = await storage.getMilestonePayment(req.params.id);
        if (!payment) {
          return res.status(404).json({ message: "Payment not found" });
        }

        const milestone = await storage.getMilestone(payment.milestoneId);
        if (!milestone) {
          return res.status(404).json({ message: "Milestone not found" });
        }

        const job = await storage.getJob(milestone.jobId);
        if (!job || job.clientId !== clientId) {
          return res.status(403).json({ message: "Not authorized to approve this payment" });
        }

        const updated = await storage.approveMilestonePayment(req.params.id);
        res.json(updated);
      } catch (err: any) {
        console.error("Error approving payment:", err);
        res.status(500).json({ message: "Failed to approve payment" });
      }
    }
  );

  app.post(
    "/api/client-portal/auth/logout",
    clientPortalAuth,
    async (req: ClientPortalRequest, res) => {
      try {
        await storage.revokePortalSession(req.clientPortal!.sessionId);
        res.json({ success: true });
      } catch (err: any) {
        console.error("Error logging out:", err);
        res.status(500).json({ message: "Failed to logout" });
      }
    }
  );

  app.get("/api/client-portal/quotes", clientPortalAuth, async (req: ClientPortalRequest, res) => {
    try {
      const clientId = req.clientPortal!.clientId;
      const quotes = await storage.getQuotesByClient(clientId);
      res.json(quotes);
    } catch (err: any) {
      console.error("Error fetching client quotes:", err);
      res.status(500).json({ message: "Failed to fetch quotes" });
    }
  });

  app.get(
    "/api/client-portal/quotes/:id",
    clientPortalAuth,
    async (req: ClientPortalRequest, res) => {
      try {
        const clientId = req.clientPortal!.clientId;
        const quote = await storage.getQuote(req.params.id);

        if (!quote || quote.clientId !== clientId) {
          return res.status(404).json({ message: "Quote not found" });
        }

        const lineItems = await storage.getLineItemsByQuote(quote.id);
        const paymentSchedules = await storage.getQuotePaymentSchedules(quote.id);
        const workflowEvents = await storage.getQuoteWorkflowEvents(quote.id);

        res.json({ ...quote, lineItems, paymentSchedules, workflowEvents });
      } catch (err: any) {
        console.error("Error fetching quote:", err);
        res.status(500).json({ message: "Failed to fetch quote" });
      }
    }
  );

  app.post(
    "/api/client-portal/quotes/:id/approve",
    clientPortalAuth,
    async (req: ClientPortalRequest, res) => {
      try {
        const clientId = req.clientPortal!.clientId;
        const quote = await storage.getQuote(req.params.id);

        if (!quote || quote.clientId !== clientId) {
          return res.status(404).json({ message: "Quote not found" });
        }

        if (quote.clientStatus !== "pending") {
          return res.status(400).json({ message: "Quote is not pending approval" });
        }

        const updated = await storage.updateQuote(req.params.id, {
          clientStatus: "approved",
          clientApprovedAt: new Date(),
          approvedByClientId: clientId,
          status: "accepted",
        } as any);

        await storage.createQuoteWorkflowEvent({
          quoteId: req.params.id,
          eventType: "approved",
          actorType: "client",
          actorId: clientId,
          notes: req.body.notes || null,
        });

        if (quote.organizationId) {
          const settings = await storage.getOrganizationSettings(quote.organizationId);
          if (settings?.autoConvertApprovedQuotes) {
            try {
              const invoice = await storage.createInvoiceFromQuote(req.params.id, "system");

              if (invoice) {
              await storage.createQuoteWorkflowEvent({
                quoteId: req.params.id,
                eventType: "auto_converted_to_invoice",
                actorType: "system",
                actorId: "system",
                notes: `Invoice ${invoice.invoiceNumber} created automatically`,
              });

                const convertResult = await storage.convertQuoteToJob(req.params.id);
                if (convertResult) {
                await storage.createQuoteWorkflowEvent({
                  quoteId: req.params.id,
                  eventType: "auto_converted_to_job",
                  actorType: "system",
                  actorId: "system",
                  notes: `Job created automatically`,
                });

                  await storage.updateInvoice(invoice.id, {
                    jobId: convertResult.job.id,
                  });
                }
              }
            } catch (convertError: any) {
              console.error("Auto-conversion error:", convertError);
              await storage.createQuoteWorkflowEvent({
                quoteId: req.params.id,
                eventType: "auto_convert_failed",
                actorType: "system",
                actorId: "system",
                notes: convertError.message || "Auto-conversion failed",
              });
            }
          }
        }

        res.json(updated);
      } catch (err: any) {
        console.error("Error approving quote:", err);
        res.status(500).json({ message: "Failed to approve quote" });
      }
    }
  );

  app.post(
    "/api/client-portal/quotes/:id/reject",
    clientPortalAuth,
    async (req: ClientPortalRequest, res) => {
      try {
        const clientId = req.clientPortal!.clientId;
        const quote = await storage.getQuote(req.params.id);

        if (!quote || quote.clientId !== clientId) {
          return res.status(404).json({ message: "Quote not found" });
        }

        if (quote.clientStatus !== "pending") {
          return res.status(400).json({ message: "Quote is not pending approval" });
        }

        const updated = await storage.updateQuote(req.params.id, {
          clientStatus: "rejected",
          status: "rejected",
        });

        await storage.createQuoteWorkflowEvent({
          quoteId: req.params.id,
          action: "rejected",
          actorType: "client",
          actorId: clientId,
          notes: req.body.reason || null,
        });

        res.json(updated);
      } catch (err: any) {
        console.error("Error rejecting quote:", err);
        res.status(500).json({ message: "Failed to reject quote" });
      }
    }
  );

  app.post(
    "/api/client-portal/quotes/:id/request-changes",
    clientPortalAuth,
    async (req: ClientPortalRequest, res) => {
      try {
        const clientId = req.clientPortal!.clientId;
        const quote = await storage.getQuote(req.params.id);

        if (!quote || quote.clientId !== clientId) {
          return res.status(404).json({ message: "Quote not found" });
        }

        if (quote.clientStatus !== "pending") {
          return res.status(400).json({ message: "Quote is not pending approval" });
        }

        const updated = await storage.updateQuote(req.params.id, {
          clientStatus: "changes_requested",
          status: "draft",
        });

        await storage.createQuoteWorkflowEvent({
          quoteId: req.params.id,
          eventType: "changes_requested",
          actorType: "client",
          actorId: clientId,
          notes: req.body.changes || null,
        });

        res.json(updated);
      } catch (err: any) {
        console.error("Error requesting changes:", err);
        res.status(500).json({ message: "Failed to request changes" });
      }
    }
  );
}
